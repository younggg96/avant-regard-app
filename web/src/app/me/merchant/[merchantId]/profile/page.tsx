"use client";

/**
 * /me/merchant/[merchantId]/profile —— 店铺主页卡片配置.
 *
 * 对齐移动端 `frontend/src/screens/Discover/components/BuyerTab/StoreProfileCard.tsx`
 * 的可配置字段：logoImage / coverImage / shortDescription / longDescription / tags.
 *
 * 数据源：
 *   - GET  /api/store-merchants/store/{storeId}/profile-config —— 读（公开接口，
 *     但我们登录态下用同一个端点；未配置返回 null 走表单"新建"路径）.
 *   - PUT  /api/store-merchants/{merchantId}/profile-config    —— upsert.
 *
 * 设计理由：
 *   - 主页卡片是"单例"语义（每店铺只有一份），所以这个子页走"单表单+保存"而不是
 *     list+dialog 模式，UX 更直接.
 *   - 页面入口保护沿用 AuthRequired + 从 /me/merchant 拉 my merchants 做所属校验,
 *     和 Banner / 公告子页保持一致.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import {
  Button,
  FormField,
  LoadingState,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";
import {
  ChipEditor,
  ImagePicker,
  SubPageBackLink,
  SubPageHeader,
} from "@/components/merchant/shared";
import {
  storeProductService,
  type StoreProfileConfig,
  type StoreProfileConfigUpsertParams,
} from "@/lib/services/store-product";
import { storeMerchantService } from "@/lib/services/store-merchant";

const MAX_TAGS = 6;

/** 表单内部用非空字符串；提交时空串会转成 null 回给后端. */
interface FormState {
  logoImage: string;
  coverImage: string;
  shortDescription: string;
  longDescription: string;
  tags: string[];
}

const EMPTY_FORM: FormState = {
  logoImage: "",
  coverImage: "",
  shortDescription: "",
  longDescription: "",
  tags: [],
};

export default function StoreProfileConfigPage() {
  const params = useParams<{ merchantId: string }>();
  const merchantId = Number(params?.merchantId);

  const { data: myMerchants, isLoading: loadingMerchants } = useSWR(
    Number.isFinite(merchantId) ? ["my-merchants-for-profile", merchantId] : null,
    () => storeMerchantService.getMyMerchants(1, 50),
  );

  const merchant = useMemo(
    () => myMerchants?.merchants.find((m) => m.id === merchantId) ?? null,
    [myMerchants, merchantId],
  );

  const storeId = merchant?.storeId ?? null;

  const {
    data: config,
    isLoading: loadingConfig,
    mutate,
  } = useSWR(
    storeId ? ["store-profile-config", storeId] : null,
    () => storeProductService.getProfileConfig(storeId as string),
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 拉到数据后填充表单（只做一次，后续由用户编辑驱动）.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated && config !== undefined) {
      setForm(configToForm(config));
      setHydrated(true);
    }
  }, [config, hydrated]);

  if (loadingMerchants) {
    return <LoadingState />;
  }

  if (!merchant || merchant.status !== "APPROVED") {
    return (
      <section className="min-w-0">
        <SubPageBackLink merchantId={merchantId} />
        <div className="mt-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
          <div className="font-serif text-[17px] text-[var(--ink)]">
            无权限访问该页面
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            商家 ID 不匹配或尚未通过审核.
          </div>
        </div>
      </section>
    );
  }

  const onSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: StoreProfileConfigUpsertParams = {
        logoImage: form.logoImage || null,
        coverImage: form.coverImage || null,
        shortDescription: form.shortDescription || null,
        longDescription: form.longDescription || null,
        tags: form.tags,
      };
      const next = await storeProductService.upsertProfileConfig(
        merchantId,
        payload,
      );
      await mutate(next, { revalidate: false });
      // 买手店 Tab 的 useBuyerTabData 也缓存了这个 key（通过 loadStoreConfig），
      // 虽然它不是 SWR 管的，但如果未来别处也在 swr 里拉了同一个 storeId 的 config,
      // 这里统一刷一下避免信息错位.
      await globalMutate(
        (k) =>
          Array.isArray(k) &&
          k[0] === "store-profile-config" &&
          k[1] === storeId,
      );
      setSavedAt(new Date().toLocaleTimeString("zh-CN"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0">
      <SubPageBackLink merchantId={merchantId} />
      <SubPageHeader
        title="店铺主页配置"
        description="控制「买手店 Tab」顶部 StoreProfileCard 的展示：头图 / 封面 / 介绍 / 标签."
        actions={<StatusBadge active>单例配置</StatusBadge>}
      />

      {loadingConfig && !hydrated ? (
        <LoadingState />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-5 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Logo 图（正方形）">
                <ImagePicker
                  value={form.logoImage}
                  onChange={(v) => setForm({ ...form, logoImage: v })}
                  height={160}
                  hint="建议 1:1，用于卡片左侧头像位."
                />
              </FormField>
              <FormField label="封面图（右侧）">
                <ImagePicker
                  value={form.coverImage}
                  onChange={(v) => setForm({ ...form, coverImage: v })}
                  height={160}
                  hint="建议 4:3，展示店铺氛围."
                />
              </FormField>
            </div>

            <FormField label="短介绍（卡片顶部）">
              <TextInput
                value={form.shortDescription}
                onChange={(v) => setForm({ ...form, shortDescription: v })}
                placeholder="一句话介绍你的店铺调性"
              />
            </FormField>

            <FormField label="长介绍（卡片底部）">
              <TextInput
                value={form.longDescription}
                onChange={(v) => setForm({ ...form, longDescription: v })}
                multiline
                rows={4}
                placeholder="品牌故事、选品理念，支持换行."
              />
            </FormField>

            <ChipEditor
              label={`标签（最多 ${MAX_TAGS} 个）`}
              placeholder="输入一个标签后点击添加"
              draft={tagDraft}
              onDraftChange={setTagDraft}
              items={form.tags}
              onAdd={(v) =>
                setForm((prev) => ({ ...prev, tags: [...prev.tags, v] }))
              }
              onRemove={(idx) =>
                setForm((prev) => ({
                  ...prev,
                  tags: prev.tags.filter((_, i) => i !== idx),
                }))
              }
              max={MAX_TAGS}
            />

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
              {err && (
                <span className="font-label text-[12px] text-red-600">{err}</span>
              )}
              {savedAt && !err && (
                <span className="font-label text-[11px] text-[color:var(--ink-muted)]">
                  已保存 · {savedAt}
                </span>
              )}
              <Button onClick={onSave} loading={saving}>
                保存
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
              <h2 className="font-label text-[13px] font-semibold text-[var(--ink)]">
                预览提示
              </h2>
              <ul className="mt-3 space-y-2 font-label text-[12px] text-[color:var(--ink-muted)]">
                <li>• 此页保存后，App「买手店 Tab」顶部卡片会立即更新.</li>
                <li>• 未填写任何字段时，前端会使用默认 Mock 数据兜底，不会白屏.</li>
                <li>
                  • 标签超过 6 个时前端仅渲染前 6 个，所以这里限制了上限；如需调整
                  请同步修改前端常量.
                </li>
              </ul>
              <Link
                href={`/stores/${encodeURIComponent(merchant.storeId)}`}
                className="mt-4 inline-flex font-label text-[12px] text-[var(--ink)] underline-offset-2 hover:underline"
              >
                查看店铺页面 →
              </Link>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function configToForm(config: StoreProfileConfig | null | undefined): FormState {
  if (!config) return EMPTY_FORM;
  return {
    logoImage: config.logoImage ?? "",
    coverImage: config.coverImage ?? "",
    shortDescription: config.shortDescription ?? "",
    longDescription: config.longDescription ?? "",
    tags: config.tags ?? [],
  };
}
