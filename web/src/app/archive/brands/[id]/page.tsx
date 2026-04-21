import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FadeImage } from "@/components/FadeImage";
import { PostCard } from "@/components/PostCard";
import {
  ApiError,
  getBrandById,
  getBrandPosts,
  getShowsByBrand,
  type Show,
} from "@/lib/api";

export const revalidate = 300;

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const brand = await getBrandById(params.id);
    if (!brand) return { title: "品牌" };
    return {
      title: `${brand.name} · 品牌档案`,
      description:
        [brand.country, brand.category, brand.founder && `由 ${brand.founder} 创立`]
          .filter(Boolean)
          .join(" · ") || `${brand.name} 的秀场、单品与讨论。`,
      alternates: { canonical: `/archive/brands/${brand.id}` },
      openGraph: {
        title: brand.name,
        images: brand.coverImage ? [{ url: brand.coverImage }] : undefined,
      },
    };
  } catch {
    return { title: "品牌" };
  }
}

export default async function BrandDetailPage({ params }: PageProps) {
  try {
    const brand = await getBrandById(params.id);
    if (!brand) notFound();

    const [shows, posts] = await Promise.all([
      getShowsByBrand(brand.name).catch(() => [] as Show[]),
      getBrandPosts(brand.id).catch(() => []),
    ]);

    const cover = brand.coverImages?.[0] ?? brand.coverImage;

    return (
      <article className="mx-auto max-w-content px-6 py-12 md:py-16">
        <nav className="mb-10 font-label text-sm">
          <Link href="/archive/brands" className="link-muted">
            ← 所有品牌
          </Link>
        </nav>

        <header className="overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-soft)]">
          <div className="relative aspect-[21/8] w-full overflow-hidden bg-[var(--canvas-raised)]">
            {cover && (
              <FadeImage
                src={cover}
                alt={brand.name}
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
                priority
              />
            )}
          </div>
          <div className="px-6 py-7 md:px-10">
            <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
              {brand.name}
            </h1>
            <dl className="mt-6 grid grid-cols-2 gap-y-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)] sm:grid-cols-4">
              <Info label="Country" value={brand.country} />
              <Info label="Founded" value={brand.foundedYear} />
              <Info label="Founder" value={brand.founder} />
              <Info label="Category" value={brand.category} />
            </dl>
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-5 inline-flex items-center gap-1 font-label text-[12px] text-[var(--ink)] underline-offset-4 hover:underline"
              >
                官方网站 ↗
              </a>
            )}
          </div>
        </header>

        <section className="mt-14">
          <h2 className="mb-6 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            Shows · {shows.length}
          </h2>
          {shows.length === 0 ? (
            <p className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
              暂无秀场。
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shows.map((s) => (
                <ShowCard key={s.id} show={s} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-14">
          <h2 className="mb-6 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            Related Posts · {posts.length}
          </h2>
          {posts.length === 0 ? (
            <p className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
              还没有相关帖子。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {posts.map((p, i) => (
                <PostCard key={p.id} post={p} priority={i < 4} />
              ))}
            </div>
          )}
        </section>
      </article>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

function Info({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px]">{label}</dt>
      <dd className="mt-1 font-serif text-[15px] normal-case tracking-normal text-black dark:text-white">
        {value}
      </dd>
    </div>
  );
}

function ShowCard({ show }: { show: Show }) {
  return (
    <Link
      href={`/archive/shows/${show.id}`}
      className="group block overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-soft)]"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--canvas-raised)]">
        {show.coverImage && (
          <FadeImage
            src={show.coverImage}
            alt={show.title || `${show.brand} ${show.season}`}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate font-serif text-[13px] text-black dark:text-white">
          {show.title || show.season}
        </p>
        <p className="mt-0.5 font-label text-[10px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {show.season}
          {show.year ? ` · ${show.year}` : ""}
        </p>
      </div>
    </Link>
  );
}
