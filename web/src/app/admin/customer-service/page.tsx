"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { customerServiceApi, type AutoReplyConfig } from "@/lib/services/admin";
import {
  PageHeader,
  FormField,
  TextInput,
  Toggle,
  Button,
  LoadingState,
} from "@/components/admin/ui";


export default function CustomerServicePage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AutoReplyConfig>({ enabled: false, message: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerServiceApi.getAutoReply();
      setConfig(data);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (partial: Partial<AutoReplyConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await customerServiceApi.updateAutoReply(config);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title={t("admin.customerService")} description={t("admin.csDesc")} />

      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-lg border border-[var(--border)] p-5">
          <Toggle
            checked={config.enabled}
            onChange={(v) => update({ enabled: v })}
            label={t("admin.enableAutoReply")}
          />
          <p className="mt-2 font-label text-[12px] text-[color:var(--ink-muted)]">
            {t("admin.autoReplyNote")}
          </p>
        </div>

        <FormField label={t("admin.autoReplyContent")}>
          <TextInput
            value={config.message}
            onChange={(v) => update({ message: v })}
            multiline
            rows={5}
            placeholder={t("admin.autoReplyPlaceholder")}
          />
        </FormField>

        <FormField label={t("admin.csEmail")}>
          <TextInput
            value={config.email}
            onChange={(v) => update({ email: v })}
            placeholder="support@example.com"
            type="email"
          />
        </FormField>

        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          {t("admin.saveSettings")}
        </Button>
      </div>
    </div>
  );
}
