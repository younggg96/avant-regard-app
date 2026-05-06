"use client";

/**
 * 店铺详情抽屉。点击地图标记 / 底部卡片后弹出，显示：
 *   - 店名 / 国家 / 城市
 *   - 营业状态 + 营业时间
 *   - 地址（跳转 Google Maps 导航）
 *   - 联系电话（移动端自动拨号，桌面显示）
 *   - 风格 / 品牌标签
 *   - 收藏按钮（需要登录）
 *   - "查看详情" 跳转 `/stores/{id}` 独立页
 *
 * 对齐 iOS BuyerMapScreen 的 Store Detail Bottom Sheet，但在 web 上用侧抽屉
 * 更符合桌面浏览习惯（右侧 440px 面板）。
 */

import Link from "next/link";
import type { BuyerStore } from "@/lib/api";

export interface StoreDetailSheetProps {
  store: BuyerStore | null;
  onClose: () => void;
  isFavorited: boolean;
  favoriteCount: number;
  onToggleFavorite: () => void;
  isLoggedIn: boolean;
}

export function StoreDetailSheet({
  store,
  onClose,
  isFavorited,
  favoriteCount,
  onToggleFavorite,
  isLoggedIn,
}: StoreDetailSheetProps) {
  const open = store != null;
  const mapsUrl = store?.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${store.coordinates.latitude},${store.coordinates.longitude}`
    : store?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`
      : null;

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[55] transition-opacity duration-300 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="关闭详情"
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)] shadow-2xl transition-transform duration-300 ease-out md:max-w-[440px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {store && (
          <>
            <header className="border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-serif text-2xl text-[var(--ink)]">
                    {store.name}
                  </h2>
                  <p className="mt-1 font-label text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
                    {[store.country, store.city].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-label text-[13px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  关闭
                </button>
              </div>

              <div className="mt-3 flex items-center justify-end gap-3">
                <div className="flex items-center gap-3">
                  {favoriteCount > 0 && (
                    <span className="font-label text-[11px] text-[color:var(--ink-muted)]">
                      {favoriteCount} 人已关注
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    disabled={!isLoggedIn}
                    title={isLoggedIn ? undefined : "登录后可关注"}
                    className={`rounded border px-3 py-1 font-label text-[12px] transition-colors ${
                      isFavorited
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-black bg-white text-black dark:border-white dark:bg-transparent dark:text-white"
                    } ${isLoggedIn ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-60"}`}
                  >
                    {isFavorited ? "已关注" : "关注"}
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {store.hours && (
                <InfoBlock label="营业时间">
                  <p className="whitespace-pre-line font-serif text-[14px] leading-relaxed text-[var(--ink)]">
                    {store.hours}
                  </p>
                </InfoBlock>
              )}

              {store.address && (
                <InfoBlock label="地址">
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif text-[14px] text-[var(--ink)] underline-offset-4 hover:underline"
                    >
                      {store.address} →
                    </a>
                  ) : (
                    <p className="font-serif text-[14px] text-[var(--ink)]">
                      {store.address}
                    </p>
                  )}
                </InfoBlock>
              )}

              {store.phone && store.phone.length > 0 && (
                <InfoBlock label="联系电话">
                  <ul className="flex flex-col gap-1">
                    {store.phone.map((p) => (
                      <li key={p}>
                        <a
                          href={`tel:${p.replace(/[^0-9+]/g, "")}`}
                          className="font-serif text-[14px] text-[var(--ink)] underline-offset-4 hover:underline"
                        >
                          {p}
                        </a>
                      </li>
                    ))}
                  </ul>
                </InfoBlock>
              )}

              {store.description && (
                <InfoBlock label="简介">
                  <p className="whitespace-pre-line font-serif text-[14px] leading-relaxed text-[var(--ink)]">
                    {store.description}
                  </p>
                </InfoBlock>
              )}

              {store.style.length > 0 && (
                <InfoBlock label="店铺风格">
                  <div className="flex flex-wrap gap-2">
                    {store.style.map((s) => (
                      <span
                        key={s}
                        className="rounded bg-black px-2.5 py-1 font-label text-[11px] text-white dark:bg-white dark:text-black"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </InfoBlock>
              )}

              {store.brands.length > 0 && (
                <InfoBlock label="主营品牌">
                  <div className="flex flex-wrap gap-2">
                    {store.brands.map((b) => (
                      <span
                        key={b}
                        className="rounded border border-[var(--border)] bg-[var(--canvas-raised)] px-2.5 py-1 font-label text-[11px] text-[var(--ink)]"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </InfoBlock>
              )}
            </div>

            <footer className="flex gap-2 border-t border-[var(--border)] bg-[var(--canvas)] p-4">
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded border border-[var(--border)] py-3 text-center font-label text-sm text-[var(--ink)] transition-colors hover:bg-[var(--canvas-raised)]"
                >
                  导航
                </a>
              ) : (
                <span className="flex-1 rounded border border-[var(--border)] bg-[var(--canvas-raised)] py-3 text-center font-label text-sm text-[color:var(--ink-muted)]">
                  暂无地址
                </span>
              )}
              <Link
                href={`/stores/${encodeURIComponent(store.id)}`}
                className="flex-[2] rounded bg-black py-3 text-center font-label text-sm font-semibold text-white transition-colors hover:bg-[#222] dark:bg-white dark:text-black dark:hover:bg-[#e0e0e0]"
              >
                查看详情 →
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 font-label text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
        {label}
      </h3>
      {children}
    </section>
  );
}
