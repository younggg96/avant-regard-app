"use client";

/**
 * Loading overlay for image / video covers.
 *
 *  - Absolutely positioned: parent MUST be `position: relative` and already
 *    provide the placeholder background colour (the same contract `FadeImage`
 *    documents).
 *  - Renders a subtle highlight band that sweeps across the box; fades out
 *    smoothly once the media has decoded.
 *  - Decorative only (`aria-hidden`) so assistive tech ignores it.
 *
 * Single source of truth so `FadeImage` and `VideoCover` stay consistent.
 */
interface MediaSkeletonProps {
  visible: boolean;
}

export function MediaSkeleton({ visible }: MediaSkeletonProps) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-500 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1/2 animate-shimmer
                   bg-gradient-to-r from-transparent via-white/55 to-transparent
                   dark:via-white/[0.06]"
      />
    </span>
  );
}
