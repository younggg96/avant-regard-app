import type { Metadata } from "next";
import { config } from "@/lib/config";
import { PrivacyView } from "./view";

/**
 * Public privacy policy at /privacy.
 *
 * This page is referenced from:
 *   1. The mobile app sign-up screen's SMS opt-in disclosure block
 *      (Twilio toll-free verification requires the link to resolve to a live,
 *      publicly accessible page containing an SMS Communications section).
 *   2. The site footer and the in-app Privacy Policy modal link.
 *
 * The `SMS Communications` paragraph MUST be rendered verbatim per the
 * SMS Onboarding Compliance PRD — US carriers (CTIA guidelines) and Twilio's
 * compliance review check the exact wording before approving toll-free
 * verification. Do not paraphrase. Replace any prior SMS section with the
 * version below if updating.
 */

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Avant Regard privacy policy, including our SMS Communications policy for one-time verification codes used during account authentication.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "article",
    title: "Avant Regard · Privacy Policy",
    description:
      "How Avant Regard collects, uses, and protects personal information, including SMS verification codes.",
    url: `${config.siteUrl}/privacy`,
  },
  // Privacy policy pages should remain indexable so Twilio / users can verify
  // the live URL during compliance review.
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
