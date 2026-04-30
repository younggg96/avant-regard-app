"use client";

import { useTranslation } from "react-i18next";
import { setLanguage, getCurrentLanguage, type SupportedLanguage } from "@/lib/i18n";
import { useState } from "react";

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
];

export default function LanguageSettingsPage() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<SupportedLanguage>(getCurrentLanguage);

  const handleSelect = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setCurrent(lang);
  };

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-semibold">
        {t("settings.languageSettings")}
      </h1>

      <div className="space-y-3">
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            onClick={() => handleSelect(code)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
              current === code
                ? "border-[var(--ink)] bg-[var(--canvas-soft)]"
                : "border-[var(--border)] hover:border-[var(--ink-muted)]"
            }`}
          >
            <span className="text-[15px] font-medium text-[var(--ink)]">
              {label}
            </span>
            {current === code && (
              <svg
                className="h-5 w-5 text-[var(--ink)]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[13px] text-[color:var(--ink-muted)]">
        {t("settings.saved")}
      </p>
    </div>
  );
}
