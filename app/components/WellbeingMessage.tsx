/**
 * WellbeingMessage
 *
 * Shown when the Safety_Guard detects a Restriction_Signal.
 * Must NOT render any risk_level, cluster label, or pattern score content.
 * Requirements: 5.5, 5.6
 */
export default function WellbeingMessage() {
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 px-6 py-5 text-amber-900">
      <p className="text-base leading-relaxed">
        We&apos;ve noticed a pattern in your recent logs worth gently
        acknowledging. If meal skipping has been feeling harder to step back
        from, you&apos;re not alone and support is available.{" "}
        <a
          href="https://www.allianceforeatingdisorders.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-amber-700 transition-colors"
        >
          The Alliance for Eating Disorders Awareness
        </a>{" "}
        offers free resources and a helpline whenever you&apos;re ready.
      </p>
    </div>
  );
}
