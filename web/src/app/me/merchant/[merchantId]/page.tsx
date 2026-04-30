"use client";

/**
 * /me/merchant/[merchantId] — 商家管理中心.
 *
 * 对齐 `frontend/src/screens/MerchantManageScreen.tsx`:
 *   - 5 个 Tab: 店铺信息 / Banner / 公告 / 活动 / 折扣
 *   - 店铺信息 Tab: 查看 + 编辑 商家联系方式 & 公开店铺信息 (name / address /
 *     phone / hours / rest / description / brands / style)
 *   - 其他 4 个 Tab: 列出当前商家发布的内容, 支持 新建 / 编辑 / 删除.
 *     图片走通用上传接口 `/api/files/upload-image`.
 *
 * 入口保护:
 *   - 非当前用户的 merchantId 后端会 403; 我们也在前端对不存在 / 非 APPROVED
 *     状态做友好提示, 不直接白屏.
 *
 * 设计原则:
 *   - 复用 `@/components/admin/ui` 的 FormDialog / TextInput / Toggle 等原语,
 *     避免重复造轮子.
 *   - 乐观 UI 交互: 新建 / 编辑 / 删除后 SWR mutate() 拉最新列表.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  StatusBadge,
  TextInput,
  Toggle,
} from "@/components/admin/ui";
import {
  ChipEditor,
  ChipPicker,
  ImagePicker,
} from "@/components/merchant/shared";
import {
  storeMerchantService,
  type StoreMerchant,
  type MerchantBuyerStore,
  type MerchantBuyerStoreUpdateParams,
  type StoreAnnouncement,
  type StoreBanner,
  type StoreActivity,
  type StoreDiscount,
  type ActivityType,
  type DiscountType,
} from "@/lib/services/store-merchant";

// ───────────────────────────── 图片兜底工具 ─────────────────────────────
//
// 历史脏数据：早期 iOS 客户端走 `MerchantManageScreen.pickImage` 时漏掉
// 了上传步骤，把 `file:///var/mobile/...ImagePicker/xxx.jpg` 这种设备本
// 地路径直接落进了 Banner.imageUrl / Activity.coverImage 等字段。浏览器
// 根本访问不到 file://，结果商家后台列表里就是一堆 broken 小图标（见
// PROGRESS_LOG 2026-04-29 bugfix）。
//
// 主因已经在移动端 + 后端 schema 两侧修好（以后不会再写入），但 DB 里
// 残留的脏数据还是会触发 broken。这里统一一个"能显示吗?"的判断 + 缩略
// 图占位组件，把脏数据静默降级为"图片不可用，请点击编辑重新上传"的文
// 案，避免用户看到破碎图标困惑。

function isDisplayableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

function MerchantThumb({
  url,
  alt,
  className,
}: {
  url: string | null | undefined;
  alt: string;
  className: string;
}) {
  const { t } = useTranslation();
  if (isDisplayableUrl(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url!} alt={alt} className={className} />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center border border-dashed border-[var(--border)] bg-[var(--canvas)] text-center font-label text-[10px] leading-tight text-[color:var(--ink-muted)]`}
    >
      {t("merchant.imageUnavailable")}
      <br />
      {t("merchant.imageReupload")}
    </div>
  );
}

// ───────────────────────────── Tab 配置 ─────────────────────────────

type TabKey = "info" | "banner" | "announcement" | "activity" | "discount";

function useMerchantTabs() {
  const { t } = useTranslation();
  return [
    { key: "info" as TabKey, label: t("merchant.tabInfo") },
    { key: "banner" as TabKey, label: t("merchant.tabBanner") },
    { key: "announcement" as TabKey, label: t("merchant.tabAnnouncement") },
    { key: "activity" as TabKey, label: t("merchant.tabActivity") },
    { key: "discount" as TabKey, label: t("merchant.tabDiscount") },
  ];
}

function useActivityTypeOptions() {
  const { t } = useTranslation();
  return useMemo(() => [
    { value: "TRUNK_SHOW" as const, label: "Trunk Show" },
    { value: "POP_UP" as const, label: t("merchant.activityTypePopUp") },
    { value: "SALE" as const, label: t("merchant.activityTypeSale") },
    { value: "EVENT" as const, label: t("merchant.activityTypeEvent") },
    { value: "OTHER" as const, label: t("merchant.activityTypeOther") },
  ], [t]);
}

function useDiscountTypeOptions() {
  const { t } = useTranslation();
  return useMemo(() => [
    { value: "PERCENTAGE" as const, label: t("merchant.discountTypePercentage") },
    { value: "FIXED" as const, label: t("merchant.discountTypeFixed") },
    { value: "SPECIAL" as const, label: t("merchant.discountTypeSpecial") },
  ], [t]);
}

// ───────────────────────────── 页面 ─────────────────────────────

export default function MerchantManagePage() {
  const { t } = useTranslation();
  const params = useParams<{ merchantId: string }>();
  const merchantId = Number(params?.merchantId);

  const { data: myMerchants, isLoading: loadingMerchants } = useSWR(
    ["my-merchants-manage"],
    () => storeMerchantService.getMyMerchants(1, 50),
  );

  const merchant = useMemo<StoreMerchant | null>(() => {
    if (!myMerchants) return null;
    return myMerchants.merchants.find((m) => m.id === merchantId) ?? null;
  }, [myMerchants, merchantId]);

  const [activeTab, setActiveTab] = useState<TabKey>("info");

  if (loadingMerchants) {
    return <LoadingState />;
  }

  if (!merchant) {
    return (
      <section className="min-w-0">
        <BackLink />
        <div className="mt-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
          <div className="font-serif text-[17px] text-[var(--ink)]">
            {t("merchant.notFound")}
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            {t("merchant.notFoundDesc")}
          </div>
        </div>
      </section>
    );
  }

  if (merchant.status !== "APPROVED") {
    return (
      <section className="min-w-0">
        <BackLink />
        <div className="mt-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
          <div className="font-serif text-[17px] text-[var(--ink)]">
            {t("merchant.notApproved")}
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            {t("merchant.notApprovedDesc", { status: merchant.status })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0">
      <BackLink />

      <header className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="font-serif text-2xl text-black dark:text-white md:text-3xl">
            {t("merchant.management")}
          </h1>
          <p className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
            {t("merchant.storeId", { id: merchant.storeId })}
          </p>
        </div>
        <StatusBadge active>{t("merchant.certified")}</StatusBadge>
      </header>

      <ProductSystemNav merchantId={merchant.id} />

      <TabBar active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "info" && <InfoTab merchant={merchant} />}
        {activeTab === "banner" && <BannerTab merchant={merchant} />}
        {activeTab === "announcement" && (
          <AnnouncementTab merchant={merchant} />
        )}
        {activeTab === "activity" && <ActivityTab merchant={merchant} />}
        {activeTab === "discount" && <DiscountTab merchant={merchant} />}
      </div>
    </section>
  );
}

// ───────────────────────── 商品系统子页导航 ─────────────────────────
//
// 商品系统 (Phase 5) 的 4 组资源和当前页面的 5 个 Tab 是正交关系（入驻
// 认证 vs 商品发布），如果再把它们塞成 Tab 会让当前页扛 9 个 Tab，视觉
// 和代码上都不友好。所以这里把它们做成独立子路由，在主管理页首屏放一
// 行"卡片导航"，clarity > cleverness.

function ProductSystemNav({ merchantId }: { merchantId: number }) {
  const { t } = useTranslation();
  const items = [
    {
      href: `/me/merchant/${merchantId}/profile`,
      title: t("merchant.navProfile"),
      desc: t("merchant.navProfileDesc"),
    },
    {
      href: `/me/merchant/${merchantId}/entry-cards`,
      title: t("merchant.navEntryCards"),
      desc: t("merchant.navEntryCardsDesc"),
    },
    {
      href: `/me/merchant/${merchantId}/categories`,
      title: t("merchant.navCategories"),
      desc: t("merchant.navCategoriesDesc"),
    },
    {
      href: `/me/merchant/${merchantId}/products`,
      title: t("merchant.navProducts"),
      desc: t("merchant.navProductsDesc"),
    },
  ];
  return (
    <div className="mb-6">
      <div className="mb-2 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {t("merchant.productSystem")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="group block rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4 transition-colors hover:border-[var(--ink-muted)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-[15px] text-[var(--ink)]">
                {it.title}
              </span>
              <span className="font-label text-[14px] text-[color:var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]">
                →
              </span>
            </div>
            <div className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
              {it.desc}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      href="/me/merchant"
      className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
    >
      {t("merchant.backToMyStore")}
    </Link>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const TABS = useMerchantTabs();
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--border)] font-label text-[13px]">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-4 py-2 transition-colors ${
            active === t.key
              ? "border-[var(--ink)] text-[var(--ink)]"
              : "border-transparent text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────── Info Tab ─────────────────────────────

function InfoTab({ merchant }: { merchant: StoreMerchant }) {
  return (
    <div className="grid gap-6">
      <PermissionsCard merchant={merchant} />
      <ContactInfoCard merchant={merchant} />
      <BuyerStoreCard merchant={merchant} />
    </div>
  );
}

function PermissionsCard({ merchant }: { merchant: StoreMerchant }) {
  const { t } = useTranslation();
  const items = [
    { label: "Banner", enabled: merchant.canPostBanner },
    { label: t("merchant.tabAnnouncement"), enabled: merchant.canPostAnnouncement },
    { label: t("merchant.tabActivity"), enabled: merchant.canPostActivity },
    { label: t("merchant.tabDiscount"), enabled: merchant.canPostDiscount },
  ];

  return (
    <Card title={t("merchant.permissions")}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it.label}
            className={`inline-flex items-center rounded-full border px-3 py-1 font-label text-[12px] ${
              it.enabled
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                : "border-[var(--border)] text-[color:var(--ink-muted)]"
            }`}
          >
            {it.label}
            {!it.enabled && ` · ${t("merchant.notEnabled")}`}
          </span>
        ))}
      </div>
    </Card>
  );
}

function ContactInfoCard({ merchant }: { merchant: StoreMerchant }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    contactName: merchant.contactName ?? "",
    contactPhone: merchant.contactPhone ?? "",
    contactEmail: merchant.contactEmail ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 商家数据变化时重置表单 (比如另一个 tab 更新后返回)
  useEffect(() => {
    setForm({
      contactName: merchant.contactName ?? "",
      contactPhone: merchant.contactPhone ?? "",
      contactEmail: merchant.contactEmail ?? "",
    });
  }, [merchant]);

  const onSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await storeMerchantService.updateMerchant(merchant.id, form);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={t("merchant.contactInfo")}
      action={
        !editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {t("common.edit")}
          </Button>
        ) : null
      }
    >
      {!editing ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          <Info label={t("merchant.contactName")} value={merchant.contactName} />
          <Info label={t("merchant.contactPhone")} value={merchant.contactPhone} />
          <Info label={t("merchant.contactEmail")} value={merchant.contactEmail} />
        </dl>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("merchant.contactNameLabel")}>
            <TextInput
              value={form.contactName}
              onChange={(v) => setForm({ ...form, contactName: v })}
            />
          </FormField>
          <FormField label={t("merchant.contactPhone")}>
            <TextInput
              value={form.contactPhone}
              onChange={(v) => setForm({ ...form, contactPhone: v })}
            />
          </FormField>
          <FormField label={t("merchant.contactEmail")}>
            <TextInput
              value={form.contactEmail}
              onChange={(v) => setForm({ ...form, contactEmail: v })}
            />
          </FormField>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-2">
            {err && (
              <span className="font-label text-[12px] text-red-600">{err}</span>
            )}
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSave} loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function BuyerStoreCard({ merchant }: { merchant: StoreMerchant }) {
  const { t } = useTranslation();
  const { data: store, mutate } = useSWR(
    ["merchant-buyer-store", merchant.storeId],
    () => storeMerchantService.getBuyerStore(merchant.storeId),
  );

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MerchantBuyerStoreUpdateParams>({});
  const [newPhone, setNewPhone] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newStyle, setNewStyle] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resetForm = useCallback((s: MerchantBuyerStore | null | undefined) => {
    setForm({
      name: s?.name ?? "",
      address: s?.address ?? "",
      phone: s?.phone ?? [],
      hours: s?.hours ?? "",
      description: s?.description ?? "",
      rest: s?.rest ?? "",
      brands: s?.brands ?? [],
      style: s?.style ?? [],
    });
    setNewPhone("");
    setNewBrand("");
    setNewStyle("");
  }, []);

  useEffect(() => {
    if (!editing) resetForm(store);
  }, [store, editing, resetForm]);

  const onSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const next = await storeMerchantService.updateBuyerStore(
        merchant.storeId,
        form,
      );
      await mutate(next, { revalidate: false });
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!store) {
    return <Card title={t("merchant.storeInfo")}>{t("merchant.loading")}</Card>;
  }

  return (
    <Card
      title={t("merchant.storeInfo")}
      action={
        !editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {t("common.edit")}
          </Button>
        ) : null
      }
    >
      {!editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label={t("merchant.storeName")} value={store.name} />
          <Info label={t("merchant.storeLocation")} value={`${store.city}, ${store.country}`} />
          <Info label={t("merchant.storeAddress")} value={store.address} />
          <Info label={t("merchant.businessHours")} value={store.hours} />
          <Info label={t("merchant.restDays")} value={store.rest} />
          <Info
            label={t("merchant.phoneLabel")}
            value={store.phone?.length ? store.phone.join(" / ") : undefined}
          />
          {store.description && (
            <div className="sm:col-span-2">
              <Info label={t("merchant.storeDescription")} value={store.description} />
            </div>
          )}
          {!!store.brands?.length && (
            <div className="sm:col-span-2">
              <TagList label={t("merchant.brandsLabel")} values={store.brands} />
            </div>
          )}
          {!!store.style?.length && (
            <div className="sm:col-span-2">
              <TagList label={t("merchant.styleLabel")} values={store.style} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <FormField label={t("merchant.storeName")}>
            <TextInput
              value={form.name ?? ""}
              onChange={(v) => setForm({ ...form, name: v })}
            />
          </FormField>
          <FormField label={t("merchant.storeAddress")}>
            <TextInput
              value={form.address ?? ""}
              onChange={(v) => setForm({ ...form, address: v })}
              multiline
              rows={2}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("merchant.businessHours")}>
              <TextInput
                value={form.hours ?? ""}
                onChange={(v) => setForm({ ...form, hours: v })}
                placeholder={t("merchant.businessHoursPlaceholder")}
              />
            </FormField>
            <FormField label={t("merchant.restDays")}>
              <TextInput
                value={form.rest ?? ""}
                onChange={(v) => setForm({ ...form, rest: v })}
                placeholder={t("merchant.restDaysPlaceholder")}
              />
            </FormField>
          </div>
          <FormField label={t("merchant.storeDescription")}>
            <TextInput
              value={form.description ?? ""}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={3}
            />
          </FormField>

          <ChipEditor
            label={t("merchant.phoneLabel")}
            placeholder={t("merchant.phonePlaceholder")}
            draft={newPhone}
            onDraftChange={setNewPhone}
            items={form.phone ?? []}
            onAdd={(v) =>
              setForm({ ...form, phone: [...(form.phone ?? []), v] })
            }
            onRemove={(idx) =>
              setForm({
                ...form,
                phone: (form.phone ?? []).filter((_, i) => i !== idx),
              })
            }
          />

          <ChipEditor
            label={t("merchant.brandsLabel")}
            placeholder={t("merchant.brandsPlaceholder")}
            draft={newBrand}
            onDraftChange={setNewBrand}
            items={form.brands ?? []}
            onAdd={(v) =>
              setForm({ ...form, brands: [...(form.brands ?? []), v] })
            }
            onRemove={(idx) =>
              setForm({
                ...form,
                brands: (form.brands ?? []).filter((_, i) => i !== idx),
              })
            }
          />

          <ChipEditor
            label={t("merchant.styleLabel")}
            placeholder={t("merchant.stylePlaceholder")}
            draft={newStyle}
            onDraftChange={setNewStyle}
            items={form.style ?? []}
            onAdd={(v) =>
              setForm({ ...form, style: [...(form.style ?? []), v] })
            }
            onRemove={(idx) =>
              setForm({
                ...form,
                style: (form.style ?? []).filter((_, i) => i !== idx),
              })
            }
          />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {err && (
              <span className="font-label text-[12px] text-red-600">{err}</span>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
                resetForm(store);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={onSave} loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ───────────────────────────── Banner Tab ─────────────────────────────

interface BannerForm {
  title: string;
  imageUrl: string;
  linkUrl: string;
  sortOrder: number;
}

function BannerTab({ merchant }: { merchant: StoreMerchant }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(
    ["merchant-banners", merchant.id],
    () => storeMerchantService.getMerchantBanners(merchant.id),
  );

  const banners = data?.banners ?? [];
  const [editing, setEditing] = useState<StoreBanner | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<BannerForm>({
    title: "",
    imageUrl: "",
    linkUrl: "",
    sortOrder: 0,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreBanner | null>(null);

  const openCreate = () => {
    setForm({ title: "", imageUrl: "", linkUrl: "", sortOrder: 0 });
    setCreating(true);
  };

  const openEdit = (b: StoreBanner) => {
    setForm({
      title: b.title ?? "",
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl ?? "",
      sortOrder: b.sortOrder,
    });
    setEditing(b);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title || undefined,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl || undefined,
        sortOrder: form.sortOrder,
      };
      if (editing) {
        await storeMerchantService.updateBanner(editing.id, payload);
      } else {
        await storeMerchantService.createBanner(merchant.id, payload);
      }
      closeDialog();
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storeMerchantService.deleteBanner(deleteTarget.id);
      setDeleteTarget(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("merchant.bannerCount", { count: banners.length })}
        </div>
        <Button size="sm" onClick={openCreate}>
          {t("merchant.newBanner")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : banners.length === 0 ? (
        <EmptyState message={t("merchant.noBanners")} />
      ) : (
        <ul className="grid gap-3">
          {banners.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-3"
            >
              {b.imageUrl && (
                <MerchantThumb
                  url={b.imageUrl}
                  alt={b.title || ""}
                  className="h-16 w-28 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1 font-label">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--ink)]">
                    {b.title || t("merchant.noTitle")}
                  </span>
                  <StatusBadge active={b.status === "PUBLISHED"}>
                    {b.status === "PUBLISHED" ? t("merchant.published") : t("merchant.draft")}
                  </StatusBadge>
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--ink-muted)]">
                  {t("merchant.bannerStats", { clicks: b.clickCount, views: b.viewCount, sort: b.sortOrder })}
                </div>
              </div>
              <RowActions
                onEdit={() => openEdit(b)}
                onDelete={() => setDeleteTarget(b)}
              />
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={creating || !!editing}
        title={editing ? t("merchant.editBanner") : t("merchant.newBannerTitle")}
        onClose={closeDialog}
      >
        <div className="grid gap-4">
          <FormField label={t("merchant.bannerImage")} required>
            <ImagePicker
              value={form.imageUrl}
              onChange={(v) => setForm({ ...form, imageUrl: v })}
              height={150}
            />
          </FormField>
          <FormField label={t("merchant.titleLabel")}>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder={t("merchant.bannerTitlePlaceholder")}
            />
          </FormField>
          <FormField label={t("merchant.linkUrl")}>
            <TextInput
              value={form.linkUrl}
              onChange={(v) => setForm({ ...form, linkUrl: v })}
              placeholder="https://..."
            />
          </FormField>
          <FormField label={t("merchant.sortOrderLabel")}>
            <TextInput
              value={String(form.sortOrder)}
              onChange={(v) =>
                setForm({ ...form, sortOrder: Number(v) || 0 })
              }
              type="number"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={!form.imageUrl}
            >
              {editing ? t("common.save") : t("merchant.create")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("merchant.deleteBanner")}
        message={t("merchant.deleteIrreversible")}
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ───────────────────────────── Announcement Tab ─────────────────────────────

interface AnnouncementForm {
  title: string;
  content: string;
  isPinned: boolean;
}

function AnnouncementTab({ merchant }: { merchant: StoreMerchant }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(
    ["merchant-announcements", merchant.id],
    () => storeMerchantService.getMerchantAnnouncements(merchant.id),
  );

  const announcements = data?.announcements ?? [];
  const [editing, setEditing] = useState<StoreAnnouncement | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<AnnouncementForm>({
    title: "",
    content: "",
    isPinned: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreAnnouncement | null>(
    null,
  );

  const openCreate = () => {
    setForm({ title: "", content: "", isPinned: false });
    setCreating(true);
  };

  const openEdit = (a: StoreAnnouncement) => {
    setForm({
      title: a.title,
      content: a.content,
      isPinned: a.isPinned,
    });
    setEditing(a);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await storeMerchantService.updateAnnouncement(editing.id, form);
      } else {
        await storeMerchantService.createAnnouncement(merchant.id, form);
      }
      closeDialog();
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storeMerchantService.deleteAnnouncement(deleteTarget.id);
      setDeleteTarget(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("merchant.announcementCount", { count: announcements.length })}
        </div>
        <Button size="sm" onClick={openCreate}>
          {t("merchant.newAnnouncement")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : announcements.length === 0 ? (
        <EmptyState message={t("merchant.noAnnouncements")} />
      ) : (
        <ul className="grid gap-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.isPinned && (
                      <span className="font-label text-[11px] text-[color:var(--ink)]">
                        📌 {t("merchant.pinned")}
                      </span>
                    )}
                    <span className="font-serif text-[15px] text-[var(--ink)]">
                      {a.title}
                    </span>
                    <StatusBadge active={a.status === "PUBLISHED"}>
                      {a.status === "PUBLISHED" ? t("merchant.published") : t("merchant.draft")}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 line-clamp-2 font-serif text-[13px] text-[color:var(--ink-muted)]">
                    {a.content}
                  </p>
                </div>
                <RowActions
                  onEdit={() => openEdit(a)}
                  onDelete={() => setDeleteTarget(a)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={creating || !!editing}
        title={editing ? t("merchant.editAnnouncement") : t("merchant.newAnnouncementTitle")}
        onClose={closeDialog}
      >
        <div className="grid gap-4">
          <FormField label={t("merchant.announcementTitle")} required>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder={t("merchant.announcementTitlePlaceholder")}
            />
          </FormField>
          <FormField label={t("merchant.announcementContent")} required>
            <TextInput
              value={form.content}
              onChange={(v) => setForm({ ...form, content: v })}
              multiline
              rows={5}
              placeholder={t("merchant.announcementContentPlaceholder")}
            />
          </FormField>
          <Toggle
            checked={form.isPinned}
            onChange={(v) => setForm({ ...form, isPinned: v })}
            label={t("merchant.pinAnnouncement")}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={!form.title || !form.content}
            >
              {editing ? t("common.save") : t("merchant.publish")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("merchant.deleteAnnouncement")}
        message={t("merchant.deleteIrreversible")}
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ───────────────────────────── Activity Tab ─────────────────────────────

interface ActivityForm {
  title: string;
  description: string;
  coverImage: string;
  location: string;
  activityType: ActivityType;
  activityStartTime: string;
  activityEndTime: string;
  needRegistration: boolean;
  registrationLimit: string;
}

function ActivityTab({ merchant }: { merchant: StoreMerchant }) {
  const { t } = useTranslation();
  const ACTIVITY_TYPE_OPTIONS = useActivityTypeOptions();
  const { data, isLoading, mutate } = useSWR(
    ["merchant-activities", merchant.id],
    () => storeMerchantService.getMerchantActivities(merchant.id),
  );

  const activities = data?.activities ?? [];
  const [editing, setEditing] = useState<StoreActivity | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ActivityForm>(emptyActivityForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreActivity | null>(null);

  const openCreate = () => {
    setForm(emptyActivityForm());
    setCreating(true);
  };

  const openEdit = (a: StoreActivity) => {
    setForm({
      title: a.title,
      description: a.description ?? "",
      coverImage: a.coverImage ?? "",
      location: a.location ?? "",
      activityType: a.activityType,
      activityStartTime: toLocalDateInput(a.activityStartTime),
      activityEndTime: toLocalDateInput(a.activityEndTime),
      needRegistration: a.needRegistration,
      registrationLimit: a.registrationLimit
        ? String(a.registrationLimit)
        : "",
    });
    setEditing(a);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        coverImage: form.coverImage || undefined,
        location: form.location || undefined,
        activityType: form.activityType,
        activityStartTime: new Date(form.activityStartTime).toISOString(),
        activityEndTime: new Date(form.activityEndTime).toISOString(),
        needRegistration: form.needRegistration,
        registrationLimit: form.registrationLimit
          ? Number(form.registrationLimit)
          : undefined,
      };
      if (editing) {
        await storeMerchantService.updateActivity(editing.id, payload);
      } else {
        await storeMerchantService.createActivity(merchant.id, payload);
      }
      closeDialog();
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storeMerchantService.deleteActivity(deleteTarget.id);
      setDeleteTarget(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("merchant.activityCount", { count: activities.length })}
        </div>
        <Button size="sm" onClick={openCreate}>
          {t("merchant.newActivity")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : activities.length === 0 ? (
        <EmptyState message={t("merchant.noActivities")} />
      ) : (
        <ul className="grid gap-3">
          {activities.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
            >
              <div className="flex items-start gap-4">
                {a.coverImage && (
                  <MerchantThumb
                    url={a.coverImage}
                    alt={a.title}
                    className="h-20 w-28 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 font-label">
                  <div className="font-serif text-[15px] text-[var(--ink)]">
                    {a.title}
                  </div>
                  <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                    {new Date(a.activityStartTime).toLocaleDateString("zh-CN")}{" "}
                    →{" "}
                    {new Date(a.activityEndTime).toLocaleDateString("zh-CN")}
                  </div>
                  {a.location && (
                    <div className="text-[12px] text-[color:var(--ink-muted)]">
                      📍 {a.location}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)]">
                      {ACTIVITY_TYPE_OPTIONS.find((o) => o.value === a.activityType)?.label ?? a.activityType}
                    </span>
                    {a.needRegistration && (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)]">
                        {t("merchant.registrationCount", { count: a.registrationCount })}
                        {a.registrationLimit ? `/${a.registrationLimit}` : ""}
                      </span>
                    )}
                    <StatusBadge active={a.status === "PUBLISHED"}>
                      {a.status === "PUBLISHED" ? t("merchant.published") : t("merchant.draft")}
                    </StatusBadge>
                  </div>
                </div>
                <RowActions
                  onEdit={() => openEdit(a)}
                  onDelete={() => setDeleteTarget(a)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={creating || !!editing}
        title={editing ? t("merchant.editActivity") : t("merchant.newActivityTitle")}
        onClose={closeDialog}
        wide
      >
        <div className="grid gap-4">
          <FormField label={t("merchant.coverImage")}>
            <ImagePicker
              value={form.coverImage}
              onChange={(v) => setForm({ ...form, coverImage: v })}
              height={120}
            />
          </FormField>
          <FormField label={t("merchant.activityTitle")} required>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder={t("merchant.activityTitlePlaceholder")}
            />
          </FormField>
          <FormField label={t("merchant.activityDescription")}>
            <TextInput
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={3}
              placeholder={t("merchant.activityDescPlaceholder")}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("merchant.startTime")} required>
              <TextInput
                type="datetime-local"
                value={form.activityStartTime}
                onChange={(v) => setForm({ ...form, activityStartTime: v })}
              />
            </FormField>
            <FormField label={t("merchant.endTime")} required>
              <TextInput
                type="datetime-local"
                value={form.activityEndTime}
                onChange={(v) => setForm({ ...form, activityEndTime: v })}
              />
            </FormField>
          </div>
          <FormField label={t("merchant.activityLocation")}>
            <TextInput
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
            />
          </FormField>
          <FormField label={t("merchant.activityType")}>
            <ChipPicker
              options={ACTIVITY_TYPE_OPTIONS}
              value={form.activityType}
              onChange={(v) => setForm({ ...form, activityType: v })}
            />
          </FormField>
          <Toggle
            checked={form.needRegistration}
            onChange={(v) => setForm({ ...form, needRegistration: v })}
            label={t("merchant.needRegistration")}
          />
          {form.needRegistration && (
            <FormField label={t("merchant.registrationLimit")}>
              <TextInput
                type="number"
                value={form.registrationLimit}
                onChange={(v) => setForm({ ...form, registrationLimit: v })}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={
                !form.title || !form.activityStartTime || !form.activityEndTime
              }
            >
              {editing ? t("common.save") : t("merchant.publish")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("merchant.deleteActivity")}
        message={t("merchant.deleteIrreversible")}
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function emptyActivityForm(): ActivityForm {
  const now = new Date();
  const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    coverImage: "",
    location: "",
    activityType: "EVENT",
    activityStartTime: toLocalDateInput(now.toISOString()),
    activityEndTime: toLocalDateInput(later.toISOString()),
    needRegistration: false,
    registrationLimit: "",
  };
}

// ───────────────────────────── Discount Tab ─────────────────────────────

interface DiscountForm {
  title: string;
  description: string;
  coverImage: string;
  discountType: DiscountType;
  discountValue: string;
  discountStartTime: string;
  discountEndTime: string;
  needCode: boolean;
  discountCode: string;
}

function DiscountTab({ merchant }: { merchant: StoreMerchant }) {
  const { t } = useTranslation();
  const DISCOUNT_TYPE_OPTIONS = useDiscountTypeOptions();
  const { data, isLoading, mutate } = useSWR(
    ["merchant-discounts", merchant.id],
    () => storeMerchantService.getMerchantDiscounts(merchant.id),
  );

  const discounts = data?.discounts ?? [];
  const [editing, setEditing] = useState<StoreDiscount | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DiscountForm>(emptyDiscountForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreDiscount | null>(null);

  const openCreate = () => {
    setForm(emptyDiscountForm());
    setCreating(true);
  };

  const openEdit = (d: StoreDiscount) => {
    setForm({
      title: d.title,
      description: d.description ?? "",
      coverImage: d.coverImage ?? "",
      discountType: d.discountType,
      discountValue: d.discountValue ?? "",
      discountStartTime: toLocalDateInput(d.discountStartTime),
      discountEndTime: toLocalDateInput(d.discountEndTime),
      needCode: d.needCode,
      discountCode: d.discountCode ?? "",
    });
    setEditing(d);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        coverImage: form.coverImage || undefined,
        discountType: form.discountType,
        discountValue: form.discountValue || undefined,
        discountStartTime: new Date(form.discountStartTime).toISOString(),
        discountEndTime: new Date(form.discountEndTime).toISOString(),
        needCode: form.needCode,
        discountCode: form.needCode ? form.discountCode || undefined : undefined,
      };
      if (editing) {
        await storeMerchantService.updateDiscount(editing.id, payload);
      } else {
        await storeMerchantService.createDiscount(merchant.id, payload);
      }
      closeDialog();
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storeMerchantService.deleteDiscount(deleteTarget.id);
      setDeleteTarget(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("merchant.discountCount", { count: discounts.length })}
        </div>
        <Button size="sm" onClick={openCreate}>
          {t("merchant.newDiscount")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : discounts.length === 0 ? (
        <EmptyState message={t("merchant.noDiscounts")} />
      ) : (
        <ul className="grid gap-3">
          {discounts.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
            >
              <div className="flex items-start gap-4">
                {d.coverImage && (
                  <MerchantThumb
                    url={d.coverImage}
                    alt={d.title}
                    className="h-20 w-28 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 font-label">
                  <div className="font-serif text-[15px] text-[var(--ink)]">
                    {d.title}
                  </div>
                  {d.discountValue && (
                    <div className="mt-1 font-serif text-[16px] font-semibold text-[var(--ink)]">
                      {d.discountValue}
                    </div>
                  )}
                  <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                    {new Date(d.discountStartTime).toLocaleDateString("zh-CN")}{" "}
                    →{" "}
                    {new Date(d.discountEndTime).toLocaleDateString("zh-CN")}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)]">
                      {DISCOUNT_TYPE_OPTIONS.find((o) => o.value === d.discountType)?.label ?? d.discountType}
                    </span>
                    {d.needCode && d.discountCode && (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)]">
                        {t("merchant.code")}: {d.discountCode}
                      </span>
                    )}
                    <StatusBadge active={d.status === "PUBLISHED"}>
                      {d.status === "PUBLISHED" ? t("merchant.published") : t("merchant.draft")}
                    </StatusBadge>
                  </div>
                </div>
                <RowActions
                  onEdit={() => openEdit(d)}
                  onDelete={() => setDeleteTarget(d)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={creating || !!editing}
        title={editing ? t("merchant.editDiscount") : t("merchant.newDiscountTitle")}
        onClose={closeDialog}
        wide
      >
        <div className="grid gap-4">
          <FormField label={t("merchant.coverImage")}>
            <ImagePicker
              value={form.coverImage}
              onChange={(v) => setForm({ ...form, coverImage: v })}
              height={120}
            />
          </FormField>
          <FormField label={t("merchant.discountTitle")} required>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder={t("merchant.discountTitlePlaceholder")}
            />
          </FormField>
          <FormField label={t("merchant.discountType")}>
            <ChipPicker
              options={DISCOUNT_TYPE_OPTIONS}
              value={form.discountType}
              onChange={(v) => setForm({ ...form, discountType: v })}
            />
          </FormField>
          <FormField label={t("merchant.discountDetails")}>
            <TextInput
              value={form.discountValue}
              onChange={(v) => setForm({ ...form, discountValue: v })}
              placeholder={t("merchant.discountDetailsPlaceholder")}
            />
          </FormField>
          <FormField label={t("merchant.discountDescription")}>
            <TextInput
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={3}
              placeholder={t("merchant.discountDescPlaceholder")}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("merchant.startTime")} required>
              <TextInput
                type="datetime-local"
                value={form.discountStartTime}
                onChange={(v) => setForm({ ...form, discountStartTime: v })}
              />
            </FormField>
            <FormField label={t("merchant.endTime")} required>
              <TextInput
                type="datetime-local"
                value={form.discountEndTime}
                onChange={(v) => setForm({ ...form, discountEndTime: v })}
              />
            </FormField>
          </div>
          <Toggle
            checked={form.needCode}
            onChange={(v) => setForm({ ...form, needCode: v })}
            label={t("merchant.needCode")}
          />
          {form.needCode && (
            <FormField label={t("merchant.discountCode")}>
              <TextInput
                value={form.discountCode}
                onChange={(v) => setForm({ ...form, discountCode: v })}
                placeholder={t("merchant.discountCodePlaceholder")}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={
                !form.title || !form.discountStartTime || !form.discountEndTime
              }
            >
              {editing ? t("common.save") : t("merchant.publish")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("merchant.deleteDiscount")}
        message={t("merchant.deleteIrreversible")}
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function emptyDiscountForm(): DiscountForm {
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    coverImage: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    discountStartTime: toLocalDateInput(now.toISOString()),
    discountEndTime: toLocalDateInput(later.toISOString()),
    needCode: false,
    discountCode: "",
  };
}

// ───────────────────────────── 共用小组件 ─────────────────────────────

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-label text-[13px] font-semibold text-[var(--ink)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap font-serif text-[13px] text-[var(--ink)]">
        {value || "—"}
      </dd>
    </div>
  );
}

function TagList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center rounded-full border border-[var(--border)] px-2.5 py-0.5 font-label text-[12px] text-[var(--ink)]"
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 gap-1 font-label text-[12px]">
      <button
        onClick={onEdit}
        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
      >
        {t("common.edit")}
      </button>
      <button
        onClick={onDelete}
        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
      >
        {t("common.delete")}
      </button>
    </div>
  );
}

// ISO → datetime-local 输入值 (本地时区)
function toLocalDateInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
