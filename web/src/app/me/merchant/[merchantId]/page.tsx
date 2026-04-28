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
import { uploadImage } from "@/lib/services/admin";
import {
  storeMerchantService,
  ACTIVITY_TYPE_LABEL,
  DISCOUNT_TYPE_LABEL,
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

// ───────────────────────────── Tab 配置 ─────────────────────────────

type TabKey = "info" | "banner" | "announcement" | "activity" | "discount";

const TABS: { key: TabKey; label: string }[] = [
  { key: "info", label: "店铺信息" },
  { key: "banner", label: "Banner" },
  { key: "announcement", label: "公告" },
  { key: "activity", label: "活动" },
  { key: "discount", label: "折扣" },
];

const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: "TRUNK_SHOW", label: "Trunk Show" },
  { value: "POP_UP", label: "快闪店" },
  { value: "SALE", label: "特卖会" },
  { value: "EVENT", label: "活动" },
  { value: "OTHER", label: "其他" },
];

const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; label: string }[] = [
  { value: "PERCENTAGE", label: "折扣比例" },
  { value: "FIXED", label: "满减优惠" },
  { value: "SPECIAL", label: "特别优惠" },
];

// ───────────────────────────── 页面 ─────────────────────────────

export default function MerchantManagePage() {
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
            未找到该商家申请
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            可能已被删除, 或不属于当前登录账号.
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
            该商家尚未通过审核
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            当前状态: {merchant.status}. 认证通过后才可管理店铺内容.
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
            商家管理
          </h1>
          <p className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
            店铺 ID: {merchant.storeId}
          </p>
        </div>
        <StatusBadge active>已认证</StatusBadge>
      </header>

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

function BackLink() {
  return (
    <Link
      href="/me/merchant"
      className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
    >
      ← 返回我的店铺
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
  const items = [
    { label: "Banner", enabled: merchant.canPostBanner },
    { label: "公告", enabled: merchant.canPostAnnouncement },
    { label: "活动", enabled: merchant.canPostActivity },
    { label: "折扣", enabled: merchant.canPostDiscount },
  ];

  return (
    <Card title="已开通权限">
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
            {!it.enabled && " · 未开通"}
          </span>
        ))}
      </div>
    </Card>
  );
}

function ContactInfoCard({ merchant }: { merchant: StoreMerchant }) {
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
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="联系信息"
      action={
        !editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            编辑
          </Button>
        ) : null
      }
    >
      {!editing ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          <Info label="联系人" value={merchant.contactName} />
          <Info label="联系电话" value={merchant.contactPhone} />
          <Info label="联系邮箱" value={merchant.contactEmail} />
        </dl>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="联系人姓名">
            <TextInput
              value={form.contactName}
              onChange={(v) => setForm({ ...form, contactName: v })}
            />
          </FormField>
          <FormField label="联系电话">
            <TextInput
              value={form.contactPhone}
              onChange={(v) => setForm({ ...form, contactPhone: v })}
            />
          </FormField>
          <FormField label="联系邮箱">
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
              取消
            </Button>
            <Button onClick={onSave} loading={saving}>
              保存
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function BuyerStoreCard({ merchant }: { merchant: StoreMerchant }) {
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
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!store) {
    return <Card title="店铺信息">正在载入…</Card>;
  }

  return (
    <Card
      title="店铺信息"
      action={
        !editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            编辑
          </Button>
        ) : null
      }
    >
      {!editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="店铺名称" value={store.name} />
          <Info label="所在地" value={`${store.city}, ${store.country}`} />
          <Info label="地址" value={store.address} />
          <Info label="营业时间" value={store.hours} />
          <Info label="休息日" value={store.rest} />
          <Info
            label="联系电话"
            value={store.phone?.length ? store.phone.join(" / ") : undefined}
          />
          {store.description && (
            <div className="sm:col-span-2">
              <Info label="店铺描述" value={store.description} />
            </div>
          )}
          {!!store.brands?.length && (
            <div className="sm:col-span-2">
              <TagList label="销售品牌" values={store.brands} />
            </div>
          )}
          {!!store.style?.length && (
            <div className="sm:col-span-2">
              <TagList label="风格标签" values={store.style} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <FormField label="店铺名称">
            <TextInput
              value={form.name ?? ""}
              onChange={(v) => setForm({ ...form, name: v })}
            />
          </FormField>
          <FormField label="地址">
            <TextInput
              value={form.address ?? ""}
              onChange={(v) => setForm({ ...form, address: v })}
              multiline
              rows={2}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="营业时间">
              <TextInput
                value={form.hours ?? ""}
                onChange={(v) => setForm({ ...form, hours: v })}
                placeholder="例如: 10:00-21:00"
              />
            </FormField>
            <FormField label="休息日">
              <TextInput
                value={form.rest ?? ""}
                onChange={(v) => setForm({ ...form, rest: v })}
                placeholder="例如: 周一休息"
              />
            </FormField>
          </div>
          <FormField label="店铺描述">
            <TextInput
              value={form.description ?? ""}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={3}
            />
          </FormField>

          <ChipEditor
            label="联系电话"
            placeholder="添加电话号码"
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
            label="销售品牌"
            placeholder="添加品牌名称"
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
            label="风格标签"
            placeholder="添加风格标签"
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
              取消
            </Button>
            <Button onClick={onSave} loading={saving}>
              保存
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
          共 {banners.length} 条 Banner
        </div>
        <Button size="sm" onClick={openCreate}>
          + 新建 Banner
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : banners.length === 0 ? (
        <EmptyState message="暂无 Banner, 点击右上角新建." />
      ) : (
        <ul className="grid gap-3">
          {banners.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-3"
            >
              {b.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.imageUrl}
                  alt={b.title || ""}
                  className="h-16 w-28 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1 font-label">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--ink)]">
                    {b.title || "无标题"}
                  </span>
                  <StatusBadge active={b.status === "PUBLISHED"}>
                    {b.status === "PUBLISHED" ? "已发布" : "草稿"}
                  </StatusBadge>
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--ink-muted)]">
                  点击 {b.clickCount} · 曝光 {b.viewCount} · 排序 {b.sortOrder}
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
        title={editing ? "编辑 Banner" : "新建 Banner"}
        onClose={closeDialog}
      >
        <div className="grid gap-4">
          <FormField label="Banner 图片" required>
            <ImagePicker
              value={form.imageUrl}
              onChange={(v) => setForm({ ...form, imageUrl: v })}
              height={150}
            />
          </FormField>
          <FormField label="标题">
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="Banner 标题 (可选)"
            />
          </FormField>
          <FormField label="跳转链接">
            <TextInput
              value={form.linkUrl}
              onChange={(v) => setForm({ ...form, linkUrl: v })}
              placeholder="https://... (可选)"
            />
          </FormField>
          <FormField label="排序">
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
              取消
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={!form.imageUrl}
            >
              {editing ? "保存" : "创建"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除这条 Banner?"
        message="删除后无法恢复."
        confirmLabel="删除"
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
          共 {announcements.length} 条公告
        </div>
        <Button size="sm" onClick={openCreate}>
          + 新建公告
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : announcements.length === 0 ? (
        <EmptyState message="暂无公告, 点击右上角新建." />
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
                        📌 置顶
                      </span>
                    )}
                    <span className="font-serif text-[15px] text-[var(--ink)]">
                      {a.title}
                    </span>
                    <StatusBadge active={a.status === "PUBLISHED"}>
                      {a.status === "PUBLISHED" ? "已发布" : "草稿"}
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
        title={editing ? "编辑公告" : "新建公告"}
        onClose={closeDialog}
      >
        <div className="grid gap-4">
          <FormField label="公告标题" required>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="请输入公告标题"
            />
          </FormField>
          <FormField label="公告内容" required>
            <TextInput
              value={form.content}
              onChange={(v) => setForm({ ...form, content: v })}
              multiline
              rows={5}
              placeholder="请输入公告内容"
            />
          </FormField>
          <Toggle
            checked={form.isPinned}
            onChange={(v) => setForm({ ...form, isPinned: v })}
            label="置顶公告"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={!form.title || !form.content}
            >
              {editing ? "保存" : "发布"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除这条公告?"
        message="删除后无法恢复."
        confirmLabel="删除"
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
          共 {activities.length} 条活动
        </div>
        <Button size="sm" onClick={openCreate}>
          + 新建活动
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : activities.length === 0 ? (
        <EmptyState message="暂无活动, 点击右上角新建." />
      ) : (
        <ul className="grid gap-3">
          {activities.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
            >
              <div className="flex items-start gap-4">
                {a.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.coverImage}
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
                      {ACTIVITY_TYPE_LABEL[a.activityType]}
                    </span>
                    {a.needRegistration && (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)]">
                        报名 {a.registrationCount}
                        {a.registrationLimit ? `/${a.registrationLimit}` : ""}
                      </span>
                    )}
                    <StatusBadge active={a.status === "PUBLISHED"}>
                      {a.status === "PUBLISHED" ? "已发布" : "草稿"}
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
        title={editing ? "编辑活动" : "新建活动"}
        onClose={closeDialog}
        wide
      >
        <div className="grid gap-4">
          <FormField label="封面图片">
            <ImagePicker
              value={form.coverImage}
              onChange={(v) => setForm({ ...form, coverImage: v })}
              height={120}
            />
          </FormField>
          <FormField label="活动标题" required>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="请输入活动标题"
            />
          </FormField>
          <FormField label="活动描述">
            <TextInput
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={3}
              placeholder="请输入活动描述"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="开始时间" required>
              <TextInput
                type="datetime-local"
                value={form.activityStartTime}
                onChange={(v) => setForm({ ...form, activityStartTime: v })}
              />
            </FormField>
            <FormField label="结束时间" required>
              <TextInput
                type="datetime-local"
                value={form.activityEndTime}
                onChange={(v) => setForm({ ...form, activityEndTime: v })}
              />
            </FormField>
          </div>
          <FormField label="活动地点">
            <TextInput
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
            />
          </FormField>
          <FormField label="活动类型">
            <ChipPicker
              options={ACTIVITY_TYPE_OPTIONS}
              value={form.activityType}
              onChange={(v) => setForm({ ...form, activityType: v })}
            />
          </FormField>
          <Toggle
            checked={form.needRegistration}
            onChange={(v) => setForm({ ...form, needRegistration: v })}
            label="需要报名"
          />
          {form.needRegistration && (
            <FormField label="报名人数限制 (留空不限)">
              <TextInput
                type="number"
                value={form.registrationLimit}
                onChange={(v) => setForm({ ...form, registrationLimit: v })}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={
                !form.title || !form.activityStartTime || !form.activityEndTime
              }
            >
              {editing ? "保存" : "发布"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除这个活动?"
        message="删除后无法恢复."
        confirmLabel="删除"
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
          共 {discounts.length} 条折扣
        </div>
        <Button size="sm" onClick={openCreate}>
          + 新建折扣
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : discounts.length === 0 ? (
        <EmptyState message="暂无折扣, 点击右上角新建." />
      ) : (
        <ul className="grid gap-3">
          {discounts.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
            >
              <div className="flex items-start gap-4">
                {d.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.coverImage}
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
                      {DISCOUNT_TYPE_LABEL[d.discountType]}
                    </span>
                    {d.needCode && d.discountCode && (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)]">
                        码: {d.discountCode}
                      </span>
                    )}
                    <StatusBadge active={d.status === "PUBLISHED"}>
                      {d.status === "PUBLISHED" ? "已发布" : "草稿"}
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
        title={editing ? "编辑折扣" : "新建折扣"}
        onClose={closeDialog}
        wide
      >
        <div className="grid gap-4">
          <FormField label="封面图片">
            <ImagePicker
              value={form.coverImage}
              onChange={(v) => setForm({ ...form, coverImage: v })}
              height={120}
            />
          </FormField>
          <FormField label="折扣标题" required>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="如: 春季大促, 会员专享"
            />
          </FormField>
          <FormField label="折扣类型">
            <ChipPicker
              options={DISCOUNT_TYPE_OPTIONS}
              value={form.discountType}
              onChange={(v) => setForm({ ...form, discountType: v })}
            />
          </FormField>
          <FormField label="折扣详情">
            <TextInput
              value={form.discountValue}
              onChange={(v) => setForm({ ...form, discountValue: v })}
              placeholder="如: 8 折, 满 1000 减 200"
            />
          </FormField>
          <FormField label="折扣描述">
            <TextInput
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={3}
              placeholder="描述折扣详情, 适用范围等"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="开始时间" required>
              <TextInput
                type="datetime-local"
                value={form.discountStartTime}
                onChange={(v) => setForm({ ...form, discountStartTime: v })}
              />
            </FormField>
            <FormField label="结束时间" required>
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
            label="需要优惠码"
          />
          {form.needCode && (
            <FormField label="优惠码">
              <TextInput
                value={form.discountCode}
                onChange={(v) => setForm({ ...form, discountCode: v })}
                placeholder="请输入优惠码"
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={
                !form.title || !form.discountStartTime || !form.discountEndTime
              }
            >
              {editing ? "保存" : "发布"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除这条折扣?"
        message="删除后无法恢复."
        confirmLabel="删除"
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
  return (
    <div className="flex shrink-0 gap-1 font-label text-[12px]">
      <button
        onClick={onEdit}
        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
      >
        编辑
      </button>
      <button
        onClick={onDelete}
        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
      >
        删除
      </button>
    </div>
  );
}

function ChipEditor({
  label,
  placeholder,
  draft,
  onDraftChange,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder?: string;
  draft: string;
  onDraftChange: (v: string) => void;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (idx: number) => void;
}) {
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    onDraftChange("");
  };

  return (
    <FormField label={label}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TextInput
            value={draft}
            onChange={onDraftChange}
            placeholder={placeholder}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={commit}>
          添加
        </Button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((it, idx) => (
            <span
              key={`${it}-${idx}`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 font-label text-[12px] text-[var(--ink)]"
            >
              {it}
              <button
                onClick={() => onRemove(idx)}
                className="text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
                aria-label="移除"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </FormField>
  );
}

function ChipPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
            value === o.value
              ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
              : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ImagePicker({
  value,
  onChange,
  height = 120,
}: {
  value: string;
  onChange: (v: string) => void;
  height?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      setErr(null);
      try {
        const url = await uploadImage(file);
        onChange(url);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "上传失败");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className="flex cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-[var(--border)] bg-[var(--canvas)] hover:border-[var(--ink-muted)]"
        style={{ height }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
            {uploading ? "上传中…" : "点击选择图片"}
          </div>
        )}
      </div>
      {value && (
        <div className="mt-2 flex items-center gap-2 font-label text-[11px] text-[color:var(--ink-muted)]">
          <button
            onClick={handleClick}
            className="underline-offset-2 hover:underline"
          >
            更换
          </button>
          <span>·</span>
          <button
            onClick={() => onChange("")}
            className="underline-offset-2 hover:underline"
          >
            清除
          </button>
        </div>
      )}
      {err && (
        <div className="mt-1 font-label text-[11px] text-red-600">{err}</div>
      )}
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
