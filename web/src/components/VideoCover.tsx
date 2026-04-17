"use client";

import { useRef, useState } from "react";
import { withPosterFragment } from "@/lib/media";

interface VideoCoverProps {
  src: string;
  /** Accessible label; PostCard passes the post title. */
  label?: string;
  className?: string;
}

/**
 * Grid-card video thumbnail.
 *
 *  - Shows the first frame as a still (via #t=0.1 media fragment + preload="metadata")
 *  - Autoplays muted/looped on hover (desktop); on touch devices the still
 *    remains, mirroring the mobile app where tapping opens the detail page.
 *  - Fades in on first paint to match FadeImage behaviour.
 *
 * The enclosing `<Link>` in PostCard covers the whole card, so hover events
 * on the video element itself are sufficient to drive play/pause without
 * threading hover state through the parent.
 */
export function VideoCover({ src, label, className = "" }: VideoCoverProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  const handleEnter = () => {
    const el = videoRef.current;
    if (!el) return;
    el.play().catch(() => {
      /* Autoplay can be blocked in some contexts; silently ignore. */
    });
  };

  const handleLeave = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  };

  return (
    <video
      ref={videoRef}
      src={withPosterFragment(src)}
      aria-label={label}
      muted
      loop
      playsInline
      preload="metadata"
      onLoadedData={() => setLoaded(true)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`${className} transition-opacity duration-500 ease-out ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

/**
 * Small top-right badge indicating the cover is a video.
 * Kept as a separate named export so PostCard can place it without coupling
 * to VideoCover's internals.
 */
export function VideoBadge() {
  return (
    <span
      aria-hidden
      className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full backdrop-blur
                 bg-black/55 text-white
                 dark:bg-white/20 dark:text-white"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3 translate-x-[1px]"
        fill="currentColor"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}
