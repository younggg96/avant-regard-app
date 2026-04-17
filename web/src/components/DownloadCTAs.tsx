import Link from "next/link";
import { config } from "@/lib/config";

interface DownloadCTAsProps {
  className?: string;
  variant?: "default" | "inverted";
}

const ICON_APPLE = (
  <svg
    aria-hidden
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M19.665 17.316c-.315.726-.69 1.394-1.128 2.008-.595.84-1.082 1.42-1.458 1.742-.582.523-1.206.79-1.876.808-.48 0-1.058-.137-1.732-.412-.678-.275-1.3-.412-1.87-.412-.596 0-1.236.137-1.923.412-.688.275-1.243.42-1.666.436-.645.028-1.288-.246-1.925-.823-.41-.358-.917-.956-1.518-1.795-.65-.89-1.182-1.927-1.598-3.114C.564 14.941.25 13.627.25 12.347c0-1.485.32-2.767.962-3.84A5.63 5.63 0 0 1 3.23 6.39a5.43 5.43 0 0 1 2.73-.78c.517 0 1.195.16 2.037.473.842.314 1.383.474 1.62.474.178 0 .776-.186 1.79-.559 1.005-.345 1.854-.487 2.55-.427 1.874.151 3.283.89 4.218 2.22-1.676 1.015-2.506 2.438-2.49 4.265.017 1.423.533 2.608 1.547 3.546.459.434.97.77 1.54 1.007-.124.36-.254.706-.392 1.045zM14.998 2c0 .96-.355 1.857-1.061 2.688-.854.988-1.885 1.559-3.005 1.468a3.075 3.075 0 0 1-.022-.365c0-.921.406-1.907 1.125-2.713.358-.41.813-.75 1.364-1.022C13.948 1.787 14.467 1.637 14.956 1.6c.028.134.042.268.042.4z" />
  </svg>
);

const ICON_PLAY = (
  <svg
    aria-hidden
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M3.609 1.814 13.792 12 3.61 22.186a.998.998 0 0 1-.609-.923V2.736c0-.377.225-.709.609-.922zM14.5 12.708l2.404 2.404-12.21 6.853L14.5 12.708zm0-1.417L4.694 2.035l12.21 6.853-2.404 2.403zm1.413-.707 2.94 1.651c.716.402.716 1.497 0 1.899l-2.94 1.65L12.708 12l3.205-3.416z" />
  </svg>
);

export function DownloadCTAs({
  className,
  variant = "default",
}: DownloadCTAsProps) {
  const primaryClass =
    variant === "inverted"
      ? "inline-flex items-center gap-3 rounded-full border border-white/20 bg-white px-6 py-3.5 text-sm font-medium text-ink transition hover:bg-ink-100"
      : "inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-soft";
  const secondaryClass =
    variant === "inverted"
      ? "inline-flex items-center gap-3 rounded-full border border-white/30 bg-transparent px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/10"
      : "inline-flex items-center gap-3 rounded-full border border-ink/15 bg-white px-6 py-3.5 text-sm font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-white";

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      <Link href={config.appStoreUrl} className={primaryClass} rel="noopener">
        <span className="opacity-80">{ICON_APPLE}</span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase tracking-widest opacity-60">
            Download on the
          </span>
          <span className="text-sm tracking-wide">App Store</span>
        </span>
      </Link>

      <Link
        href={config.playStoreUrl}
        className={secondaryClass}
        rel="noopener"
      >
        <span className="opacity-80">{ICON_PLAY}</span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase tracking-widest opacity-60">
            Get it on
          </span>
          <span className="text-sm tracking-wide">Google Play</span>
        </span>
      </Link>
    </div>
  );
}
