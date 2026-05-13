"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { ThemeSegmented } from "@/components/ThemeSegmented";
import { useAuthStore } from "@/lib/auth/store";
import { userInfoService, type ThemePreference } from "@/lib/services/user-info";

export default function AppearanceSettingsPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [current, setCurrent] = useState<ThemePreference>("system");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (theme === "light" || theme === "dark" || theme === "system") {
      setCurrent(theme);
    }
  }, [theme]);

  const handleChange = async (next: ThemePreference) => {
    setCurrent(next);
    setSaved(false);
    setError(null);
    updateUser({ preferredTheme: next });
    if (!user?.userId) return;
    setSaving(true);
    try {
      await userInfoService.updateThemePreference(user.userId, next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0">
      <header className="mb-8 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          {t("settings.appearance")}
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          {t("settings.appearanceDesc")}
        </p>
      </header>

      <div className="grid max-w-xl gap-4">
        <ThemeSegmented value={current} onChange={handleChange} />
        {saving && (
          <p className="text-[13px] text-[color:var(--ink-muted)]">{t("settings.savingAppearance")}</p>
        )}
        {saved && !saving && (
          <p className="text-[13px] text-green-700 dark:text-green-400">{t("settings.appearanceSaved")}</p>
        )}
        {error && (
          <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </section>
  );
}
