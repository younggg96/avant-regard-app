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
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[440px] flex-col justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}
