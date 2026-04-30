"use client";

/**
 * /auth/login
 *
 * Supports 4 login modes via two dimensions:
 *   - Channel:  phone (SMS) vs email
 *   - Credential: password vs OTP
 *
 * On success, the auth store persists tokens + user into localStorage and
 * the page redirects to `?next=...` (defaults to `/discover`).
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
  loginWithPassword,
  loginSms,
  loginEmail,
  loginEmailOtp,
  sendSms,
  sendEmailOtp,
} from "@/lib/auth/service";
import { useTranslation } from "react-i18next";

type Credential = "password" | "otp";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `useSearchParams()` must be wrapped in <Suspense> to avoid Next.js' CSR
// bailout during prerender. Keeping the form in an inner component lets the
// default export stay a thin Suspense wrapper.
function LoginPageInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/discover";
  const loginWithResponse = useAuthStore((s) => s.loginWithResponse);

  const [method, setMethod] = useState<AuthMethod>("phone");
  const [credential, setCredential] = useState<Credential>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identifierValid = useMemo(() => {
    if (method === "phone") return PHONE_RE.test(identifier);
    return EMAIL_RE.test(identifier);
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
    if (credential === "password" && password.length < 6) {
      setError(t("auth.passwordMin"));
      return;
    }
    if (credential === "otp" && code.length < 4) {
      setError(t("auth.enterOtp"));
      return;
    }

    try {
      setSubmitting(true);
      let response;
      if (method === "phone" && credential === "password") {
        response = await loginWithPassword({ phone: identifier, password });
      } else if (method === "phone" && credential === "otp") {
        response = await loginSms({ phone: identifier, code });
      } else if (method === "email" && credential === "password") {
        response = await loginEmail({ email: identifier, password });
      } else {
        response = await loginEmailOtp({ email: identifier, code });
      }

      loginWithResponse(response);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] tracking-tight">{t("auth.welcomeBack")}</h1>
        <p className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("auth.loginSubtitle")}
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

        {credential === "password" ? (
          <TextField
            label={t("auth.password")}
            type="password"
            autoComplete="current-password"
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : (
          <OtpField
            value={code}
            onChange={setCode}
            onSend={handleSendCode}
            sendDisabled={!identifierValid}
          />
        )}

        <FormError message={error} />

        <SubmitButton loading={submitting}>{t("auth.login")}</SubmitButton>

        <div className="flex items-center justify-between font-label text-[12px]">
          <button
            type="button"
            onClick={() =>
              setCredential((c) => (c === "password" ? "otp" : "password"))
            }
            className="link-muted"
          >
            {credential === "password" ? t("auth.switchToOtp") : t("auth.switchToPassword")}
          </button>
          <Link href="/auth/forgot" className="link-muted">
            {t("auth.forgotPassword")}
          </Link>
        </div>
      </form>

      <div className="border-t border-[var(--border)] pt-5 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("auth.noAccount")}{" "}
        <Link
          href={`/auth/register${nextPath !== "/discover" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          {t("auth.createAccount")}
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
