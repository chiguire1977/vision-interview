const MAX_POINTS = 8;

function text(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function unique(values, limit = MAX_POINTS) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const item = text(value);
    const key = item.toLocaleLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function inferAbilities(type) {
  const value = text(type);
  const abilities = [];
  if (/原理|概念|算法/.test(value)) abilities.push("原理理解");
  if (/参数|调参/.test(value)) abilities.push("参数判断");
  if (/工程|实践|应用/.test(value)) abilities.push("工程应用");
  if (/故障|排查|异常/.test(value)) abilities.push("故障排查");
  if (/方案|选型|对比/.test(value)) abilities.push("方案取舍");
  if (/项目|深挖/.test(value)) abilities.push("项目表达");
  return abilities.length ? abilities : ["结构化表达"];
}

export function normalizeQuestionBlueprint(value) {
  const source = value && typeof value === "object" ? value : {};
  const corePoints = unique(list(source.corePoints));
  const criticalPoints = unique(list(source.criticalPoints).length ? source.criticalPoints : corePoints.slice(0, 3), 3);
  const supportingPoints = unique(list(source.supportingPoints).length ? source.supportingPoints : corePoints.filter((point) => !criticalPoints.includes(point)), MAX_POINTS);
  return {
    version: 1,
    knowledgeKey: text(source.knowledgeKey),
    corePoints: unique([...corePoints, ...criticalPoints, ...supportingPoints]),
    criticalPoints,
    supportingPoints,
    ability: unique(list(source.ability), 6),
    scenario: text(source.scenario),
    commonMistakes: unique(list(source.commonMistakes), 6),
  };
}

export function buildQuestionBlueprint(question = {}) {
  const explicitPoints = list(question.knowledgePoints);
  const corePoints = unique([
    ...(explicitPoints.length ? explicitPoints : [...list(question.keywords), ...list(question.tags)]),
  ]);
  const criticalPoints = corePoints.slice(0, 3);
  const supportingPoints = corePoints.slice(3);
  const category = text(question.category);
  const stacks = unique(list(question.techStacks), 4);
  return normalizeQuestionBlueprint({
    knowledgeKey: [category, stacks.join(","), corePoints.join(",")].filter(Boolean).join("|"),
    corePoints,
    criticalPoints,
    supportingPoints,
    ability: inferAbilities(question.type),
    scenario: question.scenario ?? question.context,
    commonMistakes: question.commonMistakes,
  });
}
