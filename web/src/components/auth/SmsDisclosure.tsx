import Link from "next/link";

/**
 * Twilio toll-free verification (CTIA-compliant) SMS opt-in disclosure.
 *
 * Render this directly above any "Send Code" button on the web that triggers
 * an SMS via Twilio. The copy is dictated by the SMS Onboarding Compliance
 * PRD and must be rendered verbatim — US carriers and Twilio's compliance
 * review check the exact wording before approving the toll-free number.
 *
 * Do not paraphrase. The phrases "Msg & data rates may apply" and
 * "Reply STOP to opt out" are required.
 *
 * The Privacy Policy link must resolve to /privacy (where the matching
 * "SMS Communications" section is published).
 */
export function SmsDisclosure() {
  return (
    <p className="rounded-md border border-[var(--border)] bg-[var(--canvas-soft)] px-3 py-2 font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
      By tapping{" "}
      <strong className="font-semibold text-[var(--ink)]">Send Code</strong>,
      you agree to receive a one-time SMS verification code. Msg &amp; data
      rates may apply. Reply STOP to opt out. See our{" "}
      <Link
        href="/privacy#sms-communications"
        className="text-[var(--ink)] underline underline-offset-4"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
