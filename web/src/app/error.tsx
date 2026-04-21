"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Web error boundary:", error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-content flex-col items-center px-6 py-32 text-center">
      <span className="chip">Error</span>
      <h1 className="mt-6 font-serif text-display">页面出了点问题。</h1>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink/60">
        请稍后重试。如果问题持续，可以先返回首页或浏览 Discover 稍后再来。
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          重试
        </button>
        <Link href="/" className="btn-secondary">
          返回首页
        </Link>
      </div>
    </section>
  );
}
