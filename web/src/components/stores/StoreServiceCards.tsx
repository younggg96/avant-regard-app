"use client";

/**
 * 店铺"服务承诺"卡片行（对照截图 1 中部的 3 张横卡：
 * 全球直采 / 正品保障 / 私人档案服务）.
 *
 * 渲染策略：
 *   - 仅对"已入驻商家"店（hasMerchant === true）展示，普通用户提交的店
 *     没有经过官方认证流程，不应声称这些服务承诺；
 *   - 3 张卡固定文案；图标用 emoji + 圆底色块 —— 保持极简，和 admin 管理面板
 *     的视觉语言一致；
 *   - 如果 profile.tags 里含类似关键词（e.g. "全球采购" / "正品保障"），
 *     对应卡片强调高亮，让商家通过打 tag 控制哪些要"亮起". 未配置时 3 张
 *     卡片都展示但不强调，文案中性.
 */

import { Globe, CheckCircle2, Archive } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { StoreProfileConfig } from "@/lib/services/store-product";

interface Props {
  hasMerchant: boolean;
  profile: StoreProfileConfig | null | undefined;
}

interface ServiceItem {
  icon: ReactNode;
  label: string;
  labelEn: string;
  highlightTags: string[];
}

function useServices(): ServiceItem[] {
  const { t } = useTranslation();
  return [
    {
      icon: <Globe size={18} />,
      label: t("store.globalSourcing"),
      labelEn: "DIRECT GLOBAL SOURCING",
      highlightTags: ["全球直采", "全球采购"],
    },
    {
      icon: <CheckCircle2 size={18} />,
      label: t("store.authenticGuarantee"),
      labelEn: "AUTHENTIC GUARANTEE",
      highlightTags: ["正品保障", "官方认证"],
    },
    {
      icon: <Archive size={18} />,
      label: t("store.privateArchive"),
      labelEn: "PRIVATE ARCHIVE",
      highlightTags: ["私人档案", "档案服务"],
    },
  ];
}

export function StoreServiceCards({ hasMerchant, profile }: Props) {
  const SERVICES = useServices();
  if (!hasMerchant) return null;

  const tags = profile?.tags ?? [];

  return (
    <section className="mb-10 grid gap-3 sm:grid-cols-3">
      {SERVICES.map((s) => {
        const highlighted = s.highlightTags.some((t) => tags.includes(t));
        return (
          <div
            key={s.label}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
              highlighted
                ? "border-[var(--ink)] bg-[var(--canvas-raised)]"
                : "border-[var(--border)] bg-[var(--canvas-soft)]"
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--canvas)] text-[16px]">
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-serif text-[14px] text-[var(--ink)]">
                {s.label}
              </div>
              <div className="font-label text-[10px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {s.labelEn}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
