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

import { useMemo, useState } from "react";
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

type Credential = "password" | "otp";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
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
      setError(e instanceof Error ? e.message : "发送失败");
      throw e;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifierValid) {
      setError(method === "phone" ? "请输入 11 位手机号" : "邮箱格式不正确");
      return;
    }
    if (credential === "password" && password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (credential === "otp" && code.length < 4) {
      setError("请输入验证码");
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
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] tracking-tight">欢迎回来</h1>
        <p className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          登录以点赞、收藏、关注并参与评论。
        </p>
      </div>

      <AuthTabs value={method} onChange={setMethod} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label={method === "phone" ? "手机号" : "邮箱"}
          type={method === "phone" ? "tel" : "email"}
          autoComplete={method === "phone" ? "tel" : "email"}
          placeholder={method === "phone" ? "11 位手机号" : "you@example.com"}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value.trim())}
        />

        {credential === "password" ? (
          <TextField
            label="密码"
            type="password"
            autoComplete="current-password"
            placeholder="至少 6 位"
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

        <SubmitButton loading={submitting}>登录</SubmitButton>

        <div className="flex items-center justify-between font-label text-[12px]">
          <button
            type="button"
            onClick={() =>
              setCredential((c) => (c === "password" ? "otp" : "password"))
            }
            className="link-muted"
          >
            {credential === "password" ? "改用验证码登录" : "改用密码登录"}
          </button>
          <Link href="/auth/forgot" className="link-muted">
            忘记密码？
          </Link>
        </div>
      </form>

      <div className="border-t border-[var(--border)] pt-5 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
        还没有账号？{" "}
        <Link
          href={`/auth/register${nextPath !== "/discover" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          创建账号
        </Link>
      </div>
    </div>
  );
}
