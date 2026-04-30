"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto flex max-w-content flex-col items-center px-6 py-32 text-center">
      <span className="chip">404</span>
      <h1 className="mt-6 font-serif text-display">{t("error.notFoundTitle")}</h1>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink/60">
        {t("error.notFoundDesc")}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          {t("error.backHome")}
        </Link>
        <Link href="/discover" className="btn-secondary">
          {t("error.browseDiscover")}
        </Link>
      </div>
    </section>
  );
}
