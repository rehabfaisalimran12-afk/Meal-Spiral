import type { RiskScore } from "@/lib/types";
import WellbeingMessage from "./WellbeingMessage";

interface RiskSectionProps {
  riskScore: RiskScore | null;
  isLoading: boolean;
  error: string | null;
  restrictionActive: boolean;
}

const badgeStyles: Record<RiskScore["risk_level"], string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function RiskSection({
  riskScore,
  isLoading,
  error,
  restrictionActive,
}: RiskSectionProps) {
  if (restrictionActive) {
    return <WellbeingMessage />;
  }

  return (
    <section aria-labelledby="risk-section-heading">
      <h2
        id="risk-section-heading"
        className="mb-4 text-lg font-semibold text-gray-900"
      >
        Today&apos;s Risk
      </h2>

      {isLoading && (
        <p className="text-gray-500" role="status" aria-live="polite">
          Calculating risk…
        </p>
      )}

      {!isLoading && error && (
        <p className="text-red-600" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && riskScore && (
        <div className="space-y-3">
          <span
            className={`inline-block rounded-full px-4 py-1 text-sm font-medium ${badgeStyles[riskScore.risk_level]}`}
          >
            {capitalize(riskScore.risk_level)}
          </span>
          <p className="text-gray-700">{riskScore.explanation}</p>
        </div>
      )}
    </section>
  );
}
