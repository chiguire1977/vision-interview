export const MASTERY_STAGES = ["未掌握", "部分掌握", "已掌握", "熟练"];

export function normalizeMasteryStage(value) {
  if (MASTERY_STAGES.includes(value)) return value;
  if (value === "高") return "已掌握";
  if (value === "中") return "部分掌握";
  return "未掌握";
}

export function masteryStageFromReview({ status = "answered", conclusion, missingPoints = [], criticalMissingPoints = [] } = {}) {
  if (status === "skipped" || conclusion === "未回答") return "未掌握";
  if (criticalMissingPoints.length || missingPoints.length || conclusion === "存在关键遗漏") return "部分掌握";
  return "已掌握";
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sameKnowledgeClass(left, right) {
  const leftKey = text(left?.knowledgeKey);
  const rightKey = text(right?.knowledgeKey);
  return leftKey && rightKey ? leftKey === rightKey : false;
}

function successful(stage) {
  return stage === "已掌握" || stage === "熟练";
}

/**
 * A single complete response is deliberately not promoted to 熟练.
 * Two successful question types establish 已掌握; three establish 熟练.
 */
export function deriveMasteryStage(history = [], current = {}) {
  const currentStage = normalizeMasteryStage(current.stage ?? current.masteryStage);
  if (currentStage === "未掌握") return "未掌握";
  const related = [
    ...(Array.isArray(history) ? history.filter((item) => sameKnowledgeClass(item, current)) : []),
    current,
  ];
  const successfulTypes = new Set(
    related
      .filter((item) => successful(normalizeMasteryStage(item.stage ?? item.masteryStage)))
      .map((item) => text(item.questionType || item.type))
      .filter(Boolean),
  );
  if (currentStage === "部分掌握") return "部分掌握";
  if (successfulTypes.size >= 3) return "熟练";
  if (successfulTypes.size >= 2) return "已掌握";
  return "部分掌握";
}
