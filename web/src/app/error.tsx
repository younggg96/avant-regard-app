"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("Web error boundary:", error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-content flex-col items-center px-6 py-32 text-center">
      <span className="chip">Error</span>
      <h1 className="mt-6 font-serif text-display">{t("error.errorTitle")}</h1>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink/60">
        {t("error.errorDesc")}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          {t("error.retry")}
        </button>
        <Link href="/" className="btn-secondary">
          {t("error.backHome")}
        </Link>
      </div>
    </section>
  );
}
