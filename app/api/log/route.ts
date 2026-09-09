import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { MealType } from "@/lib/types";

const VALID_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { reason_text, meal_type } = body as Record<string, unknown>;

  // Validate reason_text — must be a non-empty, non-whitespace string
  if (
    typeof reason_text !== "string" ||
    reason_text.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "Reason is required." },
      { status: 400 }
    );
  }

  // Validate meal_type — must be one of the three enumerated values
  if (!VALID_MEAL_TYPES.includes(meal_type as MealType)) {
    return NextResponse.json(
      { error: "Meal type must be breakfast, lunch, or dinner." },
      { status: 400 }
    );
  }

  // Derive day_of_week from UTC date
  const day_of_week = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });

  // Insert into Supabase — never expose raw error details
  const { error: insertError } = await supabase
    .from("skip_logs")
    .insert({ reason_text: reason_text.trim(), meal_type, day_of_week });

  if (insertError) {
    return NextResponse.json(
      { error: "Could not save log. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
