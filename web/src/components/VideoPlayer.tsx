"use client";

import { useState } from "react";
import { withPosterFragment } from "@/lib/media";

interface VideoPlayerProps {
  src: string;
  label?: string;
  className?: string;
  priority?: boolean;
}

/**
 * Full-width video player used on the post detail page. Uses native browser
 * controls (play/scrub/volume/fullscreen) — no custom UI layer, which keeps
 * accessibility and platform affordances free.
 *
 * `priority` maps to `preload="auto"` for the first media in the post so
 * playback starts quickly; subsequent videos use `preload="metadata"` so only
 * the first frame is fetched until the user presses play.
 */
export function VideoPlayer({
  src,
  label,
  className = "",
  priority = false,
}: VideoPlayerProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <video
      src={withPosterFragment(src)}
      aria-label={label}
      controls
      playsInline
      preload={priority ? "auto" : "metadata"}
      onLoadedData={() => setLoaded(true)}
      className={`${className} transition-opacity duration-500 ease-out ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
