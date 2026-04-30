"use client";

/**
 * Auth-form primitives shared between login / register / forgot pages.
 *
 *  - AuthTabs:            two-way tab switcher (email / phone)
 *  - TextField:           labelled input with inline error
 *  - SubmitButton:        primary button with loading / disabled states
 *  - OtpField:            input + "send code" button with countdown
 *
 * Kept as a single file (instead of 4 mini-files) so auth pages stay lean.
 * None of these primitives depend on a specific form library — the parent
 * owns state via `react-hook-form`.
 */

import { useEffect, useState, forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode, ButtonHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

/* ----------------------------- AuthTabs ----------------------------- */

export type AuthMethod = "phone" | "email";

export function AuthTabs({
  value,
  onChange,
}: {
  value: AuthMethod;
  onChange: (v: AuthMethod) => void;
}) {
  const { t } = useTranslation();
  const opts: ReadonlyArray<{ id: AuthMethod; label: string }> = [
    { id: "phone", label: t("auth.phone") },
    { id: "email", label: t("auth.email") },
  ];
  return (
    <div
      role="tablist"
      className="grid grid-cols-2 gap-1 rounded-md border border-[var(--border)] bg-[var(--canvas-soft)] p-1 font-label text-[13px]"
    >
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`rounded py-2 transition-colors duration-150 ${
              active
                ? "bg-[var(--canvas)] font-medium text-[var(--ink)] shadow-sm"
                : "text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------- TextField ---------------------------- */

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  right?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, error, right, className = "", ...rest }, ref) {
    return (
      <label className="block">
        {label && (
          <span className="mb-1.5 block font-label text-[12px] tracking-wide text-[color:var(--ink-muted)]">
            {label}
          </span>
        )}
        <div
          className={`flex items-center rounded-md border bg-[var(--canvas)] transition-colors ${
            error
              ? "border-red-500/70"
              : "border-[var(--border)] focus-within:border-[var(--ink)]"
          }`}
        >
          <input
            ref={ref}
            className={`w-full bg-transparent px-3 py-2.5 font-label text-[14px] text-[var(--ink)] placeholder:text-[color:var(--ink-muted)] focus:outline-none ${className}`}
            {...rest}
          />
          {right}
        </div>
        {error && (
          <span className="mt-1 block font-label text-[12px] text-red-500">
            {error}
          </span>
        )}
      </label>
    );
  },
);

/* --------------------------- SubmitButton --------------------------- */

export function SubmitButton({
  children,
  loading,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="submit"
      {...rest}
      disabled={loading || rest.disabled}
      className={`btn-primary w-full py-3 text-[14px] ${
        loading ? "cursor-not-allowed opacity-70" : ""
      } ${rest.className ?? ""}`}
    >
      {loading ? t("auth.processing") : children}
    </button>
  );
}

/* ------------------------------ OtpField ------------------------------ */

export function OtpField({
  label,
  error,
  value,
  onChange,
  onSend,
  disabled,
  sendDisabled,
}: {
  label?: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  onSend: () => Promise<void> | void;
  disabled?: boolean;
  /** Disable the "send code" button even when not counting down (e.g. phone invalid) */
  sendDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const displayLabel = label ?? t("auth.otp");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleSend = async () => {
    if (countdown > 0 || sending) return;
    try {
      setSending(true);
      await onSend();
      setCountdown(60);
    } catch {
      /* upstream shows toast */
    } finally {
      setSending(false);
    }
  };

  const btnLabel =
    sending ? t("auth.sending") : countdown > 0 ? t("auth.resendAfter", { seconds: countdown }) : t("auth.sendCode");

  return (
    <TextField
      label={displayLabel}
      error={error}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder={t("auth.otpPlaceholder")}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
      disabled={disabled}
      right={
        <button
          type="button"
          onClick={handleSend}
          disabled={countdown > 0 || sending || sendDisabled}
          className="mr-2 whitespace-nowrap rounded px-3 py-1.5 font-label text-[12px] text-[var(--ink)] transition-colors hover:bg-[var(--canvas-raised)] disabled:cursor-not-allowed disabled:text-[color:var(--ink-muted)] disabled:hover:bg-transparent"
        >
          {btnLabel}
        </button>
      }
    />
  );
}

/* ------------------------------ Misc ------------------------------ */

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 font-label text-[12px] text-red-600 dark:text-red-400"
    >
      {message}
    </div>
  );
}
