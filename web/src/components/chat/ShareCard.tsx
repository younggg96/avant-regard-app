"use client";

/**
 * Chat share-card renderer.
 *
 * When a DM message is one of `post_card / store_card / brand_card / show_card
 * / user_card`, its `content` is a JSON payload (see
 * `web/src/lib/chatShareCards.ts`). This component renders that payload as a
 * clickable preview card matching the mobile `MessageBubble` design language:
 *
 *   ┌──────────────────────────┐
 *   │      cover image         │   ← 140px, optional
 *   ├──────────────────────────┤
 *   │  Title                   │
 *   │  subtitle / meta         │
 *   │  ────────────────        │
 *   │  icon · 类型        查看 →│
 *   └──────────────────────────┘
 *
 * The whole card is a `next/link` that deep-links into the matching web
 * detail route (`/posts/[id]`, `/stores/[id]`, `/archive/brands/[id]`,
 * `/archive/shows/[id]`, `/users/[id]`). All user-supplied image URLs go
 * through `isRenderableImage` because mobile drafts can carry `file://` URIs.
 */

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  FileText,
  MapPin,
  Sparkles,
  Store,
  Tag,
  User,
} from "lucide-react";
import type {
  ParsedShareCard,
  PostSharePayload,
  StoreSharePayload,
  BrandSharePayload,
  ShowSharePayload,
  UserSharePayload,
} from "@/lib/chatShareCards";
import { isRenderableImage } from "@/lib/isRenderableImage";

interface ShareCardProps {
  card: ParsedShareCard;
  /** `true` for messages sent by the signed-in user (dark bubble). */
  isMine: boolean;
}

export function ShareCard({ card, isMine }: ShareCardProps) {
  switch (card.kind) {
    case "post":
      return <PostCard payload={card.payload} isMine={isMine} />;
    case "store":
      return <StoreCard payload={card.payload} isMine={isMine} />;
    case "brand":
      return <BrandCard payload={card.payload} isMine={isMine} />;
    case "show":
      return <ShowCard payload={card.payload} isMine={isMine} />;
    case "user":
      return <UserCard payload={card.payload} isMine={isMine} />;
  }
}

// ---------------------------------------------------------------------------
// Shared card chrome
// ---------------------------------------------------------------------------

/**
 * Colour tokens driven by `isMine`. Kept in one place so all five cards stay
 * pixel-aligned with the mobile design (black bubble for me / white w/ border
 * for the other side).
 */
function cardSkin(isMine: boolean) {
  return isMine
    ? {
        frame:
          "bg-black text-white border border-black dark:bg-white dark:text-black dark:border-white",
        body: "",
        title: "text-white dark:text-black",
        muted: "text-white/60 dark:text-black/55",
        sub: "text-white/45 dark:text-black/40",
        placeholderBg: "bg-white/10 dark:bg-black/10",
        placeholderText: "text-white/40 dark:text-black/40",
        tagBg: "bg-white/15 dark:bg-black/15",
        tagText: "text-white/75 dark:text-black/70",
      }
    : {
        frame:
          "bg-[var(--canvas)] text-[var(--ink)] border border-[var(--border)]",
        body: "",
        title: "text-black dark:text-white",
        muted: "text-[color:var(--ink-muted)]",
        sub: "text-[color:var(--ink-muted)]",
        placeholderBg: "bg-[var(--canvas-raised)]",
        placeholderText: "text-[color:var(--ink-muted)]",
        tagBg: "bg-[var(--canvas-raised)]",
        tagText: "text-[color:var(--ink-muted)]",
      };
}

interface CardShellProps {
  href: string;
  isMine: boolean;
  children: React.ReactNode;
}

function CardShell({ href, isMine, children }: CardShellProps) {
  const skin = cardSkin(isMine);
  return (
    <Link
      href={href}
      className={`block w-[240px] overflow-hidden rounded-xl transition-opacity hover:opacity-90 ${skin.frame}`}
    >
      {children}
    </Link>
  );
}

interface CardFooterProps {
  icon: React.ReactNode;
  label: string;
  isMine: boolean;
}

function CardFooter({ icon, label, isMine }: CardFooterProps) {
  const { t } = useTranslation();
  const skin = cardSkin(isMine);
  return (
    <div className={`mt-2 flex items-center justify-between ${skin.muted}`}>
      <div className="flex min-w-0 items-center gap-1.5 font-label text-[11px] uppercase tracking-widest">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 font-label text-[11px]">
        <span>{t("chat.view")}</span>
        <ChevronRight size={12} strokeWidth={1.75} />
      </div>
    </div>
  );
}

interface CoverImageProps {
  src?: string;
  alt: string;
  isMine: boolean;
  fallback?: React.ReactNode;
}

function CoverImage({ src, alt, isMine, fallback }: CoverImageProps) {
  const skin = cardSkin(isMine);
  if (isRenderableImage(src)) {
    return (
      <div className={`relative h-[140px] w-full ${skin.placeholderBg}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="240px"
          className="object-cover"
        />
      </div>
    );
  }
  if (fallback) {
    return (
      <div
        className={`flex h-[140px] w-full items-center justify-center ${skin.placeholderBg} ${skin.placeholderText}`}
      >
        {fallback}
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

function PostCard({
  payload,
  isMine,
}: {
  payload: PostSharePayload;
  isMine: boolean;
}) {
  const { t } = useTranslation();
  const skin = cardSkin(isMine);
  return (
    <CardShell href={`/posts/${payload.postId}`} isMine={isMine}>
      <CoverImage src={payload.imageUrl} alt={payload.title || t("post.sharePost")} isMine={isMine} />
      <div className="px-3 py-2.5">
        <div className={`line-clamp-2 font-serif text-[14px] leading-snug ${skin.title}`}>
          {payload.title || t("post.postShare")}
        </div>
        <div className={`mt-1 flex items-center gap-1.5 truncate font-label text-[11px] ${skin.sub}`}>
          <span className={`relative inline-block h-4 w-4 shrink-0 overflow-hidden rounded-full ${skin.placeholderBg}`}>
            {isRenderableImage(payload.authorAvatar) && (
              <Image
                src={payload.authorAvatar}
                alt={payload.authorName}
                fill
                sizes="16px"
                className="object-cover"
              />
            )}
          </span>
          <span className="truncate">@{payload.authorName}</span>
        </div>
        <CardFooter
          icon={<FileText size={12} strokeWidth={1.75} />}
          label={t("chat.sharePost")}
          isMine={isMine}
        />
      </div>
    </CardShell>
  );
}

function StoreCard({
  payload,
  isMine,
}: {
  payload: StoreSharePayload;
  isMine: boolean;
}) {
  const { t } = useTranslation();
  const skin = cardSkin(isMine);
  const location = [payload.city, payload.country].filter(Boolean).join(", ");
  const hasRating = typeof payload.rating === "number" && payload.rating > 0;
  return (
    <CardShell href={`/stores/${payload.storeId}`} isMine={isMine}>
      <CoverImage
        src={payload.imageUrl}
        alt={payload.name}
        isMine={isMine}
        fallback={<Store size={32} strokeWidth={1.5} />}
      />
      <div className="px-3 py-2.5">
        <div className={`line-clamp-2 font-serif text-[14px] leading-snug ${skin.title}`}>
          {payload.name}
        </div>
        <div className={`mt-1 flex items-center justify-between gap-2 font-label text-[11px] ${skin.muted}`}>
          {location && (
            <span className="flex min-w-0 items-center gap-1 truncate">
              <MapPin size={11} strokeWidth={1.75} />
              <span className="truncate">{location}</span>
            </span>
          )}
          {hasRating && (
            <span className="shrink-0">
              ★ {payload.rating!.toFixed(1)}
            </span>
          )}
        </div>
        {payload.styles && payload.styles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {payload.styles.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`rounded px-1.5 py-0.5 font-label text-[10px] ${skin.tagBg} ${skin.tagText}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <CardFooter
          icon={<Store size={12} strokeWidth={1.75} />}
          label={t("chat.shareStore")}
          isMine={isMine}
        />
      </div>
    </CardShell>
  );
}

function BrandCard({
  payload,
  isMine,
}: {
  payload: BrandSharePayload;
  isMine: boolean;
}) {
  const { t } = useTranslation();
  const skin = cardSkin(isMine);
  const infoParts = [payload.country, payload.category].filter(Boolean);
  const initial = payload.name?.charAt(0).toUpperCase() || "·";
  return (
    <CardShell href={`/archive/brands/${payload.brandId}`} isMine={isMine}>
      <CoverImage
        src={payload.imageUrl}
        alt={payload.name}
        isMine={isMine}
        fallback={
          <span className="font-serif text-5xl font-light tracking-wider">
            {initial}
          </span>
        }
      />
      <div className="px-3 py-2.5">
        <div className={`line-clamp-2 font-serif text-[14px] leading-snug ${skin.title}`}>
          {payload.name}
        </div>
        {infoParts.length > 0 && (
          <div className={`mt-0.5 truncate font-label text-[11px] ${skin.muted}`}>
            {infoParts.join(" · ")}
          </div>
        )}
        {payload.founder && (
          <div className={`mt-0.5 truncate font-serif text-[11px] italic ${skin.sub}`}>
            {payload.founder}
          </div>
        )}
        <CardFooter
          icon={<Tag size={12} strokeWidth={1.75} />}
          label={t("chat.shareBrand")}
          isMine={isMine}
        />
      </div>
    </CardShell>
  );
}

function ShowCard({
  payload,
  isMine,
}: {
  payload: ShowSharePayload;
  isMine: boolean;
}) {
  const { t } = useTranslation();
  const skin = cardSkin(isMine);
  const seasonLine = [payload.season, payload.year].filter(Boolean).join(" ");
  const metaParts = [payload.designer, payload.category].filter(Boolean);
  const heading = payload.brandName
    ? `${payload.brandName} · ${payload.title}`
    : payload.title;
  return (
    <CardShell href={`/archive/shows/${payload.showId}`} isMine={isMine}>
      <CoverImage
        src={payload.imageUrl}
        alt={payload.title}
        isMine={isMine}
        fallback={<Sparkles size={32} strokeWidth={1.5} />}
      />
      <div className="px-3 py-2.5">
        <div className={`line-clamp-2 font-serif text-[14px] leading-snug ${skin.title}`}>
          {heading}
        </div>
        {seasonLine && (
          <div className={`mt-0.5 truncate font-label text-[11px] ${skin.muted}`}>
            {seasonLine}
          </div>
        )}
        {metaParts.length > 0 && (
          <div className={`mt-0.5 truncate font-serif text-[11px] italic ${skin.sub}`}>
            {metaParts.join(" · ")}
          </div>
        )}
        <CardFooter
          icon={<Sparkles size={12} strokeWidth={1.75} />}
          label={t("chat.shareShow")}
          isMine={isMine}
        />
      </div>
    </CardShell>
  );
}

function UserCard({
  payload,
  isMine,
}: {
  payload: UserSharePayload;
  isMine: boolean;
}) {
  const { t } = useTranslation();
  const skin = cardSkin(isMine);
  const metaParts = [payload.primaryTitle, payload.location].filter(Boolean);
  return (
    <CardShell href={`/users/${payload.userId}`} isMine={isMine}>
      <div className="flex items-center gap-3 px-3 pt-3">
        <div className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full ${skin.placeholderBg}`}>
          {isRenderableImage(payload.avatarUrl) ? (
            <Image
              src={payload.avatarUrl}
              alt={payload.username}
              fill
              sizes="52px"
              className="object-cover"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center font-serif text-lg ${skin.placeholderText}`}
            >
              {payload.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate font-serif text-[14px] leading-snug ${skin.title}`}>
            @{payload.username}
          </div>
          {metaParts.length > 0 && (
            <div className={`truncate font-label text-[11px] ${skin.muted}`}>
              {metaParts.join(" · ")}
            </div>
          )}
          {payload.bio && (
            <div className={`mt-0.5 line-clamp-2 font-serif text-[11px] leading-snug ${skin.sub}`}>
              {payload.bio}
            </div>
          )}
        </div>
      </div>
      <div className="px-3 pb-2.5 pt-2">
        <CardFooter
          icon={<User size={12} strokeWidth={1.75} />}
          label={t("chat.shareUser")}
          isMine={isMine}
        />
      </div>
    </CardShell>
  );
}
