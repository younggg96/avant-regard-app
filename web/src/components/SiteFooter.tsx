import Link from "next/link";
import { ThemeSegmented } from "@/components/ThemeSegmented";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-white dark:bg-[#0a0a0a] border-black/[0.06] dark:border-white/[0.08]">
      <div className="mx-auto max-w-content px-6">
        {/* Main grid */}
        <div className="grid gap-12 py-16 md:grid-cols-[2fr,1fr,1fr]">
          <div>
            <div className="font-serif text-2xl tracking-wide text-black dark:text-white">
              Avant Regard
            </div>
            <p className="mt-3 max-w-xs font-serif text-sm leading-relaxed text-black/45 dark:text-white/35">
              为先锋时装而生的社区。发现设计师品牌、浏览秀场、分享穿搭与单品测评。
            </p>
          </div>

          <nav>
            <h3 className="font-label text-[10px] uppercase tracking-[0.22em] text-black/30 dark:text-white/25">
              产品
            </h3>
            <ul className="mt-5 space-y-3 font-serif text-sm">
              <li><Link href="/discover" className="link-muted">发现</Link></li>
              <li><Link href="/download" className="link-muted">下载 App</Link></li>
            </ul>
          </nav>

          <nav>
            <h3 className="font-label text-[10px] uppercase tracking-[0.22em] text-black/30 dark:text-white/25">
              关于
            </h3>
            <ul className="mt-5 space-y-3 font-serif text-sm">
              <li><Link href="/#about" className="link-muted">品牌故事</Link></li>
              <li><a href="mailto:hello@avantregard.com" className="link-muted">联系我们</a></li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-start gap-4 border-t py-6
                        border-black/[0.06] dark:border-white/[0.08]
                        font-label text-[10px] text-black/25 dark:text-white/20
                        md:flex-row md:items-center md:justify-between md:gap-6">
          {/* Appearance switcher – keeps the OS-following "Auto" option the
              header icon toggle intentionally omits. */}
          <ThemeSegmented />

          <span className="uppercase tracking-[0.15em] md:order-none">© {year} Avant Regard</span>

          <span className="font-serif italic tracking-normal text-black/20 dark:text-white/15">
            Designed in Shanghai · Worn worldwide.
          </span>
        </div>
      </div>
    </footer>
  );
}
