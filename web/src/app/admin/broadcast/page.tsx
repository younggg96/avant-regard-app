"use client";

import { useState } from "react";
import { broadcastApi, type BroadcastResult } from "@/lib/services/admin";
import {
  PageHeader,
  FormField,
  TextInput,
  Button,
} from "@/components/admin/ui";


type LinkMode = "none" | "page" | "external";

export default function BroadcastPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkMode, setLinkMode] = useState<LinkMode>("none");
  const [navigateTo, setNavigateTo] = useState("");
  const [navigateParams, setNavigateParams] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      const actionData: Record<string, unknown> = {};
      if (linkMode === "page" && navigateTo) {
        actionData.navigateTo = navigateTo;
        if (navigateParams.trim()) {
          try { actionData.navigateParams = JSON.parse(navigateParams); } catch { /* skip */ }
        }
      } else if (linkMode === "external" && externalUrl) {
        actionData.externalUrl = externalUrl;
      }

      const res = await broadcastApi.send({
        title: title.trim(),
        message: message.trim(),
        actionData: Object.keys(actionData).length > 0 ? actionData : undefined,
      });
      setResult(res);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setTitle("");
    setMessage("");
    setLinkMode("none");
    setNavigateTo("");
    setNavigateParams("");
    setExternalUrl("");
    setResult(null);
  };

  return (
    <div>
      <PageHeader title="广播通知" description="向所有用户发送推送通知" />

      {result ? (
        <div className="mx-auto max-w-md rounded-lg border border-[var(--border)] p-6 text-center">
          <div className="mx-auto text-[28px] text-[color:var(--ink-muted)]">✓</div>
          <h3 className="mt-3 font-label text-sm font-semibold">发送完成</h3>
          <div className="mt-2 space-y-1 font-label text-[13px] text-[color:var(--ink-muted)]">
            <div>成功: {result.successCount}</div>
            <div>失败: {result.failCount}</div>
            <div>目标用户: {result.totalUsers}</div>
          </div>
          <Button variant="secondary" onClick={reset} size="sm">
            再发一条
          </Button>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-4">
          <FormField label="通知标题" required>
            <TextInput value={title} onChange={setTitle} placeholder="输入通知标题" />
          </FormField>

          <FormField label="通知内容" required>
            <TextInput value={message} onChange={setMessage} placeholder="输入通知内容" multiline rows={4} />
          </FormField>

          <FormField label="跳转链接">
            <div className="flex gap-2 mb-2">
              {(["none", "page", "external"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setLinkMode(m)}
                  className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
                    linkMode === m
                      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                      : "border-[var(--border)] text-[color:var(--ink-muted)]"
                  }`}
                >
                  {m === "none" ? "无" : m === "page" ? "App 页面" : "外部链接"}
                </button>
              ))}
            </div>
            {linkMode === "page" && (
              <div className="space-y-2">
                <TextInput value={navigateTo} onChange={setNavigateTo} placeholder="页面名称 如 PostDetail" />
                <TextInput value={navigateParams} onChange={setNavigateParams} placeholder='参数 JSON 如 {"postId": 123}' />
              </div>
            )}
            {linkMode === "external" && (
              <TextInput value={externalUrl} onChange={setExternalUrl} placeholder="https://..." />
            )}
          </FormField>

          {(title || message) && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
              <div className="font-label text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)]">预览</div>
              <div className="mt-2 font-label">
                <div className="text-[14px] font-semibold">{title || "标题"}</div>
                <div className="mt-1 text-[13px] text-[color:var(--ink-muted)]">{message || "内容"}</div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button onClick={handleSend} loading={sending} disabled={!title.trim() || !message.trim()}>
              发送广播
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
