import type { Metadata } from "next";
import Link from "next/link";
import { FadeImage } from "@/components/FadeImage";
import { ApiError, getAllBrands, type Brand } from "@/lib/api";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "品牌 · Archive",
  description:
    "按字母浏览 Avant Regard 档案收录的时装品牌，挖掘秀场与单品。",
  alternates: { canonical: "/archive/brands" },
};

function firstLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

// next/image refuses any `src` whose protocol is neither http nor https (or
// that isn't absolute). Brand cover URLs are scraped from third-party vendor
// pages and occasionally come back malformed ("", "/foo.jpg", "data:..."),
// which historically crashed the whole SSR with "Invalid src prop".
const isRenderableImage = (src?: string): src is string =>
  !!src && /^https?:\/\//i.test(src);

export default async function BrandsPage() {
  try {
    const res = await getAllBrands();
    const brands = res.brands.slice().sort((a, b) => a.name.localeCompare(b.name));

    const groups = new Map<string, Brand[]>();
    for (const b of brands) {
      const k = firstLetter(b.name);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(b);
    }
    const letters = Array.from(groups.keys()).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });

    return (
      <section className="mx-auto max-w-content px-6 py-12 md:py-16">
        <header className="mb-8">
          <nav className="mb-4 font-label text-sm">
            <Link href="/" className="link-muted">
              ← 首页
            </Link>
          </nav>
          <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
            品牌档案
          </h1>
          <p className="mt-3 max-w-xl font-serif text-[15px] leading-relaxed text-black/60 dark:text-white/50">
            {res.total} 个品牌 · 按字母索引
          </p>
        </header>

        <nav
          aria-label="字母索引"
          className="sticky top-14 z-20 -mx-6 border-y border-[var(--border)] bg-[var(--canvas)]/95 px-6 py-2 backdrop-blur"
        >
          <ul className="flex flex-wrap gap-2 font-label text-[12px]">
            {letters.map((l) => (
              <li key={l}>
                <a
                  href={`#letter-${l}`}
                  className="rounded px-2 py-1 text-[color:var(--ink-muted)] hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-12">
          {letters.map((l) => (
            <section key={l} id={`letter-${l}`} className="scroll-mt-28">
              <h2 className="mb-5 font-serif text-2xl text-black dark:text-white">
                {l}
              </h2>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                {groups.get(l)!.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/archive/brands/${b.id}`}
                      className="flex items-center gap-3 rounded border border-transparent px-2 py-1.5 font-serif text-[15px] text-black/80 transition-colors hover:border-[var(--border)] hover:bg-[var(--canvas-raised)] dark:text-white/70"
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
                        {isRenderableImage(b.coverImage) && (
                          <FadeImage
                            src={b.coverImage}
                            alt={b.name}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <span className="truncate">{b.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return (
        <p className="mx-auto max-w-content px-6 py-24 text-center font-serif text-[color:var(--ink-muted)]">
          品牌档案加载失败：{err.message}
        </p>
      );
    }
    throw err;
  }
}
