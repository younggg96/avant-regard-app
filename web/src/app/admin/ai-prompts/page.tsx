"use client";

/**
 * Admin: AI Prompt 运行时管理 (V3 #25.5)
 *
 * 提供两条 system prompt 的查看/编辑/重置/拼装预览。
 *
 * 流程:
 *   load → list 出 N 条 (qa_system / image_brief_system)
 *   每条独立编辑区: textarea + 保存 / 重置回默认 / 看默认值
 *   预览按钮: 把当前 textarea 里未保存的内容 + 真实 fixture 拼成完整 messages,
 *            后端不打 LLM, 仅返回拼装结果, 帮 admin 在保存前确认效果。
 *
 * 改动即时生效: 后端保存后会清 30s 缓存, 下一次 generate 立即用新版。
 * 删除 (重置) 走 ON DELETE 回到 hardcoded default, 不可逆 (但 default 一直在代码里)。
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  aiPromptsApi,
  type AIPromptKey,
  type AdminAIPromptItem,
  type AdminAIPromptPreviewResponse,
} from "@/lib/services/admin";
import {
  PageHeader,
  LoadingState,
  ConfirmDialog,
  TextInput,
  Button,
} from "@/components/admin/ui";

interface DraftState {
  /** key → 用户当前在 textarea 里编辑的内容 */
  content: Record<AIPromptKey, string>;
  /** key → notes (备忘) */
  notes: Record<AIPromptKey, string>;
  /** key → "正在 saving" 锁 */
  saving: Record<AIPromptKey, boolean>;
  /** key → "正在 reset" 锁 */
  resetting: Record<AIPromptKey, boolean>;
  /** key → 是否展开 default 折叠区 */
  expandDefault: Record<AIPromptKey, boolean>;
}

const EMPTY_DRAFT: DraftState = {
  content: { qa_system: "", image_brief_system: "" },
  notes: { qa_system: "", image_brief_system: "" },
  saving: { qa_system: false, image_brief_system: false },
  resetting: { qa_system: false, image_brief_system: false },
  expandDefault: { qa_system: false, image_brief_system: false },
};

export default function AdminAIPromptsPage() {
  const { t } = useTranslation();

  const [items, setItems] = useState<AdminAIPromptItem[]>([]);
  const [promptVersion, setPromptVersion] = useState<string>("");
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 预览面板
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResp, setPreviewResp] = useState<AdminAIPromptPreviewResponse | null>(null);

  // 重置确认弹窗
  const [resetTarget, setResetTarget] = useState<AIPromptKey | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const resp = await aiPromptsApi.list();
      setItems(resp.items);
      setPromptVersion(resp.prompt_version);
      // 把后端 current 灌入 draft 的 textarea, 用户没动过就保持与 current 同步
      setDraft((d) => {
        const next = { ...d };
        for (const it of resp.items) {
          next.content = { ...next.content, [it.key]: it.current };
          next.notes = { ...next.notes, [it.key]: it.notes ?? "" };
        }
        return next;
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setDraftField = <K extends keyof DraftState>(
    field: K,
    key: AIPromptKey,
    value: DraftState[K][AIPromptKey],
  ) => {
    setDraft((d) => ({ ...d, [field]: { ...d[field], [key]: value } }));
  };

  const handleSave = async (key: AIPromptKey) => {
    const content = draft.content[key].trim();
    if (content.length < 10) {
      alert(t("admin.aiPrompts.contentTooShort"));
      return;
    }
    setDraftField("saving", key, true);
    try {
      await aiPromptsApi.update(key, {
        content,
        notes: draft.notes[key]?.trim() || undefined,
      });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftField("saving", key, false);
    }
  };

  const handleResetConfirm = async () => {
    if (!resetTarget) return;
    const key = resetTarget;
    setResetTarget(null);
    setDraftField("resetting", key, true);
    try {
      await aiPromptsApi.reset(key);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftField("resetting", key, false);
    }
  };

  /** 用 textarea 当前 *未保存* 的值预览。后端用 fixture 拼出完整 messages。 */
  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const resp = await aiPromptsApi.preview({
        qa_system_override: draft.content.qa_system,
        image_brief_system_override: draft.content.image_brief_system,
      });
      setPreviewResp(resp);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <>
        <PageHeader title={t("admin.aiPrompts.title")} description={t("admin.aiPrompts.subtitle")} />
        <LoadingState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("admin.aiPrompts.title")}
        description={t("admin.aiPrompts.subtitle")}
      />

      {errorMsg && (
        <div className="mb-4 rounded border border-[var(--border)] bg-[var(--canvas-raised)] p-3 font-label text-[12px] text-[color:var(--ink-muted)]">
          {errorMsg}
        </div>
      )}

      {/* 顶部状态条 */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded border border-[var(--border)] bg-[var(--canvas-raised)] px-4 py-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        <span>
          {t("admin.aiPrompts.promptVersion")}:
          <span className="ml-1.5 font-mono text-[var(--ink)]">{promptVersion}</span>
        </span>
        <span className="text-[color:var(--ink-muted)]">·</span>
        <span>{t("admin.aiPrompts.cacheHint")}</span>
        <div className="ml-auto">
          <Button onClick={handlePreview} variant="secondary" loading={previewLoading}>
            {t("admin.aiPrompts.previewBtn")}
          </Button>
        </div>
      </div>

      {/* 每条 prompt 一个独立卡片 */}
      <div className="flex flex-col gap-6">
        {items.map((item) => {
          const draftContent = draft.content[item.key] ?? item.current;
          const dirty = draftContent.trim() !== item.current.trim();
          const matchesDefault = draftContent.trim() === item.default.trim();

          return (
            <section
              key={item.key}
              className="rounded border border-[var(--border)] bg-[var(--canvas)] p-5"
            >
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-label text-[14px] font-semibold text-[var(--ink)]">
                  {item.label}
                </h2>
                <span className="font-mono text-[10px] text-[color:var(--ink-muted)]">
                  {item.key}
                </span>
                {item.is_overridden ? (
                  <span className="rounded bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--canvas)]">
                    {t("admin.aiPrompts.overridden")}
                  </span>
                ) : (
                  <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink-muted)]">
                    {t("admin.aiPrompts.usingDefault")}
                  </span>
                )}
              </div>

              <p className="mb-3 font-label text-[12px] text-[color:var(--ink-muted)]">
                {item.description}
              </p>

              {/* 编辑区 */}
              <div className="mb-3">
                <TextInput
                  value={draftContent}
                  onChange={(v) => setDraftField("content", item.key, v)}
                  multiline
                  rows={12}
                  placeholder={t("admin.aiPrompts.contentPlaceholder")}
                />
              </div>

              {/* 备忘 */}
              <div className="mb-3">
                <label className="mb-1 block font-label text-[11px] text-[color:var(--ink-muted)]">
                  {t("admin.aiPrompts.notesLabel")}
                </label>
                <TextInput
                  value={draft.notes[item.key] ?? ""}
                  onChange={(v) => setDraftField("notes", item.key, v)}
                  placeholder={t("admin.aiPrompts.notesPlaceholder")}
                />
              </div>

              {/* 元数据 + 操作 */}
              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3 font-label text-[11px] text-[color:var(--ink-muted)]">
                {item.updated_at && (
                  <span>
                    {t("admin.aiPrompts.lastUpdated")}:{" "}
                    {new Date(item.updated_at).toLocaleString()}
                    {item.updated_by ? ` · uid ${item.updated_by}` : ""}
                  </span>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraftField("expandDefault", item.key, !draft.expandDefault[item.key])
                    }
                  >
                    {draft.expandDefault[item.key]
                      ? t("admin.aiPrompts.hideDefault")
                      : t("admin.aiPrompts.viewDefault")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setResetTarget(item.key)}
                    disabled={!item.is_overridden}
                    loading={draft.resetting[item.key]}
                  >
                    {t("admin.aiPrompts.resetBtn")}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSave(item.key)}
                    disabled={!dirty || matchesDefault}
                    loading={draft.saving[item.key]}
                  >
                    {t("admin.aiPrompts.saveBtn")}
                  </Button>
                </div>
              </div>

              {/* 默认值折叠区 */}
              {draft.expandDefault[item.key] && (
                <div className="mt-3 rounded border border-dashed border-[var(--border)] bg-[var(--canvas-raised)] p-3">
                  <div className="mb-1 font-label text-[11px] text-[color:var(--ink-muted)]">
                    {t("admin.aiPrompts.defaultLabel")}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[var(--ink)]">
                    {item.default}
                  </pre>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* 预览面板 */}
      {previewResp && (
        <section className="mt-6 rounded border border-[var(--border)] bg-[var(--canvas-raised)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-label text-[14px] font-semibold text-[var(--ink)]">
              {t("admin.aiPrompts.previewTitle")}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setPreviewResp(null)}>
              {t("admin.aiPrompts.closePreview")}
            </Button>
          </div>
          <p className="mb-4 font-label text-[12px] text-[color:var(--ink-muted)]">
            {t("admin.aiPrompts.previewHint")}
          </p>
          <PreviewBlock
            heading={t("admin.aiPrompts.previewQA")}
            system={previewResp.qa.system_prompt}
            user={previewResp.qa.user_prompt}
          />
          <div className="mt-4">
            <PreviewBlock
              heading={t("admin.aiPrompts.previewImage")}
              system={previewResp.image_brief.system_prompt}
              user={previewResp.image_brief.user_prompt}
            />
          </div>
        </section>
      )}

      <ConfirmDialog
        open={!!resetTarget}
        title={t("admin.aiPrompts.resetConfirmTitle")}
        message={t("admin.aiPrompts.resetConfirmBody")}
        confirmLabel={t("admin.aiPrompts.resetBtn")}
        onConfirm={handleResetConfirm}
        onCancel={() => setResetTarget(null)}
      />
    </>
  );
}

function PreviewBlock({
  heading,
  system,
  user,
}: {
  heading: string;
  system: string;
  user: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-2 font-label text-[12px] font-semibold text-[var(--ink)]">{heading}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 font-label text-[10px] uppercase tracking-[0.15em] text-[color:var(--ink-muted)]">
            system
          </div>
          <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--canvas)] p-3 font-mono text-[12px] leading-relaxed text-[var(--ink)]">
            {system}
          </pre>
        </div>
        <div>
          <div className="mb-1 font-label text-[10px] uppercase tracking-[0.15em] text-[color:var(--ink-muted)]">
            user (fixture)
          </div>
          <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--canvas)] p-3 font-mono text-[12px] leading-relaxed text-[var(--ink)]">
            {user}
          </pre>
        </div>
      </div>
      <div className="mt-1 font-label text-[10px] text-[color:var(--ink-muted)]">
        {t("admin.aiPrompts.fixtureFootnote")}
      </div>
    </div>
  );
}
