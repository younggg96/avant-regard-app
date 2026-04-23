"use client";

/**
 * Shared admin UI primitives.
 *
 * All components use the site's monochrome ink/canvas palette —
 * no semantic colors (green/red/blue).
 */

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X, Loader2 } from "lucide-react";

// ─── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-label text-[15px] font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 font-label text-[12px] text-[color:var(--ink-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Search bar ──────────────────────────────────────────────────────────────

export function SearchBar({
  value,
  onChange,
  placeholder = "搜索…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-muted)]"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded border border-[var(--border)] bg-[var(--canvas)] pl-9 pr-8
                   font-label text-[13px] text-[var(--ink)] placeholder:text-[color:var(--ink-muted)]
                   outline-none transition-colors focus:border-[var(--ink-muted)]"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5
                     text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Filter chips ────────────────────────────────────────────────────────────

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = "全部",
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  allLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 font-label text-[12px]">
      <button
        onClick={() => onChange(undefined)}
        className={`rounded-full border px-3 py-1 transition-colors ${
          !value
            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
            : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
        }`}
      >
        {allLabel}
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value === value ? undefined : opt.value)}
          className={`rounded-full border px-3 py-1 transition-colors ${
            value === opt.value
              ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
              : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Status badge (monochrome) ───────────────────────────────────────────────

export function StatusBadge({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
  /** @deprecated kept for call-site compat — ignored */
  variant?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-label text-[11px] ${
        active
          ? "bg-[var(--ink)] text-[var(--canvas)]"
          : "bg-[var(--canvas-raised)] text-[color:var(--ink-muted)]"
      }`}
    >
      {children}
    </span>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between font-label text-[12px] text-[color:var(--ink-muted)]">
      <span>
        {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded border border-[var(--border)] p-1.5 transition-colors
                     hover:bg-[var(--canvas-raised)] disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded border border-[var(--border)] p-1.5 transition-colors
                     hover:bg-[var(--canvas-raised)] disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-label text-[14px] font-semibold">{title}</h3>
        {message && (
          <p className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">{message}</p>
        )}
        <div className="mt-5 flex justify-end gap-2 font-label text-[13px]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded border border-[var(--border)] px-4 py-2 transition-colors
                       hover:bg-[var(--canvas-raised)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-4 py-2 font-medium
                       text-[var(--canvas)] transition-colors hover:opacity-80 disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form dialog ─────────────────────────────────────────────────────────────

export function FormDialog({
  open,
  title,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-12 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-6 shadow-float ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-label text-[14px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Form field ──────────────────────────────────────────────────────────────

export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-label text-[12px] text-[color:var(--ink-muted)]">
        {label}
        {required && <span className="opacity-40"> *</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Text input ──────────────────────────────────────────────────────────────

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
  rows = 3,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}) {
  const cls =
    "w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 " +
    "font-label text-[13px] text-[var(--ink)] placeholder:text-[color:var(--ink-muted)] " +
    "outline-none transition-colors focus:border-[var(--ink-muted)] disabled:opacity-50";

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cls + " resize-y"}
      />
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cls + " h-9"}
    />
  );
}

// ─── Toggle switch ───────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-[var(--ink)]" : "bg-[var(--canvas-raised)] border border-[var(--border)]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full transition-transform ${
            checked
              ? "translate-x-[18px] bg-[var(--canvas)]"
              : "translate-x-0.5 bg-[var(--ink-muted)]"
          }`}
        />
      </button>
      {label && <span className="font-label text-[13px]">{label}</span>}
    </label>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "default",
  disabled = false,
  loading = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "default" | "sm";
  disabled?: boolean;
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded font-label transition-all disabled:opacity-40";
  const sizes = size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]";
  const variants: Record<string, string> = {
    primary: "bg-[var(--ink)] text-[var(--canvas)] hover:opacity-80",
    secondary: "border border-[var(--border)] text-[color:var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--canvas-raised)]",
    danger: "border border-[var(--border)] text-[color:var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--canvas-raised)]",
    ghost: "text-[color:var(--ink-muted)] hover:text-[var(--ink)]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes} ${variants[variant]}`}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({ message = "暂无数据" }: { message?: string }) {
  return (
    <div className="flex h-40 items-center justify-center font-label text-[13px] text-[color:var(--ink-muted)]">
      {message}
    </div>
  );
}

// ─── Loading state ───────────────────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-[color:var(--ink-muted)]" />
    </div>
  );
}

// ─── Prompt dialog (text input) ──────────────────────────────────────────────

export function PromptDialog({
  open,
  title,
  placeholder,
  confirmLabel = "确认",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 font-label text-[14px] font-semibold">{title}</h3>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2
                     font-label text-[13px] outline-none transition-colors focus:border-[var(--ink-muted)]"
        />
        <div className="mt-4 flex justify-end gap-2 font-label text-[13px]">
          <button
            onClick={() => { setValue(""); onCancel(); }}
            disabled={loading}
            className="rounded border border-[var(--border)] px-4 py-2 transition-colors hover:bg-[var(--canvas-raised)]"
          >
            取消
          </button>
          <button
            onClick={() => { onConfirm(value); setValue(""); }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-4 py-2
                       text-[var(--canvas)] transition-colors hover:opacity-80 disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
