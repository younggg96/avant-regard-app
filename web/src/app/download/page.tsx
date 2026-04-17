import type { Metadata } from "next";
import Link from "next/link";
import { DownloadCTAs } from "@/components/DownloadCTAs";
import { SmartRedirect } from "@/components/SmartRedirect";

export const metadata: Metadata = {
  title: "下载 Avant Regard",
  description:
    "在 App Store 或 Google Play 下载 Avant Regard。为先锋时装而生的社区。",
  alternates: { canonical: "/download" },
};

const STEPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "下载 App",
    body: "在 App Store 或 Google Play 搜索「Avant Regard」，一键安装。",
  },
  {
    title: "创建账户",
    body: "使用手机号或 Apple ID 登录，三十秒完成。",
  },
  {
    title: "开始探索",
    body: "订阅喜欢的品牌与买手店，发现身边志趣相投的穿搭者。",
  },
];

export default function DownloadPage() {
  return (
    <>
      <SmartRedirect />

      <section className="border-b border-ink/5 bg-white">
        <div className="mx-auto grid max-w-content gap-16 px-6 py-20 md:grid-cols-2 md:py-28">
          <div className="flex flex-col justify-center">
            <span className="chip w-fit">下载</span>
            <h1 className="mt-6 font-serif text-hero font-semibold">
              把先锋时装
              <br />
              装进口袋。
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ink/60">
              Avant Regard 支持 iOS 与 Android。
              使用手机扫描下方二维码，或直接前往应用商店。
            </p>
            <div className="mt-10">
              <DownloadCTAs />
            </div>
            <p className="mt-6 text-xs text-ink/40">
              无法访问？ <Link href="/" className="link-muted underline">返回首页</Link>{" "}
              或写信至{" "}
              <a href="mailto:hello@avantregard.com" className="link-muted underline">
                hello@avantregard.com
              </a>
              。
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-sm rounded-3xl border border-ink/10 bg-ink-100 p-10 text-center">
              <div className="mx-auto flex aspect-square w-full items-center justify-center rounded-2xl border border-ink/10 bg-white text-xs uppercase tracking-widest text-ink/40">
                扫码下载
              </div>
              <div className="mt-4 font-serif text-lg">Avant Regard</div>
              <div className="text-xs uppercase tracking-widest text-ink/40">
                iOS · Android
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink-100 py-24">
        <div className="mx-auto max-w-content px-6">
          <h2 className="font-serif text-display">三步加入社区</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl bg-white p-8 shadow-soft"
              >
                <div className="font-serif text-5xl tracking-tight text-ink/20">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-4 font-serif text-xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/60">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
