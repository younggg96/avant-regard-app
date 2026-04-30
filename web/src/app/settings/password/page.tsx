"use client";

/**
 * /settings/password — change password (authenticated).
 *
 * Uses the same `/api/auth/change-password` backend as the mobile app.
 * On success we do NOT log the user out (the access token is still valid
 * — only the password changed), but we do clear the form so they don't
 * accidentally resubmit.
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/auth/store";
import { changePassword } from "@/lib/auth/service";

export default function PasswordSettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const getAccessToken = useAuthStore((s) => s.getAccessToken);

  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(false);

    if (!user?.userId) {
      setErr(t("auth.notLoggedIn"));
      return;
    }
    if (newPassword.length < 6) {
      setErr(t("settings.passwordMinLength"));
      return;
    }
    if (newPassword !== confirm) {
      setErr(t("settings.passwordMismatch"));
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setErr(t("auth.sessionExpired"));
      return;
    }

    setSaving(true);
    try {
      await changePassword(
        { userId: user.userId, oldPassword, newPassword },
        token,
      );
      setOk(true);
      setOld("");
      setNew("");
      setConfirm("");
    } catch (error) {
      setErr(error instanceof Error ? error.message : t("settings.changeFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0">
      <header className="mb-8 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          {t("settings.changePassword")}
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          {t("settings.changePasswordDesc")}
          <Link href="/auth/forgot" className="mx-1 link-underline">
            {t("settings.changePasswordLink")}
          </Link>
          {t("settings.changePasswordSuffix")}
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid max-w-md gap-5">
        <Field
          label={t("settings.currentPassword")}
          value={oldPassword}
          onChange={(e) => setOld(e.target.value)}
          type="password"
          required
        />
        <Field
          label={t("settings.newPassword")}
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          type="password"
          required
        />
        <Field
          label={t("settings.confirmNewPassword")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          type="password"
          required
        />

        {err && (
          <div className="font-label text-[13px] text-red-600 dark:text-red-400">
            {err}
          </div>
        )}
        {ok && (
          <div className="font-label text-[13px] text-green-700 dark:text-green-400">
            {t("settings.passwordChanged")}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[var(--ink)] px-6 py-2 font-label text-[13px] text-[var(--canvas)] transition-opacity disabled:opacity-40"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={type === "password" ? "new-password" : undefined}
        className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-serif text-[14px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
      />
    </div>
  );
}
