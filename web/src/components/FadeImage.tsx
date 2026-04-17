"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * Thin wrapper around next/image that:
 *  - starts transparent so the parent container's background acts as a skeleton
 *  - fades in once the image has decoded and painted
 *
 * The parent container MUST have a background color (e.g. bg-ink-200) and
 * overflow-hidden so the skeleton is visible before the image arrives.
 */
export function FadeImage({
  className,
  onLoad,
  ...props
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
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
  );
}
