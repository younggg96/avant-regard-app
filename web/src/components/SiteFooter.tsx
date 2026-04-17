import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink/5 bg-ink-100">
      <div className="mx-auto grid max-w-content gap-12 px-6 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-serif text-2xl tracking-wide">Avant Regard</div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/60">
            为先锋时装而生的社区。发现设计师品牌、浏览秀场、分享穿搭与单品测评。
          </p>
        </div>

        <nav>
          <h3 className="text-xs uppercase tracking-widest text-ink/40">
            产品
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link href="/discover" className="link-muted">
                发现
              </Link>
            </li>
            <li>
              <Link href="/download" className="link-muted">
                下载 App
              </Link>
            </li>
          </ul>
        </nav>

        <nav>
          <h3 className="text-xs uppercase tracking-widest text-ink/40">
            关于
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link href="/#about" className="link-muted">
                品牌故事
              </Link>
            </li>
            <li>
              <a
                href="mailto:hello@avantregard.com"
                className="link-muted"
              >
                联系我们
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-ink/5">
        <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-ink/40 md:flex-row">
          <span>© {year} Avant Regard. All rights reserved.</span>
          <span>Designed in Shanghai · Worn worldwide.</span>
        </div>
      </div>
    </footer>
  );
}
