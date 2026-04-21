import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-content flex-col items-center px-6 py-32 text-center">
      <span className="chip">404</span>
      <h1 className="mt-6 font-serif text-display">没有找到这一页。</h1>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink/60">
        链接可能已失效，或内容已被创作者删除。
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          返回首页
        </Link>
        <Link href="/discover" className="btn-secondary">
          浏览 Discover
        </Link>
      </div>
    </section>
  );
}
