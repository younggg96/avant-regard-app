"use client";

import { useEffect, useState, useCallback } from "react";
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
      <PageHeader title="客服设置" description="配置自动回复消息和客服邮箱" />

      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-lg border border-[var(--border)] p-5">
          <Toggle
            checked={config.enabled}
            onChange={(v) => update({ enabled: v })}
            label="启用自动回复"
          />
          <p className="mt-2 font-label text-[12px] text-[color:var(--ink-muted)]">
            开启后，用户发送私信时将自动收到以下回复。
          </p>
        </div>

        <FormField label="自动回复内容">
          <TextInput
            value={config.message}
            onChange={(v) => update({ message: v })}
            multiline
            rows={5}
            placeholder="输入自动回复内容…"
          />
        </FormField>

        <FormField label="客服邮箱">
          <TextInput
            value={config.email}
            onChange={(v) => update({ email: v })}
            placeholder="support@example.com"
            type="email"
          />
        </FormField>

        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          保存设置
        </Button>
      </div>
    </div>
  );
}
