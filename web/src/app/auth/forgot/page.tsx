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
import {
  forgetPassword,
  forgetPasswordEmail,
  sendSms,
  sendEmailOtp,
} from "@/lib/auth/service";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPage() {
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
    if (password.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (code.length < 4) {
      setError("请输入验证码");
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
      setError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-serif text-[26px] tracking-tight">密码已重置</h1>
        <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
          即将跳转到登录页…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] tracking-tight">重置密码</h1>
        <p className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          输入账号并通过验证码设置新密码。
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

        <TextField
          label="新密码"
          type="password"
          autoComplete="new-password"
          placeholder="至少 6 位"
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

        <SubmitButton loading={submitting}>重置密码</SubmitButton>
      </form>

      <div className="border-t border-[var(--border)] pt-5 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
        想起密码了？{" "}
        <Link
          href="/auth/login"
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          返回登录
        </Link>
      </div>
    </div>
  );
}
