import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.siteUrl;
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, priority: 1.0 },
    { url: `${base}/discover`, lastModified: now, priority: 0.9 },
    { url: `${base}/download`, lastModified: now, priority: 0.8 },
  ];
}
