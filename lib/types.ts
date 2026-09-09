export type MealType = "breakfast" | "lunch" | "dinner";

export type RiskLevel = "low" | "medium" | "high";

/** Row shape returned from Supabase skip_logs table */
export interface SkipLog {
  id: string;
  created_at: string; // ISO 8601 UTC timestamp
  reason_text: string;
  meal_type: MealType;
  day_of_week: string; // e.g. "Monday"
}

/** A cluster of skip reasons with a user-language label */
export interface Cluster {
  label: string; // Short phrase in user's own language
  reasons: string[]; // Original reason_text strings in this cluster
}

/** Risk assessment produced by the Risk_Scorer */
export interface RiskScore {
  risk_level: RiskLevel;
  explanation: string; // Plain-language sentence, ≤ 60 words
}

/** Input supplied to the Groq risk prompt */
export interface RiskContext {
  streakDays: number; // Consecutive days with at least one skip
  dayDistribution: Record<string, number>; // { Monday: 3, Tuesday: 1, ... }
  clusterLabels: string[]; // Active cluster labels for context
}

/** Return value of the Safety_Guard evaluation */
export interface GuardResult {
  restrictionActive: boolean;
  triggeredBy: "frequency" | "language" | null;
}
