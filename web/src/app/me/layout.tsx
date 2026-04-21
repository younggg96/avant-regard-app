import { AuthRequired } from "@/components/auth/AuthRequired";
import { MeNav } from "@/components/me/MeNav";
import { ME_NAV_ITEMS } from "@/components/me/nav-items";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthRequired>
      <div className="mx-auto grid max-w-content gap-8 px-6 py-10 md:grid-cols-[200px_minmax(0,1fr)] md:py-12">
        <aside className="hidden md:block">
          <MeNav items={ME_NAV_ITEMS} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </AuthRequired>
  );
}
