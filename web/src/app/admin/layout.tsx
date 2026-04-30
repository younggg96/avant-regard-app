import type { Metadata } from "next";
import { AdminRequired } from "@/components/admin/AdminRequired";
import { AdminNav } from "@/components/admin/AdminNav";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return { title: t("admin.title") };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminRequired>
      <div className="mx-auto grid max-w-[1400px] gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--border)] md:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto px-3 py-6">
            <AdminNav />
          </div>
        </aside>
        <div className="min-w-0 px-6 py-6 lg:px-8">{children}</div>
      </div>
    </AdminRequired>
  );
}
