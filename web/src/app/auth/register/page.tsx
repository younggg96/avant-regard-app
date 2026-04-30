"use client";

/**
 * /auth/register
 *
 * Dual-channel registration. Backend creates the account atomically so we
 * immediately get a LoginResponse — no separate login round-trip needed.
 */

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AuthTabs,
  TextField,
  SubmitButton,
  OtpField,
  FormError,
  type AuthMethod,
} from "@/components/auth/AuthForm";
import { useAuthStore } from "@/lib/auth/store";
import {
  register as registerPhone,
  registerEmail,
  sendSms,
  sendEmailOtp,
} from "@/lib/auth/service";
import { useTranslation } from "react-i18next";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `useSearchParams()` needs to sit inside a <Suspense> boundary, otherwise the
// page fails to prerender at build time. Inner component holds the form.
function RegisterPageInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/discover";
  const loginWithResponse = useAuthStore((s) => s.loginWithResponse);

  const [method, setMethod] = useState<AuthMethod>("phone");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identifierValid = useMemo(() => {
    return method === "phone"
      ? PHONE_RE.test(identifier)
      : EMAIL_RE.test(identifier);
  }, [method, identifier]);

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
    if (username.trim().length < 2) {
      setError(t("auth.usernameMin"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordMin"));
      return;
    }
    if (code.length < 4) {
      setError(t("auth.enterOtp"));
      return;
    }

    try {
      setSubmitting(true);
      const response =
        method === "phone"
          ? await registerPhone({
              phone: identifier,
              username: username.trim(),
              password,
              code,
            })
          : await registerEmail({
              email: identifier,
              username: username.trim(),
              password,
              code,
            });

      loginWithResponse(response);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registerFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] tracking-tight">{t("auth.createAccount")}</h1>
        <p className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("auth.registerSubtitle")}
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
          label={t("auth.username")}
          autoComplete="username"
          placeholder={t("auth.usernamePlaceholder")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={30}
        />

        <TextField
          label={t("auth.password")}
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <OtpField
          value={code}
          onChange={setCode}
          onSend={handleSendCode}
          sendDisabled={!identifierValid}
        />

        <FormError message={error} />

        <SubmitButton loading={submitting}>{t("auth.createAccount")}</SubmitButton>

        <p className="font-label text-[11px] leading-relaxed text-[color:var(--ink-muted)]">
          {t("auth.termsNotice")}
        </p>
      </form>

      <div className="border-t border-[var(--border)] pt-5 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("auth.hasAccount")}{" "}
        <Link
          href={`/auth/login${nextPath !== "/discover" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          {t("auth.goLogin")}
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}
