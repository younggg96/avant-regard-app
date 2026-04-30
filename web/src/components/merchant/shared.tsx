"use client";

/**
 * 商家管理页共享 UI 原语。
 *
 * 从 `/me/merchant/[id]/page.tsx` 抽出来，供同目录 4 个子页（profile / entry-cards
 * / categories / products）复用。抽取原因：
 *   - DRY —— 原先 ImagePicker / ChipEditor 只有主页用，如果 4 个子页各自复制
 *     一份，后续任何一次 UX 或上传错误处理的调整都要改 5 个地方；
 *   - 原主页已经 1700+ 行，再塞商品系统 4 个 tab 只会更肥；走子页 + 共享组件
 *     的拆分能把每个文件控制在 ~400 行内；
 *   - MultiImagePicker 是 Phase 5 商品 CRUD 新增的（商品最多 9 图），和单图
 *     的 ImagePicker 虽然语义接近，但交互差异大（拖拽排序、删除、上限），
 *     单独写清楚。
 */

import { useState, type ReactNode } from "react";
import { uploadImage } from "@/lib/services/admin";
import { Button, FormField, TextInput } from "@/components/admin/ui";

// ============================================================================
// ImagePicker —— 单图上传（Banner / 活动 / 折扣 / 分类封面 / profile logo ...）
// ============================================================================

export function ImagePicker({
  value,
  onChange,
  height = 120,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  height?: number;
  /** 图片下方的辅助说明文字，例如"建议 1:1 正方形"。 */
  hint?: string;
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
      {hint && !err && (
        <div className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
          {hint}
        </div>
      )}
      {err && (
        <div className="mt-1 font-label text-[11px] text-red-600">{err}</div>
      )}
    </div>
  );
}

// ============================================================================
// MultiImagePicker —— 多图上传 + 排序（商品卡最多 9 图）
// ============================================================================

export function MultiImagePicker({
  value,
  onChange,
  max = 9,
  height = 100,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  /** 每格高度。宽度由 grid 自适应。 */
  height?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 点击"+"打开多选文件。逐个上传（不走并发）以便对失败项有清晰的定位。
  const handlePick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      setUploading(true);
      setErr(null);
      try {
        const uploaded: string[] = [];
        for (const f of files) {
          // 超出上限就不再传了，避免多此一举。
          if (value.length + uploaded.length >= max) break;
          try {
            const url = await uploadImage(f);
            uploaded.push(url);
          } catch (e) {
            // 单张失败就继续下一张，但把错误暴露给用户。
            setErr(`${f.name}: ${e instanceof Error ? e.message : "上传失败"}`);
          }
        }
        if (uploaded.length > 0) {
          onChange([...value, ...uploaded]);
        }
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleRemove = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  const handleMove = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const atLimit = value.length >= max;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {value.map((url, idx) => (
          <div
            key={`${url}-${idx}`}
            className="relative overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas)]"
            style={{ height }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {/* 顺序控制 —— 第 1 张默认作封面，设计上需要让用户明显感知"顺序=展示顺序" */}
            <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-label text-[10px] text-white">
              {idx === 0 ? "封面" : idx + 1}
            </div>
            <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 transition-opacity hover:opacity-100">
              {idx > 0 && (
                <button
                  onClick={() => handleMove(idx, -1)}
                  className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                  title="前移"
                >
                  ←
                </button>
              )}
              {idx < value.length - 1 && (
                <button
                  onClick={() => handleMove(idx, 1)}
                  className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                  title="后移"
                >
                  →
                </button>
              )}
              <button
                onClick={() => handleRemove(idx)}
                className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                title="删除"
              >
                ×
              </button>
            </div>
            {/* hover 才显示操作按钮（opacity 透明层 + group-hover 在这里用伪类代替）；
                避免网格上一堆 UI 元素视觉干扰封面本身。 */}
            <div
              className="absolute inset-0 cursor-default"
              onMouseEnter={(e) => {
                const target = e.currentTarget.nextElementSibling;
                if (target instanceof HTMLElement) target.style.opacity = "1";
              }}
            />
          </div>
        ))}
        {!atLimit && (
          <button
            onClick={handlePick}
            disabled={uploading}
            className="flex items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--canvas)] font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] disabled:opacity-50"
            style={{ height }}
          >
            {uploading ? "上传中…" : "+ 添加"}
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2 font-label text-[11px] text-[color:var(--ink-muted)]">
        <span>
          {value.length}/{max}
        </span>
        <span>·</span>
        <span>第 1 张默认作封面，可通过 ←/→ 调整顺序</span>
      </div>
      {err && (
        <div className="mt-1 font-label text-[11px] text-red-600">{err}</div>
      )}
    </div>
  );
}

// ============================================================================
// ChipEditor —— 标签列表编辑器（销售品牌 / 风格标签 / 商品 tags）
// ============================================================================

export function ChipEditor({
  label,
  placeholder,
  draft,
  onDraftChange,
  items,
  onAdd,
  onRemove,
  max,
}: {
  label: string;
  placeholder?: string;
  draft: string;
  onDraftChange: (v: string) => void;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (idx: number) => void;
  /** 可选上限；达到上限后隐藏输入框。 */
  max?: number;
}) {
  const atLimit = max != null && items.length >= max;

  const commit = () => {
    if (atLimit) return;
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    onDraftChange("");
  };

  return (
    <FormField label={label}>
      {!atLimit && (
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
      )}
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
      {max != null && (
        <div className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
          {items.length}/{max}
        </div>
      )}
    </FormField>
  );
}

// ============================================================================
// ChipPicker —— 单选 chip（卡片类型 / 商品状态等枚举选择）
// ============================================================================

export function ChipPicker<T extends string>({
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

// ============================================================================
// 子页通用 Header / 返回链接
// ============================================================================

export function SubPageBackLink({ merchantId }: { merchantId: number | string }) {
  return (
    <a
      href={`/me/merchant/${merchantId}`}
      className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
    >
      ← 返回商家管理
    </a>
  );
}

export function SubPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-5">
      <div>
        <h1 className="font-serif text-2xl text-black dark:text-white md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
