"use client";

/**
 * /settings/profile — edit username / bio / location / avatar URL / cover URL.
 *
 * Avatar + cover are edited as URL strings (not file upload) because the web
 * write scope excludes binary uploads; users with an off-site CDN image can
 * paste the URL here. Uploading happens on mobile.
 *
 * On successful save, we update both the backend and the local auth store so
 * the header avatar / name refreshes immediately without a full reload.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useAuthStore } from "@/lib/auth/store";
import {
  userInfoService,
  type UpdateUserInfoParams,
} from "@/lib/services/user-info";
import { isRenderableImage } from "@/lib/isRenderableImage";
import type { UserInfo } from "@/lib/types";

export default function ProfileSettingsPage() {
  const { t } = useTranslation();
  const storeUser = useAuthStore((s) => s.user);
  const updateStoreUser = useAuthStore((s) => s.updateUser);
  const userId = storeUser?.userId;

  const { data: profile, mutate: refreshProfile } = useSWR<UserInfo>(
    userId ? ["user-info", userId] : null,
    () => userInfoService.get(userId!),
  );

  const [form, setForm] = useState<UpdateUserInfoParams>({
    username: "",
    bio: "",
    location: "",
    avatarUrl: "",
    coverUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      location: profile.location ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      coverUrl: profile.coverUrl ?? "",
    });
  }, [profile]);

  const onChange =
    (k: keyof UpdateUserInfoParams) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((s) => ({ ...s, [k]: e.target.value }));
    };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setOk(false);
    setErr(null);
    try {
      const next = await userInfoService.update(userId, form);
      updateStoreUser({
        username: next.username,
        bio: next.bio,
        location: next.location,
        avatar: next.avatarUrl,
      });
      await refreshProfile(next, { revalidate: false });
      setOk(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0">
      <header className="mb-8 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          {t("settings.editProfile")}
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          {t("settings.editProfileDesc")}
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid max-w-xl gap-5">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--canvas-raised)]">
            {isRenderableImage(form.avatarUrl) && (
              <Image
                src={form.avatarUrl}
                alt="avatar preview"
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            )}
          </div>
          <div className="flex-1">
            <Field
              label={t("settings.avatarUrl")}
              value={form.avatarUrl ?? ""}
              onChange={onChange("avatarUrl")}
              placeholder="https://..."
            />
          </div>
        </div>

        <Field
          label={t("settings.coverUrl")}
          value={form.coverUrl ?? ""}
          onChange={onChange("coverUrl")}
          placeholder="https://..."
        />

        <Field
          label={t("settings.username")}
          value={form.username ?? ""}
          onChange={onChange("username")}
          required
        />

        <Field
          label={t("settings.location")}
          value={form.location ?? ""}
          onChange={onChange("location")}
          placeholder="Shanghai · 上海"
        />

        <div>
          <label className="mb-1.5 block font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {t("settings.bio")}
          </label>
          <textarea
            value={form.bio ?? ""}
            onChange={onChange("bio")}
            rows={4}
            maxLength={240}
            className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-serif text-[14px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
          />
          <div className="mt-1 text-right font-label text-[11px] text-[color:var(--ink-muted)]">
            {(form.bio ?? "").length} / 240
          </div>
        </div>

        {err && (
          <div className="font-label text-[13px] text-red-600 dark:text-red-400">
            {err}
          </div>
        )}
        {ok && (
          <div className="font-label text-[13px] text-green-700 dark:text-green-400">
            {t("common.saved")}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[var(--ink)] px-6 py-2 font-label text-[13px] text-[var(--canvas)] transition-opacity disabled:opacity-40"
          >
            {saving ? t("settings.savingProfile") : t("settings.saveProfile")}
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
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
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
        placeholder={placeholder}
        required={required}
        className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-serif text-[14px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
      />
    </div>
  );
}
