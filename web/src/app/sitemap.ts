import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.siteUrl;
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, priority: 1.0 },
    { url: `${base}/discover`, lastModified: now, priority: 0.9 },
    { url: `${base}/app`, lastModified: now, priority: 0.6 },
    { url: `${base}/download`, lastModified: now, priority: 0.65 },
    // Privacy policy must be crawlable so Twilio toll-free verification can
    // reach the SMS Communications section at /privacy#sms-communications.
    // The page itself lists both flavor URLs (CN + NA) for transparency.
    {
      url: `${base}/privacy`,
      lastModified: now,
      priority: 0.5,
      alternates: {
        languages: {
          "zh-CN": "https://avantregard.com/privacy",
          "en-US": "https://avantregards.com/privacy",
        },
      },
    },
  ];
}
