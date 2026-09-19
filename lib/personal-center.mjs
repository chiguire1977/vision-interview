const MASTERY_STAGES = ["未掌握", "部分掌握", "已掌握", "熟练"];

function validMasteryStage(value, legacy) {
  if (MASTERY_STAGES.includes(value)) return value;
  if (legacy === "高") return "已掌握";
  if (legacy === "中") return "部分掌握";
  return "未掌握";
}

function uniqueText(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].slice(0, 4);
}

function latestValue(records) {
  return records
    .map((record) => String(record.date || record.timestamp || "").trim())
    .filter(Boolean)
    .sort((left, right) => {
      const rightTime = Date.parse(right);
      const leftTime = Date.parse(left);
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return right.localeCompare(left);
      return rightTime - leftTime;
    })[0] || "";
}

function createCategorySummary(category, records) {
  const issues = [];
  const suggestions = [];
  const stageCounts = { 未掌握: 0, 部分掌握: 0, 已掌握: 0, 熟练: 0 };

  for (const record of records) {
    stageCounts[validMasteryStage(record.masteryStage, record.mastery)] += 1;
    if (Array.isArray(record.reviewIssues)) issues.push(...record.reviewIssues);
    if (Array.isArray(record.reviewSuggestions)) suggestions.push(...record.reviewSuggestions);
  }

  const latestRecord = [...records].sort((left, right) => Date.parse(String(right.date || right.timestamp || "")) - Date.parse(String(left.date || left.timestamp || "")))[0];
  const masteryStage = validMasteryStage(latestRecord?.masteryStage, latestRecord?.mastery);
  const summary = {
    category,
    attempts: records.length,
    answeredCount: records.filter((record) => record.action !== "跳过题目").length,
    skippedCount: records.filter((record) => record.action === "跳过题目").length,
    masteryStage,
    masteryStageCounts: stageCounts,
    issues: uniqueText(issues),
    suggestions: uniqueText(suggestions),
    latestDate: latestValue(records),
  };
  return summary;
}

export function analyzeLearningMastery(records) {
  const usableRecords = Array.isArray(records)
    ? records.filter((record) => record && typeof record === "object" && typeof record.question === "string" && record.question.trim() && record.action !== "查看答案")
    : [];
  const groups = new Map();
  for (const record of usableRecords) {
    const category = typeof record.category === "string" && record.category.trim() ? record.category.trim() : "待分类";
    const group = groups.get(category) || [];
    group.push(record);
    groups.set(category, group);
  }

  const masteryStageCounts = { 未掌握: 0, 部分掌握: 0, 已掌握: 0, 熟练: 0 };
  for (const record of usableRecords) {
    masteryStageCounts[validMasteryStage(record.masteryStage, record.mastery)] += 1;
  }

  const categories = [...groups.entries()]
    .map(([category, categoryRecords]) => createCategorySummary(category, categoryRecords))
    .sort((left, right) => MASTERY_STAGES.indexOf(left.masteryStage) === MASTERY_STAGES.indexOf(right.masteryStage)
      ? right.attempts - left.attempts || left.category.localeCompare(right.category)
      : MASTERY_STAGES.indexOf(left.masteryStage) - MASTERY_STAGES.indexOf(right.masteryStage));

  const analysis = {
    totalRecords: usableRecords.length,
    answeredCount: usableRecords.filter((record) => record.action !== "跳过题目").length,
    skippedCount: usableRecords.filter((record) => record.action === "跳过题目").length,
    masteryStageCounts,
    masteryStage: MASTERY_STAGES.reduce((best, stage) => masteryStageCounts[stage] > 0 ? stage : best, "未掌握"),
    studyDays: new Set(usableRecords.map((record) => String(record.date || record.timestamp || "").slice(0, 10)).filter(Boolean)).size,
    categories,
  };
  return analysis;
}

export function createImprovementPlan(analysis) {
  if (!analysis || !Array.isArray(analysis.categories)) return [];
  return analysis.categories
    .filter((category) => category.masteryStage !== "已掌握" && category.masteryStage !== "熟练")
    .slice(0, 3)
    .map((category) => {
      const target = category.masteryStage === "未掌握" ? "部分掌握" : "已掌握";
      const actions = [
        ...category.suggestions,
        category.masteryStage === "未掌握"
          ? "复习本分类中最近的薄弱题目，并重新组织回答"
          : "复盘本分类的审阅问题，补充项目证据和边界条件",
      ].filter((action, index, list) => action && list.indexOf(action) === index).slice(0, 3);
      return {
        category: category.category,
        title: `优先补强：${category.category}`,
        priority: category.masteryStage === "未掌握" ? "高" : "中",
        reason: category.issues.length ? `主要问题：${category.issues.join("；")}` : `当前掌握阶段为${category.masteryStage}，需要增加有效练习。`,
        actions,
        target: `连续完成 3 道本分类题目，并将掌握阶段提升到${target}`,
      };
    });
}
