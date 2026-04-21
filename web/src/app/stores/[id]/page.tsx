import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreById } from "@/lib/api";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const store = await getStoreById(id);
  if (!store) return { title: "买手店 | Avant Regard" };
  return {
    title: `${store.name} · 买手店 | Avant Regard`,
    description: store.description ?? `${store.name} · ${store.city}`,
  };
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getStoreById(id);
  if (!store) notFound();

  const images = store.images ?? [];
  const hero = images[0];

  return (
    <article className="mx-auto max-w-content px-6 py-10 md:py-12">
      <nav className="mb-8 flex items-center gap-3 font-label text-sm">
        <Link href="/stores" className="link-muted">
          ← 买手店
        </Link>
        <span className="text-black/20 dark:text-white/20">/</span>
        <span className="text-[color:var(--ink-muted)]">{store.name}</span>
      </nav>

      <header className="mb-10 grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="overflow-hidden rounded bg-[var(--canvas-raised)]">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt={store.name}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center font-label text-xs uppercase tracking-widest text-[color:var(--ink-muted)]">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-black dark:text-white md:text-4xl">
              {store.name}
            </h1>
            <p className="mt-2 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              {[store.country, store.city].filter(Boolean).join(" · ")}
            </p>
          </div>

          {store.description && (
            <p className="font-serif text-[15px] leading-relaxed text-[color:var(--ink)]">
              {store.description}
            </p>
          )}

          <dl className="mt-2 grid gap-3 font-label text-[13px] text-[color:var(--ink-muted)]">
            {store.address && (
              <Row label="地址" value={store.address} />
            )}
            {store.hours && <Row label="营业" value={store.hours} />}
            {store.phone && store.phone.length > 0 && (
              <Row label="电话" value={store.phone.join(" / ")} />
            )}
            {store.rating != null && (
              <Row label="评分" value={`${store.rating.toFixed(1)} / 5`} />
            )}
            {store.rest && <Row label="休息" value={store.rest} />}
          </dl>

          {store.coordinates &&
            store.coordinates.latitude !== 0 &&
            store.coordinates.longitude !== 0 && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${store.coordinates.latitude},${store.coordinates.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-fit items-center gap-1 font-label text-[13px] text-[var(--ink)] underline-offset-4 hover:underline"
              >
                在 Google Maps 打开 →
              </a>
            )}
        </div>
      </header>

      {images.length > 1 && (
        <section className="mb-12">
          <h2 className="mb-4 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            门店图集
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {images.slice(1).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`${store.name} ${i + 2}`}
                className="aspect-[4/3] w-full rounded object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {store.brands.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            在售品牌
          </h2>
          <ul className="flex flex-wrap gap-2">
            {store.brands.map((b) => (
              <li
                key={b}
                className="rounded-full border border-[var(--border)] px-3 py-1 font-label text-[12px] text-[var(--ink)]"
              >
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {store.style.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            风格标签
          </h2>
          <ul className="flex flex-wrap gap-2">
            {store.style.map((s) => (
              <li
                key={s}
                className="rounded-full bg-[var(--canvas-raised)] px-3 py-1 font-label text-[12px] text-[color:var(--ink-muted)]"
              >
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-14 border-t pt-8 border-[var(--border)] font-label text-sm text-[color:var(--ink-muted)]">
        <Link href="/stores" className="link-underline">
          返回买手店地图 →
        </Link>
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-14 shrink-0 uppercase tracking-widest">{label}</dt>
      <dd className="flex-1 text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}
