import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/discover", label: "发现" },
  { href: "/#features", label: "功能" },
  { href: "/#about",    label: "关于" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/92 backdrop-blur-md transition-shadow
                       border-black/[0.06] dark:bg-[#0a0a0a]/92 dark:border-white/[0.08]">
      <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-serif text-[1.05rem] tracking-[0.06em] transition-opacity duration-200
                     text-black hover:opacity-40 dark:text-white"
        >
          Avant Regard
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 font-label text-[13px] tracking-wide md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="link-underline">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/download" className="btn-primary hidden text-xs md:inline-flex">
            免费下载
          </Link>
          <Link href="/download" className="btn-primary text-xs md:hidden" aria-label="下载 App">
            下载
          </Link>
        </div>
      </div>
    </header>
  );
}
