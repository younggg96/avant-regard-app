import { AuthRequired } from "@/components/auth/AuthRequired";

/**
 * 结算流程用独立的窄栏布局，不挂 /me 的侧边导航——下单过程中把注意力
 * 留在订单本身，减少中途跳出。
 */
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthRequired>
      <div className="mx-auto max-w-2xl px-6 py-10 md:py-12">{children}</div>
    </AuthRequired>
  );
}
