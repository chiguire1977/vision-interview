function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function modelDisplayName(model) {
  const value = cleanText(model?.value);
  const label = cleanText(model?.label);
  const source = label || value;
  const withoutPriority = source.replace(/\s*[（(](?:速度优先|质量优先|成本优先)[)）]\s*$/u, "");
  const withoutProtocol = withoutPriority.replace(/\s*[·•|｜]\s*(?:Chat Completions|Responses|Anthropic Messages)\b.*$/iu, "");
  return withoutProtocol.trim() || value;
}
