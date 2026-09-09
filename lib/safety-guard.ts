import type { GuardResult, MealType, SkipLog } from "./types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

const RESTRICTION_PHRASES = [
  "not hungry",
  "don't want to",
  "don't feel like",
  "not interested",
];

/**
 * Extracts the calendar date string (YYYY-MM-DD) from an ISO 8601 UTC timestamp.
 * e.g. "2024-01-15T08:30:00Z" → "2024-01-15"
 */
function toCalendarDate(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Pure function — no I/O, no side effects.
 * Evaluates skip logs for restriction signals.
 *
 * @param last7DaysLogs - All skip_logs within the last 7 calendar days
 * @param last14Logs    - The 14 most recent skip_logs (by created_at)
 * @returns GuardResult
 */
export function evaluateRestrictionSignal(
  last7DaysLogs: SkipLog[],
  last14Logs: SkipLog[]
): GuardResult {
  // ─── FREQUENCY SIGNAL ──────────────────────────────────────────────────────
  // For each meal type, count the distinct calendar days on which it was skipped.
  // All three must reach ≥ 5 distinct days to fire.
  const frequencySignal = MEAL_TYPES.every((mealType) => {
    const distinctDays = new Set(
      last7DaysLogs
        .filter((log) => log.meal_type === mealType)
        .map((log) => toCalendarDate(log.created_at))
    );
    return distinctDays.size >= 5;
  });

  if (frequencySignal) {
    return { restrictionActive: true, triggeredBy: "frequency" };
  }

  // ─── LANGUAGE SIGNAL ───────────────────────────────────────────────────────
  // Count logs whose lowercased reason_text contains any restriction phrase.
  // Fires when ratio ≥ 0.60 (or when last14Logs is empty, ratio = 0 → no signal).
  if (last14Logs.length > 0) {
    const matchCount = last14Logs.filter((log) => {
      const lower = log.reason_text.toLowerCase();
      return RESTRICTION_PHRASES.some((phrase) => lower.includes(phrase));
    }).length;

    const ratio = matchCount / last14Logs.length;

    if (ratio >= 0.6) {
      return { restrictionActive: true, triggeredBy: "language" };
    }
  }

  // ─── NO SIGNAL ─────────────────────────────────────────────────────────────
  return { restrictionActive: false, triggeredBy: null };
}
