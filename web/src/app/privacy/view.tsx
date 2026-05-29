"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Avant Regard public Privacy Policy view.
 *
 * Structure:
 *   - Header with "you are here" flavor badge (CN vs NA) and links to the
 *     other flavor's Privacy URL — useful for Twilio toll-free verification
 *     reviewers and for users who landed on the wrong region's site.
 *   - Highlighted "SMS Communications" section rendered VERBATIM in English.
 *     This block is what Twilio toll-free verification reviewers and US
 *     carriers (CTIA) look for. Do not edit the wording.
 *   - English summary of the full privacy policy. Mirrors the Chinese policy
 *     bundled inside the mobile app.
 *   - Full Chinese privacy policy (kept for parity with the in-app text and
 *     for our primary user base).
 *
 * If you need to update wording, update the in-app PrivacyContent component
 * (`frontend/src/screens/Auth/components/PrivacyContent.tsx`) in lockstep so
 * the in-app modal and the public URL stay consistent.
 */

const LAST_UPDATED = "2026-05-27";
const EFFECTIVE_DATE = "2026-05-27";

// Two app flavors → two web domains → two public Privacy URLs.
// Keep this table in sync with frontend/.env.cn / .env.na (EXPO_PUBLIC_WEB_URL)
// and frontend/app.config.js (IS_NA bundle id / scheme switches).
type FlavorKey = "cn" | "na";

const FLAVORS: Record<
  FlavorKey,
  { label: string; region: string; host: string; url: string }
> = {
  cn: {
    label: "中国版 · China",
    region: "Mainland China",
    host: "avantregard.com",
    url: "https://avantregard.com/privacy",
  },
  na: {
    label: "北美版 · North America",
    region: "United States & Canada",
    host: "avantregards.com",
    url: "https://avantregards.com/privacy",
  },
};

/**
 * Resolve which flavor the current request is on by inspecting the host name.
 * Runs on the client because Next.js is rendering this view as a Client
 * Component (uses `useEffect`). SSR returns `null` so both flavors render the
 * same neutral fallback, avoiding hydration mismatch.
 */
function useCurrentFlavor(): FlavorKey | null {
  const [flavor, setFlavor] = useState<FlavorKey | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.host.toLowerCase();
    // `avantregards.com` must be matched before `avantregard.com`, otherwise
    // a naive `includes("avantregard.com")` would catch the NA host too.
    if (host.includes("avantregards.com")) setFlavor("na");
    else if (host.includes("avantregard.com")) setFlavor("cn");
    else setFlavor(null);
  }, []);
  return flavor;
}

export function PrivacyView() {
  const flavor = useCurrentFlavor();
  const here = flavor ? FLAVORS[flavor] : null;
  const other = flavor ? FLAVORS[flavor === "cn" ? "na" : "cn"] : null;

  return (
    <article className="mx-auto max-w-content px-6 py-16 md:py-24">
      <header className="border-b border-black/[0.08] pb-8 dark:border-white/[0.08]">
        <p className="font-label text-[11px] uppercase tracking-[0.22em] text-black/40 dark:text-white/35">
          Avant Regard · Legal
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight text-black dark:text-white">
          Privacy Policy
        </h1>
        <dl className="mt-4 grid gap-1 font-label text-[12px] text-black/55 dark:text-white/45 sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="uppercase tracking-[0.18em]">Last updated</dt>
            <dd>{LAST_UPDATED}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="uppercase tracking-[0.18em]">Effective</dt>
            <dd>{EFFECTIVE_DATE}</dd>
          </div>
        </dl>

        {/* Flavor / region selector — shown on both CN and NA domains so a
            visitor (or Twilio reviewer) can confirm they are reading the
            right policy and jump to the other region's mirror. */}
        <div className="mt-6 flex flex-wrap items-center gap-2 font-label text-[12px]">
          {(Object.keys(FLAVORS) as FlavorKey[]).map((key) => {
            const meta = FLAVORS[key];
            const active = flavor === key;
            return (
              <a
                key={key}
                href={meta.url}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-full border border-black/40 bg-black px-3 py-1 text-white dark:border-white/40 dark:bg-white dark:text-black"
                    : "inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-black/60 transition-colors hover:border-black/40 hover:text-black dark:border-white/15 dark:text-white/55 dark:hover:border-white/40 dark:hover:text-white"
                }
              >
                <span
                  aria-hidden
                  className={
                    active
                      ? "h-1.5 w-1.5 rounded-full bg-white dark:bg-black"
                      : "h-1.5 w-1.5 rounded-full bg-black/30 dark:bg-white/30"
                  }
                />
                {meta.label}
                <span className="text-[11px] uppercase tracking-[0.14em] opacity-60">
                  {meta.host}
                </span>
              </a>
            );
          })}
        </div>
      </header>

      {/* SMS COMMUNICATIONS — required for Twilio / CTIA compliance.
          Render verbatim. Anchor allows the mobile app and other surfaces to
          deep-link directly to this paragraph. */}
      <section
        id="sms-communications"
        className="mt-10 rounded-lg border border-black/[0.08] bg-black/[0.02] p-6 dark:border-white/[0.08] dark:bg-white/[0.03]"
      >
        <h2 className="font-serif text-[22px] tracking-tight text-black dark:text-white">
          SMS Communications
        </h2>
        <p className="mt-4 font-label text-[14px] leading-relaxed text-black/75 dark:text-white/75">
          When you create an account using a mobile phone number, you consent
          to receive one-time SMS verification codes for the purpose of account
          authentication and security. Standard message and data rates may
          apply. You may opt out of SMS communications at any time by replying{" "}
          <strong className="font-semibold text-black dark:text-white">
            STOP
          </strong>{" "}
          to any message. Phone numbers collected for SMS verification are
          stored securely and are not sold, rented, or shared with third
          parties for marketing purposes.
        </p>

        {/* Authoritative public URLs for each app flavor. Listed here so a
            compliance reviewer (Twilio toll-free verification, US carriers /
            CTIA) can verify the mobile app's SMS disclosure link resolves to
            the corresponding region. */}
        <div className="mt-6 border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/40">
            Public Privacy URLs · 双域对照
          </p>
          <ul className="mt-3 space-y-2 font-label text-[13px]">
            {(Object.keys(FLAVORS) as FlavorKey[]).map((key) => {
              const meta = FLAVORS[key];
              const active = flavor === key;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                >
                  <span className="min-w-[150px] text-black/55 dark:text-white/50">
                    {meta.label}
                  </span>
                  <a
                    href={meta.url}
                    className={
                      active
                        ? "font-medium text-black underline underline-offset-4 dark:text-white"
                        : "text-black/70 underline underline-offset-4 hover:text-black dark:text-white/60 dark:hover:text-white"
                    }
                  >
                    {meta.url}
                  </a>
                  {active && (
                    <span className="rounded border border-black/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-black/60 dark:border-white/15 dark:text-white/55">
                      You are here
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {here && other && (
            <p className="mt-3 font-label text-[12px] leading-relaxed text-black/50 dark:text-white/40">
              You are viewing the {here.region} version. Looking for the{" "}
              {other.region} app? Visit{" "}
              <a
                href={other.url}
                className="text-black underline underline-offset-4 dark:text-white"
              >
                {other.url}
              </a>
              .
            </p>
          )}
        </div>
      </section>

      {/* English summary --------------------------------------------------- */}
      <section className="mt-12 space-y-6 font-label text-[14px] leading-relaxed text-black/70 dark:text-white/70">
        <h2 className="font-serif text-[22px] tracking-tight text-black dark:text-white">
          Overview
        </h2>
        <p>
          Avant Regard (operated by Shanghai Nantek Industrial Co., Ltd.)
          provides a community and marketplace for designer and second-hand
          fashion. This policy explains what personal information we collect,
          how we use and protect it, and the rights you have over it. We follow
          the principles of lawful, necessary, and transparent processing in
          line with the PRC Cybersecurity Law, Data Security Law and Personal
          Information Protection Law, as well as applicable rules in the
          jurisdictions where we operate.
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          Information we collect
        </h3>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-black dark:text-white">
              Account &amp; authentication
            </strong>{" "}
            — phone number or email, password, and (when required by law)
            real-name verification details.
          </li>
          <li>
            <strong className="font-semibold text-black dark:text-white">
              Transactions
            </strong>{" "}
            — shipping addresses, order details and payment routing metadata
            (we do not store full payment-instrument numbers).
          </li>
          <li>
            <strong className="font-semibold text-black dark:text-white">
              Optional profile &amp; usage
            </strong>{" "}
            — display name, avatar, preferences, posts, store locations you
            submit to the Buyer Map, search history and recommendations
            signals.
          </li>
          <li>
            <strong className="font-semibold text-black dark:text-white">
              Device &amp; security
            </strong>{" "}
            — device model, OS version, IP address, login timestamps and
            session telemetry used to detect abuse and keep your account safe.
          </li>
        </ul>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          How we use information
        </h3>
        <p>
          We use personal information only for the purposes stated when it was
          collected: to operate the service, secure your account, fulfil
          orders, personalise recommendations you can opt out of, and respond
          to reports and support requests. Buyer Map location data is used
          only within the Buyer Map experience. Reports and block operations
          are visible only to platform reviewers.
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          Sharing
        </h3>
        <p>
          We do not sell or rent personal information. We share data only as
          needed to deliver the service (e.g. with payment processors and
          shipping carriers for the relevant order), to comply with the law,
          or as anonymised aggregates with our affiliates for service
          improvement.
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          Your rights
        </h3>
        <p>
          You can access, correct, export and delete your data, withdraw
          consent for optional processing, and lodge a complaint at any time.
          To exercise these rights, contact us at{" "}
          <a
            href="mailto:avant.regarde61@gmail.com"
            className="underline underline-offset-4 hover:text-black dark:hover:text-white"
          >
            avant.regarde61@gmail.com
          </a>
          .
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          Contact
        </h3>
        <address className="not-italic">
          Shanghai Nantek Industrial Co., Ltd.
          <br />
          Room 2096, Area C, 2F, Building 1, Lane 588 Zhanglian-tang Road,
          Liantang Town, Qingpu District, Shanghai, PRC
          <br />
          Email:{" "}
          <a
            href="mailto:avant.regarde61@gmail.com"
            className="underline underline-offset-4 hover:text-black dark:hover:text-white"
          >
            avant.regarde61@gmail.com
          </a>
        </address>
      </section>

      {/* Chinese full text — primary user base ------------------------------- */}
      <section
        lang="zh-CN"
        className="mt-16 space-y-5 border-t border-black/[0.08] pt-12 font-label text-[14px] leading-relaxed text-black/70 dark:border-white/[0.08] dark:text-white/70"
      >
        <h2 className="font-serif text-[22px] tracking-tight text-black dark:text-white">
          Avant Regard 隐私政策（中文版）
        </h2>
        <p className="font-label text-[12px] text-black/45 dark:text-white/40">
          运营方：上海南特克实业有限公司（统一社会信用代码：9131011877976576X6；注册地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室）
        </p>

        <p>
          欢迎使用 Avant Regard 产品及服务！我们将严格遵循《中华人民共和国网络安全法》《数据安全法》《个人信息保护法》等法律法规，秉持合法正当、最小必要、公开透明的原则保护您的个人信息。
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          一、个人信息的收集与使用
        </h3>
        <p>
          为完成账号注册与登录，我们需收集手机号码或邮箱、账号密码；完成实名认证时需提供姓名及身份证件信息。为完成交易需收集收货地址、订单及支付路由信息（不存储完整支付账号）。您可自主选择是否提供昵称、头像、性别、生日、买手店位置、浏览历史等非必要信息，拒绝不影响基础功能使用。
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          二、短信通信（SMS）
        </h3>
        <p>
          当您使用手机号注册账号时，您同意接收用于账号身份验证和安全用途的一次性短信验证码。运营商可能收取标准的短信和数据费用。您可以随时通过对任意短信回复 STOP 退订。我们为短信验证收集的手机号将被安全存储，且不会出于营销目的向任何第三方出售、出租或共享。
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          三、共享、转移与公开
        </h3>
        <p>
          我们不会向第三方出售、出租您的个人信息。仅在交易履约（向支付机构、物流服务商）、配合法定调查或经您单独同意时共享必要信息；可向关联方共享匿名化、去标识化数据用于服务优化。
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          四、存储与安全
        </h3>
        <p>
          您的个人信息在中华人民共和国境内存储，并采用加密存储、访问权限控制、安全审计等措施保护，存储期限不超过实现处理目的所需的最短时间。
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          五、您的权利
        </h3>
        <p>
          您依法享有查阅、复制、更正、补充、删除个人信息以及撤回同意、投诉举报的权利，可通过"我的-设置-隐私管理"或联系客服行使。我们将在收到申请后15个工作日内受理处理。
        </p>

        <h3 className="font-serif text-[18px] tracking-tight text-black dark:text-white">
          六、联系我们
        </h3>
        <p>
          客服邮箱：avant.regarde61@gmail.com；客服微信：Avantregard2025；联系地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室。
        </p>
      </section>

      <footer className="mt-16 border-t border-black/[0.08] pt-6 dark:border-white/[0.08]">
        <p className="font-label text-[12px] text-black/40 dark:text-white/35">
          © {new Date().getFullYear()} Avant Regard. All rights reserved.{" "}
          <Link
            href="/"
            className="underline underline-offset-4 hover:text-black dark:hover:text-white"
          >
            Return home
          </Link>
        </p>
      </footer>
    </article>
  );
}
