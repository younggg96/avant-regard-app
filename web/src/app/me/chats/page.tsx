"use client";

/**
 * /me/chats — DM conversation list.
 *
 * Data is fetched client-side via SWR with a 15s refreshInterval so unread
 * counts update without a full page refresh. Rows link into
 * `/me/chats/[id]`; the detail page is where sending and markRead happens.
 */

import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { chatService, type Conversation } from "@/lib/services/chat";
import { isRenderableImage } from "@/lib/isRenderableImage";
import { summarizeSharePayload } from "@/lib/chatShareCards";

export default function ChatsPage() {
  const { data, isLoading, error } = useSWR<Conversation[]>(
    ["chat-conversations"],
    () => chatService.getConversations(),
    { refreshInterval: 15_000 },
  );

  return (
    <section className="min-w-0">
      <header className="mb-6 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          私信
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          与其他 Avant Regard 用户的一对一对话。
        </p>
      </header>

      {isLoading && (
        <div className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          加载中…
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-4 font-serif text-sm text-red-600 dark:text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
          还没有任何会话。访问某位用户主页，点「私信」即可开始聊天。
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)] bg-[var(--canvas)]">
          {data.map((conv) => {
            const other = conv.otherUser;
            const time = conv.lastMessageAt
              ? new Date(conv.lastMessageAt).toLocaleString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  month: "numeric",
                  day: "numeric",
                })
              : "";

            return (
              <li key={conv.id}>
                <Link
                  href={`/me/chats/${conv.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--canvas-raised)]"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
                    {other && isRenderableImage(other.avatarUrl) && (
                      <Image
                        src={other.avatarUrl}
                        alt={other.username}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-serif text-[15px] text-black dark:text-white">
                        {other?.username ?? `会话 #${conv.id}`}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 font-label text-[10px] text-[var(--canvas)]">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.lastMessageText && (
                      <div className="truncate font-label text-[12px] text-[color:var(--ink-muted)]">
                        {summarizeSharePayload(null, conv.lastMessageText)}
                      </div>
                    )}
                  </div>

                  {time && (
                    <span className="shrink-0 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                      {time}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
