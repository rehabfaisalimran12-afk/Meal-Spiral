import { supabase } from "@/lib/supabase";
import { groq } from "@/lib/groq";
import type { Cluster } from "@/lib/types";

// SERVER-ONLY: only import from app/api/[route]/route.ts files.
// Contains the Supabase fetch, Groq call, and response validation for clustering.

const SYSTEM_PROMPT = `You are a pattern-recognition assistant. Your job is to group meal-skipping reasons into clusters using the user's own language -- never use generic category names like "work stress" unless those exact words appear in the entries.

Respond with ONLY valid JSON matching this schema:
[
  { "label": "<short phrase from user's own words>", "reasons": ["<reason1>", "<reason2>"] },
  ...
]
No explanation, no markdown, no code fences.`;

function isClusterArray(value: unknown): value is Cluster[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).label === "string" &&
      Array.isArray((item as Record<string, unknown>).reasons) &&
      ((item as Record<string, unknown>).reasons as unknown[]).every(
        (r) => typeof r === "string"
      )
  );
}

export type ClusterResult =
  | { ok: true; clusters: Cluster[] }
  | { ok: false; status: 500; message: string };

export async function getClusters(): Promise<ClusterResult> {
  let reasons: string[];

  try {
    const { data, error } = await supabase
      .from("skip_logs")
      .select("reason_text")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return { ok: false, status: 500, message: "Could not load logs. Please try again." };
    }

    reasons = (data ?? []).map((row: { reason_text: string }) => row.reason_text);
  } catch {
    return { ok: false, status: 500, message: "Could not load logs. Please try again." };
  }

  if (reasons.length < 3) {
    return { ok: true, clusters: [] };
  }

  const userMessage = `Here are the recent meal-skipping reasons (one per line):
${reasons.join("\n")}

Group them into clusters. Each reason must appear in exactly one cluster.
Return the JSON array only.`;

  let parsed: unknown;

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
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
      return { ok: false, status: 500, message: "Could not process patterns. Please try again." };
    }
  } catch {
    return { ok: false, status: 500, message: "Could not process patterns. Please try again." };
  }

  if (!isClusterArray(parsed)) {
    return { ok: false, status: 500, message: "Could not process patterns. Please try again." };
  }

  return { ok: true, clusters: parsed as Cluster[] };
}
