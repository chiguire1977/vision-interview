import { buildQuestionBlueprint, normalizeQuestionBlueprint } from "./question-blueprint.mjs";

const conceptAliases = new Map([
  ["减去平均灰度", ["减去平均灰度", "平均灰度", "去均值", "减均值", "减去均值"]],
  ["归一化", ["归一化", "标准化"]],
  ["亮度偏移", ["亮度偏移", "整体亮度", "亮度变化"]],
  ["局部阴影", ["局部阴影", "阴影"]],
  ["测试集", ["测试集", "测试数据", "验证集"]],
  ["准确率", ["准确率", "识别率", "正确率"]],
  ["误检", ["误检", "假阳性"]],
  ["漏检", ["漏检", "假阴性"]],
  ["窗口大小", ["窗口大小", "窗口尺寸", "窗口"]],
  ["目标尺寸", ["目标尺寸", "目标大小"]],
  ["局部光照变化", ["局部光照变化", "局部光照", "光照变化"]],
  ["误检验证", ["误检验证", "误检"]],
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function termsFor(point) {
  const label = text(point);
  return conceptAliases.get(label) || [label];
}

function containsConcept(answer, point) {
  const source = text(answer).toLocaleLowerCase();
  return termsFor(point).some((term) => term && source.includes(term.toLocaleLowerCase()));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function blueprintFor(question) {
  const explicit = question?.blueprint;
  return explicit && typeof explicit === "object"
    ? normalizeQuestionBlueprint(explicit)
    : buildQuestionBlueprint(question);
}

function referencePoints(question, bestAnswer) {
  const reference = text(bestAnswer);
  const blueprint = blueprintFor(question);
  const keywords = Array.isArray(question?.keywords) ? question.keywords : [];
  const candidates = [
    ...blueprint.criticalPoints,
    ...blueprint.supportingPoints,
    ...keywords,
  ];
  return unique(candidates.map(text).filter((keyword) => keyword && containsConcept(reference, keyword)));
}

export function evaluateAnswerAgainstReference({ answer, bestAnswer, question }) {
  const reference = referencePoints(question, bestAnswer);
  const blueprint = blueprintFor(question);
  const criticalPoints = unique(blueprint.criticalPoints.filter((point) => reference.includes(point)));
  const coveredPoints = reference.filter((point) => containsConcept(answer, point));
  const missingPoints = reference.filter((point) => !coveredPoints.includes(point));
  const criticalCoveredPoints = criticalPoints.filter((point) => coveredPoints.includes(point));
  const criticalMissingPoints = criticalPoints.filter((point) => !criticalCoveredPoints.includes(point));
  const hasAnswer = Boolean(text(answer));
  const conclusion = !hasAnswer
    ? "未回答"
    : missingPoints.length > 0
      ? "存在关键遗漏"
      : "回答完整";
  const suggestions = missingPoints.length
    ? [missingPoints.join("、")]
    : [];
  const issues = !hasAnswer
    ? ["本题未回答，无法与最佳回答进行要点对照。"]
    : missingPoints.length
      ? [missingPoints.join("、")]
      : [];
  const strengths = coveredPoints.length
    ? [`已覆盖最佳回答中的：${coveredPoints.join("、")}。`]
    : [];
  return {
    conclusion,
    coveredPoints,
    missingPoints,
    criticalCoveredPoints,
    criticalMissingPoints,
    strengths,
    issues,
    suggestions,
    missing: missingPoints,
  };
}

export function shouldRunAnswerReview({ reviewEnabled = true } = {}) {
  return reviewEnabled !== false;
}
