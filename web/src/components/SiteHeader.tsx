import Link from "next/link";

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/discover", label: "发现" },
  { href: "/#features", label: "功能" },
  { href: "/#about", label: "关于" },
  { href: "/download", label: "下载 App" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif text-xl tracking-wide text-ink transition hover:opacity-70"
        >
          Avant Regard
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="link-muted tracking-wide"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/download" className="btn-primary hidden md:inline-flex">
          免费下载
        </Link>

        <Link
          href="/download"
          className="btn-primary md:hidden"
          aria-label="下载 App"
        >
          下载
        </Link>
      </div>
    </header>
  );
}
