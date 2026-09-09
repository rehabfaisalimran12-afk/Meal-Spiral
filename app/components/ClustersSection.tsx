import type { Cluster } from "@/lib/types";
import WellbeingMessage from "./WellbeingMessage";

interface ClustersSectionProps {
  clusters: Cluster[];
  isLoading: boolean;
  error: string | null;
  restrictionActive: boolean;
}

/**
 * ClustersSection
 *
 * Displays AI-derived skip reason clusters.
 * When a Restriction_Signal is active, renders only the WellbeingMessage —
 * no cluster labels, reasons, or pattern-awareness content.
 * Requirements: 4.2, 4.4, 4.5, 4.6, 5.4, 5.6
 */
export default function ClustersSection({
  clusters,
  isLoading,
  error,
  restrictionActive,
}: ClustersSectionProps) {
  if (restrictionActive) {
    return <WellbeingMessage />;
  }

  return (
    <section aria-labelledby="clusters-heading">
      <h2
        id="clusters-heading"
        className="mb-4 text-lg font-semibold text-gray-800"
      >
        Recurring Patterns
      </h2>

      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-gray-500"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
            aria-hidden="true"
          />
          Analysing patterns…
        </div>
      )}

      {!isLoading && error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {!isLoading && !error && clusters.length === 0 && (
        <p className="text-sm text-gray-500">
          Not enough data yet to identify patterns.
        </p>
      )}

      {!isLoading && !error && clusters.length > 0 && (
        <div className="space-y-5">
          {clusters.map((cluster, index) => (
            <div key={index} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">
                {cluster.label}
              </h3>
              <ul className="space-y-1">
                {cluster.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
