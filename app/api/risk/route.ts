import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { groq } from "@/lib/groq";
import { getClusters } from "@/lib/clusterer";
import type { RiskScore, RiskLevel } from "@/lib/types";

const VALID_RISK_LEVELS: RiskLevel[] = ["low", "medium", "high"];

const SYSTEM_PROMPT = `You are a pattern-awareness assistant helping a user understand their meal-skipping
momentum. You are NOT a medical professional. Do not give medical advice.

Assess the risk level using exactly one of: low, medium, high.
Write a plain-language explanation of no more than 60 words.

Respond with ONLY valid JSON:
{ "risk_level": "low" | "medium" | "high", "explanation": "<≤60 words>" }
No explanation outside the JSON, no markdown, no code fences.`;

function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

function computeStreakDays(dates: Set<string>): number {
  const today = new Date();
  let streak = 0;

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function POST() {
  // 1. Fetch last 14 logs from Supabase
  let rows: { id: string; created_at: string; meal_type: string; day_of_week: string }[];

  try {
    const { data, error } = await supabase
      .from("skip_logs")
      .select("id, created_at, meal_type, day_of_week")
      .order("created_at", { ascending: false })
      .limit(14);

    if (error) {
      return NextResponse.json(
        { error: "Could not load logs. Please try again." },
        { status: 500 }
      );
    }

    rows = data ?? [];
  } catch {
    return NextResponse.json(
      { error: "Could not load logs. Please try again." },
      { status: 500 }
    );
  }

  // 2. If fewer than 3 logs, return early without calling Groq
  if (rows.length < 3) {
    return NextResponse.json(
      {
        risk_level: "low",
        explanation: "Not enough data yet to assess a pattern.",
      } satisfies RiskScore,
      { status: 200 }
    );
  }

  // 3. Compute streakDays
  const calendarDates = new Set<string>(rows.map((r) => r.created_at.slice(0, 10)));
  const streakDays = computeStreakDays(calendarDates);

  // 4. Compute dayDistribution
  const dayDistribution: Record<string, number> = {};
  for (const row of rows) {
    dayDistribution[row.day_of_week] = (dayDistribution[row.day_of_week] ?? 0) + 1;
  }

  // 5. Get cluster labels via shared getClusters() — uses real LLM-derived labels
  const clusterResult = await getClusters();
  const clusterLabels = clusterResult.ok
    ? clusterResult.clusters.map((c) => c.label)
    : []; // If clustering fails, proceed with empty labels rather than aborting risk scoring

  // 6. Build Groq prompt
  const userMessage = `Consecutive days with at least one skipped meal: ${streakDays}
Days of the week distribution: ${JSON.stringify(dayDistribution)}
Recurring pattern labels: ${clusterLabels.length > 0 ? clusterLabels.join(", ") : "none"}

Based on this momentum, assess the risk that this skipping pattern will escalate.
Return the JSON object only.`;

  // 7. Call Groq
  let parsed: unknown;

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content ?? "";

    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Could not assess risk. Please try again." },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not assess risk. Please try again." },
      { status: 500 }
    );
  }

  // 8. Validate and normalise the parsed response
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json(
      { error: "Could not assess risk. Please try again." },
      { status: 500 }
    );
  }

  const raw = parsed as Record<string, unknown>;

  // 8a. Validate / default risk_level
  let riskLevel: RiskLevel;
  if (VALID_RISK_LEVELS.includes(raw.risk_level as RiskLevel)) {
    riskLevel = raw.risk_level as RiskLevel;
  } else {
    console.warn(
      `[/api/risk] Unexpected risk_level value from Groq: ${JSON.stringify(raw.risk_level)}. Defaulting to "low".`
    );
    riskLevel = "low";
  }

  // 8b. Validate / truncate explanation
  if (typeof raw.explanation !== "string") {
    return NextResponse.json(
      { error: "Could not assess risk. Please try again." },
      { status: 500 }
    );
  }
  const explanation = truncateToWords(raw.explanation, 60);

  // 9. Return 200 RiskScore
  const riskScore: RiskScore = { risk_level: riskLevel, explanation };
  return NextResponse.json(riskScore, { status: 200 });
}
