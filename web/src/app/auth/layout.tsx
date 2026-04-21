/**
 * Shared shell for /auth/login | /auth/register | /auth/forgot.
 *
 * Centers a narrow card, renders a page-scoped header (wordmark + back link)
 * and optional tabs. Dark-mode aware via the app's existing CSS variables.
 */

import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <Link
            href="/"
            className="font-serif text-[1.05rem] tracking-[0.06em] hover:opacity-50"
          >
            Avant Regard
          </Link>
          <Link
            href="/discover"
            className="link-muted font-label text-[12px] tracking-wide"
          >
            继续浏览 Discover →
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[440px] flex-col justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}
