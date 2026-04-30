"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { maintenanceApi, type MaintenanceConfig } from "@/lib/services/admin";
import {
  PageHeader,
  FormField,
  TextInput,
  Toggle,
  Button,
  LoadingState,
} from "@/components/admin/ui";


export default function MaintenancePage() {
  const { t } = useTranslation();
  const DEFAULT_MESSAGE = t("admin.maintenanceDefaultMsg");

  const [config, setConfig] = useState<MaintenanceConfig>({ enabled: false, message: "" });
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await maintenanceApi.getConfig();
      setConfig(data);
      setMessageInput(data.message || DEFAULT_MESSAGE);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabled }));
    setDirty(true);
  };

  const handleMessageChange = (msg: string) => {
    setMessageInput(msg);
    setDirty(true);
  };

  const handleResetMessage = () => {
    setMessageInput(DEFAULT_MESSAGE);
    setDirty(true);
  };

  const handleSave = async () => {
    if (config.enabled && !messageInput.trim()) {
      alert(t("admin.maintenanceRequired"));
      return;
    }
    setSaving(true);
    try {
      await maintenanceApi.updateConfig({
        enabled: config.enabled,
        message: messageInput.trim(),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title={t("admin.maintenance")} description={t("admin.maintenanceDesc")} />

      <div className="mx-auto max-w-lg space-y-6">
        {config.enabled && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
            <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
              {t("admin.maintenanceOn")}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-[var(--border)] p-5">
          <Toggle
            checked={config.enabled}
            onChange={handleToggle}
            label={t("admin.enableMaintenance")}
          />
          <p className="mt-2 font-label text-[12px] text-[color:var(--ink-muted)]">
            {t("admin.maintenanceNote")}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-label text-[12px] font-medium text-[color:var(--ink-muted)]">
              {t("admin.maintenanceMsg")}
            </label>
            <button
              onClick={handleResetMessage}
              className="flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            >
              {t("admin.resetDefault")}
            </button>
          </div>
          <TextInput
            value={messageInput}
            onChange={handleMessageChange}
            multiline
            rows={5}
            placeholder={t("admin.maintenanceMsgPlaceholder")}
          />
          <p className="mt-1 text-right font-label text-[11px] text-[color:var(--ink-muted)]">
            {messageInput.length} / 500
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4 font-label text-[12px] text-[color:var(--ink-muted)]">
          <p className="mb-1 text-[11px] uppercase tracking-wider">{t("admin.tips")}</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>{t("admin.maintenanceTip1")}</li>
            <li>{t("admin.maintenanceTip2")}</li>
            <li>{t("admin.maintenanceTip3")}</li>
          </ul>
        </div>

        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          {t("admin.saveSettings")}
        </Button>
      </div>
    </div>
  );
}
