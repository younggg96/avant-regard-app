"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { MediaSkeleton } from "@/components/MediaSkeleton";

/**
 * Thin wrapper around next/image that:
 *  - starts transparent so the parent container's background acts as a skeleton
 *  - overlays a shimmering `MediaSkeleton` while the image is loading
 *  - fades in once the image has decoded and painted
 *
 * The parent container MUST have `position: relative`, a background color
 * (e.g. `bg-ink-200`), and `overflow-hidden` so the skeleton renders inside
 * the cover box.
 */
export function FadeImage({
  className,
  onLoad,
  ...props
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Image
        {...props}
        className={`${className ?? ""} transition-opacity duration-500 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />
      <MediaSkeleton visible={!loaded} />
    </>
  );
}
