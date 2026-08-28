"use client";

/**
 * /me/kyc — 实名认证。
 *
 * 对齐移动端 `frontend/src/screens/Trading/KycVerificationScreen.tsx`，两条通道：
 *   - 中国大陆：姓名 + 身份证号二要素，后端同步返回结果；
 *   - 海外：Stripe Identity 托管页（证件影像 + 活体自拍），
 *     web 上新开标签页完成，回来后同步会话状态。
 *
 * 移动端按 App variant 自动判断走哪条，web 没有 variant 概念，
 * 所以让用户显式选一次证件地区。
 *
 * 实名是上架单品与提现的前置条件，通过后不需要再来。
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";
import { ImagePicker } from "@/components/merchant/shared";
import { kycService } from "@/lib/services/kyc";
import { formatKycStatus } from "@/lib/services/wallet";

type Region = "CN" | "US";

export default function KycPage() {
  const { t } = useTranslation();
  const [region, setRegion] = useState<Region>("CN");

  const { data: record, isLoading, mutate } = useSWR("my-kyc", () =>
    kycService.getMyKyc(),
  );

  if (isLoading) return <LoadingState />;

  const approved = record?.status === "approved";

  return (
    <div>
      <Link
        href="/me/wallet"
        className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← {t("trading.wallet.title")}
      </Link>
      <div className="mt-4">
        <PageHeader
          title={t("trading.kyc.title")}
          description={t("trading.kyc.desc")}
          actions={
            record && (
              <StatusBadge active={approved}>
                {formatKycStatus(record.status, t)}
              </StatusBadge>
            )
          }
        />
      </div>

      {record?.status === "rejected" && record.rejectReason && (
        <p className="mb-5 rounded border border-[var(--border)] p-3 font-label text-[12px] text-red-600 dark:text-red-400">
          {record.rejectReason}
        </p>
      )}

      {approved ? (
        <section className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
          <p className="font-label text-[13px] text-[var(--ink)]">
            {t("trading.kyc.approvedTitle")}
          </p>
          <dl className="mt-3 space-y-1 font-label text-[12px] text-[color:var(--ink-muted)]">
            {record.realName && (
              <div className="flex gap-2">
                <dt>{t("trading.kyc.realName")}</dt>
                <dd className="text-[var(--ink)]">{record.realName}</dd>
              </div>
            )}
            {record.idCardMasked && (
              <div className="flex gap-2">
                <dt>{t("trading.kyc.idCardNo")}</dt>
                <dd className="text-[var(--ink)]">{record.idCardMasked}</dd>
              </div>
            )}
            {record.verifiedCountry && (
              <div className="flex gap-2">
                <dt>{t("trading.kyc.verifiedCountry")}</dt>
                <dd className="text-[var(--ink)]">{record.verifiedCountry}</dd>
              </div>
            )}
          </dl>
        </section>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-1.5">
            {(["CN", "US"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
                  region === r
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                    : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
                }`}
              >
                {t(`trading.kyc.region_${r}`)}
              </button>
            ))}
          </div>

          {region === "CN" ? (
            <CnVerifyForm onDone={() => mutate()} />
          ) : (
            <HostedVerifyPanel onDone={() => mutate()} />
          )}
        </>
      )}
    </div>
  );
}

function CnVerifyForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [realName, setRealName] = useState("");
  const [idCardNo, setIdCardNo] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    if (!realName.trim() || !idCardNo.trim()) {
      setError(t("trading.kyc.identityRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      // 证件照与联系方式是人工复核的补充材料，先落库；
      // 二要素本身才是决定 approved/pending 的那一步。
      if (frontUrl || backUrl || contactPhone.trim()) {
        await kycService.submitKyc({
          realName: realName.trim(),
          idCardNo: idCardNo.trim(),
          idCardFrontUrl: frontUrl || undefined,
          idCardBackUrl: backUrl || undefined,
          contactPhone: contactPhone.trim() || undefined,
        });
      }
      const result = await kycService.verifyIdentityAuto({
        realName: realName.trim(),
        idCardNo: idCardNo.trim(),
      });
      onDone();
      if (result.status !== "approved") {
        setInfo(result.rejectReason || t("trading.kyc.pendingReview"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid max-w-xl gap-5">
      <FormField label={t("trading.kyc.realName")} required>
        <TextInput value={realName} onChange={setRealName} />
      </FormField>

      <FormField label={t("trading.kyc.idCardNo")} required>
        <TextInput value={idCardNo} onChange={setIdCardNo} />
      </FormField>

      <FormField label={t("trading.phone")}>
        <TextInput value={contactPhone} onChange={setContactPhone} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("trading.kyc.idCardFront")}>
          <ImagePicker value={frontUrl} onChange={setFrontUrl} height={140} />
        </FormField>
        <FormField label={t("trading.kyc.idCardBack")}>
          <ImagePicker value={backUrl} onChange={setBackUrl} height={140} />
        </FormField>
      </div>

      {error && (
        <p className="font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {info && (
        <p className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {info}
        </p>
      )}

      <div>
        <Button onClick={submit} loading={submitting}>
          {t("trading.kyc.submitVerification")}
        </Button>
      </div>

      <p className="font-label text-[11px] leading-relaxed text-[color:var(--ink-muted)]">
        {t("trading.kyc.privacyNote")}
      </p>
    </div>
  );
}

function HostedVerifyPanel({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [starting, setStarting] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const session = await kycService.startIdentitySession({ region: "US" });
      if (session.url) {
        window.open(session.url, "_blank", "noopener,noreferrer");
        setOpened(true);
      } else {
        // mock provider 会直接返回 verified，没有托管页可跳。
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setStarting(false);
    }
  };

  const refresh = async () => {
    try {
      await kycService.refreshIdentitySession();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <p className="font-label text-[13px] leading-relaxed text-[color:var(--ink-muted)]">
        {t("trading.kyc.hostedDesc")}
      </p>

      {error && (
        <p className="font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={start} loading={starting}>
          {t("trading.kyc.startHosted")}
        </Button>
        {opened && (
          <Button variant="secondary" onClick={refresh}>
            {t("trading.refreshStatus")}
          </Button>
        )}
      </div>

      <p className="font-label text-[11px] leading-relaxed text-[color:var(--ink-muted)]">
        {t("trading.kyc.hostedNewTabHint")}
      </p>
    </div>
  );
}
