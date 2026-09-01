import { normalizeTechStack } from "./taxonomy.mjs";

export const QUESTION_BANK_ARCHIVE_DIRECTORY = "data/ai-question-bank";

const STACK_SLUGS = new Map([
  ["HALCON", "halcon"],
  ["OpenCV", "opencv"],
  ["VisionPro", "visionpro"],
  ["C#", "csharp"],
  ["WPF", "wpf"],
  ["通用原理", "general"],
]);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeSlug(value: unknown) {
  const normalized = normalizeTechStack(cleanText(value));
  if (!normalized) return "";
  const known = STACK_SLUGS.get(normalized);
  if (known) return known;
  return normalized
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function questionBankArchiveSlugs(value: unknown) {
  if (!value || typeof value !== "object") return ["general"];
  const record = value as Record<string, unknown>;
  const values = Array.isArray(record.techStacks) ? record.techStacks : [];
  const explicit = values.map(safeSlug).filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];
  const filter = safeSlug(record.techStackFilter);
  return filter && filter !== "general" ? [filter] : ["general"];
}

export function questionBankArchivePath(slug: string, extension: "json" | "md") {
  return `${QUESTION_BANK_ARCHIVE_DIRECTORY}/${slug}.${extension}`;
}

export function questionBankArchiveFileInfo(path: string) {
  const match = path.match(new RegExp(`^${QUESTION_BANK_ARCHIVE_DIRECTORY}/([^/]+)\\.(json|md)$`));
  if (!match) return null;
  return { slug: match[1], extension: match[2] as "json" | "md" };
}
