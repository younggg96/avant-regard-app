"use client";

/**
 * /auth/register
 *
 * Dual-channel registration. Backend creates the account atomically so we
 * immediately get a LoginResponse — no separate login round-trip needed.
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
  register as registerPhone,
  registerEmail,
  sendSms,
  sendEmailOtp,
} from "@/lib/auth/service";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
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
    if (username.trim().length < 2) {
      setError("用户名至少 2 个字符");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (code.length < 4) {
      setError("请输入验证码");
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
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] tracking-tight">创建账号</h1>
        <p className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          加入 Avant Regard，开始你的时装档案之旅。
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
          label="用户名"
          autoComplete="username"
          placeholder="昵称（之后可修改）"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={30}
        />

        <TextField
          label="密码"
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

        <SubmitButton loading={submitting}>创建账号</SubmitButton>

        <p className="font-label text-[11px] leading-relaxed text-[color:var(--ink-muted)]">
          注册即表示同意 Avant Regard 的服务条款与隐私政策。
        </p>
      </form>

      <div className="border-t border-[var(--border)] pt-5 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
        已有账号？{" "}
        <Link
          href={`/auth/login${nextPath !== "/discover" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          直接登录
        </Link>
      </div>
    </div>
  );
}
