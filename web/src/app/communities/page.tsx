import type { Metadata } from "next";
import Link from "next/link";
import { FadeImage } from "@/components/FadeImage";
import { ApiError, getCommunities } from "@/lib/api";
import { formatCount } from "@/lib/format";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "论坛 · Avant Regard",
  description:
    "浏览 Avant Regard 的官方社区：时装、生活方式、美学与文化。",
  alternates: { canonical: "/communities" },
};

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "综合",
  FASHION: "时装",
  LIFESTYLE: "生活",
  BEAUTY: "美学",
  CULTURE: "文化",
};

export default async function CommunitiesPage() {
  try {
    const data = await getCommunities();
    const communities = data.all.filter((c) => c.isActive);

    return (
      <section className="mx-auto max-w-content px-6 py-12 md:py-16">
        <header className="mb-12">
          <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
            论坛
          </h1>
          <p className="mt-3 max-w-xl font-serif text-[15px] leading-relaxed text-black/60 dark:text-white/50">
            话题社区，按主题聚合讨论与发现。
          </p>
        </header>

        {data.popular.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
              Popular
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.popular.slice(0, 6).map((c) => (
                <CommunityHeroCard key={c.id} c={c} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-5 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            All Communities
          </h2>
          <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
            {communities.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/communities/${c.slug}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--canvas-raised)]"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--canvas-raised)]">
                    {c.iconUrl && (
                      <FadeImage
                        src={c.iconUrl}
                        alt={c.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-serif text-[16px] text-black dark:text-white">
                        {c.name}
                      </h3>
                      {c.isOfficial && (
                        <span className="chip">Official</span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 font-label text-[12px] text-[color:var(--ink-muted)]">
                      {c.description || CATEGORY_LABEL[c.category] || ""}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)] md:block">
                    <div>{formatCount(c.memberCount)} 成员</div>
                    <div>{formatCount(c.postCount)} 帖子</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </section>
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return (
        <EmptyState
          message={`加载失败 (${err.status})。${err.message}`}
        />
      );
    }
    throw err;
  }
}

function CommunityHeroCard({
  c,
}: {
  c: Awaited<ReturnType<typeof getCommunities>>["popular"][number];
}) {
  return (
    <Link
      href={`/communities/${c.slug}`}
      className="group relative block overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-soft)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--canvas-raised)]">
        {c.coverUrl && (
          <FadeImage
            src={c.coverUrl}
            alt={c.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-[17px] text-black dark:text-white">
          {c.name}
        </h3>
        <p className="mt-1 line-clamp-2 font-label text-[12px] text-[color:var(--ink-muted)]">
          {c.description || "—"}
        </p>
        <div className="mt-3 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {formatCount(c.memberCount)} 成员 · {formatCount(c.postCount)} 帖子
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-content px-6 py-24 text-center">
      <p className="font-serif text-[15px] text-[color:var(--ink-muted)]">
        {message}
      </p>
    </div>
  );
}
