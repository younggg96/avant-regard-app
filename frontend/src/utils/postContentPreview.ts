const TEXT_KEYS = ["content", "text", "value", "label"] as const;

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

  for (const key of TEXT_KEYS) {
    const value = record[key];
    if (typeof value === "string") {
      const normalized = normalizeWhitespace(value);
      if (normalized) bucket.push(normalized);
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

