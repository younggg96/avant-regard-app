import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/auth/UserMenu";

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/discover", label: "发现" },
  { href: "/communities", label: "论坛" },
  { href: "/archive/brands", label: "档案" },
  { href: "/stores", label: "买手店" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/92 backdrop-blur-md transition-shadow
                       border-black/[0.06] dark:bg-[#0a0a0a]/92 dark:border-white/[0.08]">
      <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif text-[1.05rem] tracking-[0.06em] transition-opacity duration-200
                     text-black hover:opacity-40 dark:text-white"
        >
          Avant Regard
        </Link>

        <nav className="hidden items-center gap-7 font-label text-[13px] tracking-wide md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="link-underline">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
