"use client";

/**
 * /auth/forgot
 *
 * Resets the password using channel-specific OTP. Backend endpoints:
 *   - /api/auth/forget-password        (phone)
 *   - /api/auth/forget-password-email  (email)
 *
 * On success, redirect to /auth/login so the user can sign in with the new
 * credential.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AuthTabs,
  TextField,
  SubmitButton,
  OtpField,
  FormError,
  type AuthMethod,
} from "@/components/auth/AuthForm";
import { SmsDisclosure } from "@/components/auth/SmsDisclosure";
import {
  forgetPassword,
  forgetPasswordEmail,
  sendSms,
  sendEmailOtp,
} from "@/lib/auth/service";
import { useTranslation } from "react-i18next";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [method, setMethod] = useState<AuthMethod>("phone");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const identifierValid = useMemo(
    () =>
      method === "phone"
        ? PHONE_RE.test(identifier)
        : EMAIL_RE.test(identifier),
    [method, identifier],
  );

  const handleSendCode = async () => {
    setError(null);
    try {
      if (method === "phone") await sendSms({ phone: identifier });
      else await sendEmailOtp({ email: identifier });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.sendFailed"));
      throw e;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifierValid) {
      setError(method === "phone" ? t("auth.invalidPhone") : t("auth.invalidEmail"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.newPasswordMin"));
      return;
    }
    if (code.length < 4) {
      setError(t("auth.enterOtp"));
      return;
    }

    try {
      setSubmitting(true);
      if (method === "phone") {
        await forgetPassword({ phone: identifier, password, code });
      } else {
        await forgetPasswordEmail({ email: identifier, password, code });
      }
      setSuccess(true);
      setTimeout(() => router.replace("/auth/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-serif text-[26px] tracking-tight">{t("auth.passwordResetSuccess")}</h1>
        <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("auth.redirectingToLogin")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] tracking-tight">{t("auth.resetPassword")}</h1>
        <p className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("auth.resetSubtitle")}
        </p>
      </div>

      <AuthTabs value={method} onChange={setMethod} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label={method === "phone" ? t("auth.phone") : t("auth.email")}
          type={method === "phone" ? "tel" : "email"}
          autoComplete={method === "phone" ? "tel" : "email"}
          placeholder={method === "phone" ? t("auth.phonePlaceholder") : "you@example.com"}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value.trim())}
        />

        <TextField
          label={t("auth.newPassword")}
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* SMS opt-in disclosure for Twilio toll-free verification (CTIA).
            Shown only when the phone channel is selected — otherwise no SMS
            is sent. */}
        {method === "phone" && <SmsDisclosure />}

        <OtpField
          value={code}
          onChange={setCode}
          onSend={handleSendCode}
          sendDisabled={!identifierValid}
        />

        <FormError message={error} />

        <SubmitButton loading={submitting}>{t("auth.resetPassword")}</SubmitButton>
      </form>

      <div className="border-t border-[var(--border)] pt-5 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("auth.rememberPassword")}{" "}
        <Link
          href="/auth/login"
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          {t("auth.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
