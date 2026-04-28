"use client";

/**
 * /me/chats/[id] — conversation detail.
 *
 * Plain REST polling (3s) is used instead of the mobile app's WebSocket path
 * so the web port stays simple and works behind restrictive corporate proxies.
 * Trade-off: higher latency for new messages, but no WS infra to maintain.
 * Can be upgraded later by mirroring frontend/src/services/chatService.ts's
 * `ChatWebSocket`.
 *
 * Send is optimistic: we append a temporary local message with `id=-1` and
 * let the next poll reconcile. On send failure we roll back + surface a toast.
 */

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useAuthStore } from "@/lib/auth/store";
import { chatService, type Message } from "@/lib/services/chat";
import { isRenderableImage } from "@/lib/isRenderableImage";
import { parseSharePayload } from "@/lib/chatShareCards";
import { ShareCard } from "@/components/chat/ShareCard";

export default function ChatDetailPage() {
  const params = useParams<{ id: string }>();
  const conversationId = Number(params?.id);
  const me = useAuthStore((s) => s.user);

  const swrKey = useMemo(
    () => (conversationId ? ["chat-messages", conversationId] : null),
    [conversationId],
  );

  const { data: messages = [], error } = useSWR<Message[]>(
    swrKey,
    () => chatService.getMessages(conversationId, 100),
    { refreshInterval: 3_000 },
  );

  useEffect(() => {
    if (!conversationId) return;
    chatService.markRead(conversationId).catch(() => {});
    mutate(["chat-conversations"]);
  }, [conversationId]);

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const onSend = async () => {
    const content = input.trim();
    if (!content || sending || !conversationId) return;
    setInput("");
    setSending(true);
    setSendError(null);

    const optimistic: Message = {
      id: -Date.now(),
      conversationId,
      senderId: me?.userId ?? 0,
      senderName: me?.username ?? "我",
      senderAvatar: me?.avatar ?? null,
      content,
      messageType: "text",
      createdAt: new Date().toISOString(),
      isDeleted: false,
      isMine: true,
    };

    mutate<Message[]>(
      swrKey,
      (current) => [...(current ?? []), optimistic],
      { revalidate: false },
    );

    try {
      await chatService.sendMessage(conversationId, content);
      mutate(swrKey);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "发送失败");
      mutate<Message[]>(
        swrKey,
        (current) => (current ?? []).filter((m) => m.id !== optimistic.id),
        { revalidate: false },
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex min-w-0 flex-col" style={{ height: "calc(100vh - 11rem)" }}>
      <header className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <Link
          href="/me/chats"
          className="font-label text-[13px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← 全部会话
        </Link>
        <div className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          会话 #{conversationId || "?"}
        </div>
      </header>

      {error && (
        <div className="mb-3 rounded border border-red-500/20 bg-red-500/5 p-3 font-serif text-sm text-red-600 dark:text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
      >
        {messages.length === 0 && !error && (
          <div className="flex h-full items-center justify-center font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            开始对话吧
          </div>
        )}

        {messages.map((m) => {
          // Share cards (post/store/brand/show/user) store a JSON payload in
          // `content` — render them as clickable preview cards instead of raw
          // JSON. Falls back to the plain-text bubble when parsing fails so a
          // corrupt payload still shows *something*.
          const shareCard = m.isDeleted
            ? null
            : parseSharePayload(m.messageType, m.content);

          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${m.isMine ? "flex-row-reverse" : ""}`}
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
                {isRenderableImage(m.senderAvatar) && (
                  <Image
                    src={m.senderAvatar}
                    alt={m.senderName}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                )}
              </div>

              {shareCard ? (
                <ShareCard card={shareCard} isMine={m.isMine} />
              ) : (
                <div
                  className={`max-w-[68%] rounded px-3 py-2 font-serif text-[14px] leading-snug ${
                    m.isMine
                      ? "bg-[var(--ink)] text-[var(--canvas)]"
                      : "bg-[var(--canvas)] text-[var(--ink)] border border-[var(--border)]"
                  }`}
                >
                  {m.isDeleted ? (
                    <span className="italic opacity-60">（消息已删除）</span>
                  ) : (
                    m.content
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sendError && (
        <div className="mt-2 font-label text-[12px] text-red-600 dark:text-red-400">
          {sendError}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder="输入消息… (Enter 发送 / Shift+Enter 换行)"
          className="flex-1 resize-none rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-serif text-[14px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="rounded bg-[var(--ink)] px-5 py-2 font-label text-[13px] text-[var(--canvas)] transition-opacity disabled:opacity-40"
        >
          {sending ? "发送中…" : "发送"}
        </button>
      </form>
    </section>
  );
}
