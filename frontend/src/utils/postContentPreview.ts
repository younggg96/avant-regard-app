const TEXT_KEYS = ["content", "text", "value", "label"] as const;
// 富文本块里 type 不是 "text" 的统称为媒体/非文本块，对它们的 content 是
// 媒体 URL 而不是正文，预览里要整块跳过。论坛帖子的 contentBlocks 用
// `{ type: "image", content: "https://..." }`，曾被 TEXT_KEYS fallback 当成
// 正文吐出来，封面卡片就出现了「正文 + 图片 URL」混排。
const NON_TEXT_BLOCK_TYPES = new Set([
  "image",
  "video",
  "media",
  "audio",
  "file",
  "embed",
]);

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function collectText(node: unknown, bucket: string[]): void {
  if (typeof node === "string") {
    const normalized = normalizeWhitespace(node);
    if (normalized) bucket.push(normalized);
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectText(item, bucket));
    return;
  }

  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;

  // Prefer explicit text blocks used by rich-text editors.
  if (record.type === "text") {
    const text = typeof record.content === "string" ? record.content : "";
    const normalized = normalizeWhitespace(text);
    if (normalized) bucket.push(normalized);
    return;
  }

  // 显式的非文本块（图片 / 视频 / 媒体）整块跳过：它们的 content 是 URL，
  // 不该作为文字预览。仍然向下递归 children/blocks，兼容更深层的富文本结构。
  const isNonTextBlock =
    typeof record.type === "string" &&
    NON_TEXT_BLOCK_TYPES.has(record.type.toLowerCase());

  if (!isNonTextBlock) {
    for (const key of TEXT_KEYS) {
      const value = record[key];
      if (typeof value === "string") {
        const normalized = normalizeWhitespace(value);
        if (normalized) bucket.push(normalized);
      }
    }
  }

  // Traverse nested rich content payloads.
  if ("children" in record) collectText(record.children, bucket);
  if ("blocks" in record) collectText(record.blocks, bucket);
}

export function getPostTextPreview(input?: string | null, maxLength = 140): string {
  if (!input) return "";
  const raw = input.trim();
  if (!raw) return "";

  let text = raw;
  let parsedJson = false;

  try {
    const parsed = JSON.parse(raw);
    parsedJson = true;
    const collected: string[] = [];
    collectText(parsed, collected);
    text = collected.join(" ").trim();
  } catch {
    // Keep raw text when not JSON.
  }

  // Looks like JSON but malformed; avoid leaking raw payload in UI.
  if (!parsedJson && /^[\[{].*[\]}]$/s.test(raw)) return "";

  // If payload is JSON but has no readable text, hide noisy raw JSON.
  if (parsedJson && !text) return "";

  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

