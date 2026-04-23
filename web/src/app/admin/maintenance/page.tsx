"use client";

import { useEffect, useState, useCallback } from "react";
import { maintenanceApi, type MaintenanceConfig } from "@/lib/services/admin";
import {
  PageHeader,
  FormField,
  TextInput,
  Toggle,
  Button,
  LoadingState,
} from "@/components/admin/ui";


const DEFAULT_MESSAGE = "服务器正在维护中，请稍后再试。\n我们正在努力恢复服务，给您带来不便深表歉意。";

export default function MaintenancePage() {
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
      alert("维护模式开启时需要提供维护提示信息");
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
      <PageHeader title="维护模式" description="控制应用的维护状态，开启后所有用户将看到维护提示" />

      <div className="mx-auto max-w-lg space-y-6">
        {config.enabled && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
            <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
              维护模式已开启，所有用户将看到维护提示页面。
            </p>
          </div>
        )}

        <div className="rounded-lg border border-[var(--border)] p-5">
          <Toggle
            checked={config.enabled}
            onChange={handleToggle}
            label="开启维护模式"
          />
          <p className="mt-2 font-label text-[12px] text-[color:var(--ink-muted)]">
            开启后，APP 和网站将显示维护页面，所有功能暂停。
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-label text-[12px] font-medium text-[color:var(--ink-muted)]">
              维护提示信息
            </label>
            <button
              onClick={handleResetMessage}
              className="flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            >
              恢复默认
            </button>
          </div>
          <TextInput
            value={messageInput}
            onChange={handleMessageChange}
            multiline
            rows={5}
            placeholder="输入维护提示信息…"
          />
          <p className="mt-1 text-right font-label text-[11px] text-[color:var(--ink-muted)]">
            {messageInput.length} / 500
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4 font-label text-[12px] text-[color:var(--ink-muted)]">
          <p className="mb-1 text-[11px] uppercase tracking-wider">提示</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>维护模式开启后，502/503 响应也会触发维护提示</li>
            <li>管理员仍可正常使用后台功能</li>
            <li>关闭维护模式后，客户端最多 20 秒后自动恢复</li>
          </ul>
        </div>

        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          保存设置
        </Button>
      </div>
    </div>
  );
}
