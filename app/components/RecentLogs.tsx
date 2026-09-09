import type { SkipLog } from "@/lib/types";

interface RecentLogsProps {
  logs: SkipLog[];
  isLoading: boolean;
  error: string | null;
}

/**
 * RecentLogs
 *
 * Displays the most recent skip log entries.
 * Logs are expected pre-sorted (most recent first) by the caller.
 * Requirements: 4.1, 4.4, 4.5
 */
export default function RecentLogs({ logs, isLoading, error }: RecentLogsProps) {
  return (
    <section aria-labelledby="recent-logs-heading">
      <h2
        id="recent-logs-heading"
        className="mb-4 text-lg font-semibold text-gray-800"
      >
        Recent Skips
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
          Loading recent logs…
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

      {!isLoading && !error && logs.length === 0 && (
        <p className="text-sm text-gray-500">No skipped meals recorded yet.</p>
      )}

      {!isLoading && !error && logs.length > 0 && (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {capitalise(log.meal_type)}
                </span>
                <span className="text-xs text-gray-500">{log.day_of_week}</span>
              </div>
              <p className="text-sm text-gray-700">{log.reason_text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function capitalise(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
