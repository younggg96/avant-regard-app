"use client";

/**
 * /me/archive/[id] — 档案单品详情。
 *
 * 对齐移动端 `frontend/src/screens/Trading/ArchiveDetailScreen.tsx`：
 * 基本信息 + 持有记录时间线 + 一键转售。
 *
 * 「转售」会用档案信息生成一条 listing 草稿并跳到发布向导继续补齐
 * 7 视角图等硬性字段——后端只建草稿，不会直接上架。
 */

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  StatusBadge,
  TextInput,
  Toggle,
} from "@/components/admin/ui";
import {
  archiveService,
  type ArchiveHoldingStatus,
} from "@/lib/services/archive";
import {
  formatPriceCents,
  parsePriceInputToCents,
} from "@/lib/services/store-product";

const HOLDING_STATUSES: ArchiveHoldingStatus[] = [
  "owned",
  "lent",
  "transferred",
  "resold",
  "returned",
];

export default function ArchiveDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const archiveId = Number(params.id);

  const [resellOpen, setResellOpen] = useState(false);
  const [holdingOpen, setHoldingOpen] = useState(false);

  // 档案没有单条详情接口，从列表里取——档案量级不大，一页就够。
  const { data, isLoading } = useSWR(
    Number.isFinite(archiveId) ? ["archive-item", archiveId] : null,
    async () => {
      const res = await archiveService.list({ page: 1, pageSize: 200 });
      return res.items.find((i) => i.id === archiveId) ?? null;
    },
  );

  const { data: holdings, mutate: mutateHoldings } = useSWR(
    Number.isFinite(archiveId) ? ["archive-holdings", archiveId] : null,
    () => archiveService.listHoldings(archiveId),
  );

  if (isLoading) return <LoadingState />;
  if (!data) {
    return (
      <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("common.loadFailed")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/me/archive"
        className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← {t("trading.archive.title")}
      </Link>

      {data.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.photos.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="aspect-square w-full rounded object-cover"
            />
          ))}
        </div>
      )}

      <section>
        {data.brandName && (
          <p className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {data.brandName}
          </p>
        )}
        <h1 className="mt-1 font-serif text-2xl text-[var(--ink)]">
          {data.title ?? `#${data.id}`}
        </h1>

        <dl className="mt-4 grid grid-cols-2 gap-3 font-label text-[12px] sm:grid-cols-4">
          {data.size && <Detail label={t("trading.publish.size")} value={data.size} />}
          {data.color && (
            <Detail label={t("trading.publish.color")} value={data.color} />
          )}
          {data.condition && (
            <Detail
              label={t("trading.publish.condition")}
              value={data.condition}
            />
          )}
          {data.acquiredPriceCents != null && (
            <Detail
              label={t("trading.archive.acquiredPrice")}
              value={formatPriceCents(data.acquiredPriceCents, data.currency)}
            />
          )}
          {data.acquiredAt && (
            <Detail
              label={t("trading.archive.acquiredAt")}
              value={data.acquiredAt.slice(0, 10)}
            />
          )}
          {data.storageLocation && (
            <Detail
              label={t("trading.archive.storageLocation")}
              value={data.storageLocation}
            />
          )}
        </dl>

        {data.note && (
          <p className="mt-4 font-label text-[13px] leading-relaxed text-[color:var(--ink-muted)]">
            {data.note}
          </p>
        )}
      </section>

      <section className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-5">
        {data.relistedProductId ? (
          <Link
            href={`/me/listings/${data.relistedProductId}/edit`}
            className="inline-flex items-center justify-center rounded border border-[var(--border)] px-4 py-2 font-label text-[13px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            {t("trading.archive.viewRelisted")}
          </Link>
        ) : (
          <Button onClick={() => setResellOpen(true)}>
            {t("trading.archive.resell")}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setHoldingOpen(true)}>
          {t("trading.archive.addHolding")}
        </Button>
      </section>

      <section>
        <h2 className="mb-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.archive.holdings")}
        </h2>
        {!holdings || holdings.length === 0 ? (
          <EmptyState message={t("trading.archive.emptyHoldings")} />
        ) : (
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {holdings.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-label text-[13px] text-[var(--ink)]">
                    {h.heldFrom?.slice(0, 10) ?? "—"} →{" "}
                    {h.heldTo?.slice(0, 10) ?? t("trading.archive.present")}
                  </p>
                  {h.counterpartName && (
                    <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                      {h.counterpartName}
                    </p>
                  )}
                  {h.note && (
                    <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                      {h.note}
                    </p>
                  )}
                </div>
                <StatusBadge active={h.status === "owned"}>
                  {t(`trading.archive.holdingStatus.${h.status}`)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ResellDialog
        open={resellOpen}
        archiveId={archiveId}
        onClose={() => setResellOpen(false)}
      />

      <HoldingDialog
        open={holdingOpen}
        archiveId={archiveId}
        onClose={() => setHoldingOpen(false)}
        onDone={() => mutateHoldings()}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[color:var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function ResellDialog({
  open,
  archiveId,
  onClose,
}: {
  open: boolean;
  archiveId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [priceInput, setPriceInput] = useState("");
  const [description, setDescription] = useState("");
  const [acceptOffer, setAcceptOffer] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await archiveService.resell(archiveId, {
        priceCents: parsePriceInputToCents(priceInput) ?? undefined,
        description: description.trim() || undefined,
        acceptOffer,
      });
      router.push(`/me/listings/${created.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={t("trading.archive.resell")}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <p className="font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
          {t("trading.archive.resellHint")}
        </p>

        <FormField label={t("trading.publish.price")}>
          <TextInput
            value={priceInput}
            onChange={setPriceInput}
            placeholder={t("trading.publish.pricePlaceholder")}
          />
        </FormField>

        <FormField label={t("trading.publish.description")}>
          <TextInput
            value={description}
            onChange={setDescription}
            multiline
            rows={4}
          />
        </FormField>

        <Toggle
          checked={acceptOffer}
          onChange={setAcceptOffer}
          label={t("trading.publish.acceptOfferHint")}
        />

        {error && (
          <p className="font-label text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} loading={submitting}>
            {t("trading.archive.createDraft")}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}

function HoldingDialog({
  open,
  archiveId,
  onClose,
  onDone,
}: {
  open: boolean;
  archiveId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ArchiveHoldingStatus>("owned");
  const [heldFrom, setHeldFrom] = useState("");
  const [heldTo, setHeldTo] = useState("");
  const [counterpartName, setCounterpartName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setStatus("owned");
    setHeldFrom("");
    setHeldTo("");
    setCounterpartName("");
    setNote("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await archiveService.createHolding(archiveId, {
        status,
        heldFrom: heldFrom || undefined,
        heldTo: heldTo || undefined,
        counterpartName: counterpartName.trim() || undefined,
        note: note.trim() || undefined,
      });
      onDone();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={t("trading.archive.addHolding")}
      onClose={close}
    >
      <div className="grid gap-4">
        <FormField label={t("trading.archive.holdingStatusLabel")} required>
          <div className="flex flex-wrap gap-1.5">
            {HOLDING_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
                  status === s
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                    : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
                }`}
              >
                {t(`trading.archive.holdingStatus.${s}`)}
              </button>
            ))}
          </div>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("trading.archive.heldFrom")}>
            <TextInput value={heldFrom} onChange={setHeldFrom} type="date" />
          </FormField>
          <FormField label={t("trading.archive.heldTo")}>
            <TextInput value={heldTo} onChange={setHeldTo} type="date" />
          </FormField>
        </div>

        <FormField label={t("trading.archive.counterpart")}>
          <TextInput value={counterpartName} onChange={setCounterpartName} />
        </FormField>

        <FormField label={t("trading.archive.note")}>
          <TextInput value={note} onChange={setNote} multiline rows={3} />
        </FormField>

        {error && (
          <p className="font-label text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} loading={submitting}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
