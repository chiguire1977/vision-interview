const MASTERY_LEVELS = ["低", "中", "高"];
const MASTERY_STAGES = ["未掌握", "部分掌握", "已掌握", "熟练"];

function validMasteryStage(value, legacy) {
  if (MASTERY_STAGES.includes(value)) return value;
  if (legacy === "高") return "已掌握";
  if (legacy === "中") return "部分掌握";
  return "未掌握";
}

function validMastery(value) {
  return MASTERY_LEVELS.includes(value) ? value : "低";
}

function roundScore(value) {
  return Math.round(value);
}

function average(values) {
  return values.length ? roundScore(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
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
  const masteryCounts = { 低: 0, 中: 0, 高: 0 };
  const scoreValues = [];
  const issues = [];
  const suggestions = [];
  const stageCounts = { 未掌握: 0, 部分掌握: 0, 已掌握: 0, 熟练: 0 };

  for (const record of records) {
    const mastery = validMastery(record.mastery);
    masteryCounts[mastery] += 1;
    if (record.masteryStage) stageCounts[validMasteryStage(record.masteryStage, record.mastery)] += 1;
    if (typeof record.score === "number" && Number.isFinite(record.score)) scoreValues.push(record.score);
    if (Array.isArray(record.reviewIssues)) issues.push(...record.reviewIssues);
    if (Array.isArray(record.reviewSuggestions)) suggestions.push(...record.reviewSuggestions);
  }

  const masteryScore = roundScore(((masteryCounts.中 * 50) + (masteryCounts.高 * 100)) / records.length);
  const mastery = masteryScore >= 70 ? "高" : masteryScore >= 40 ? "中" : "低";
  const summary = {
    category,
    attempts: records.length,
    answeredCount: records.filter((record) => record.action !== "跳过题目").length,
    skippedCount: records.filter((record) => record.action === "跳过题目").length,
    averageScore: average(scoreValues),
    mastery,
    masteryScore,
    masteryCounts,
    issues: uniqueText(issues),
    suggestions: uniqueText(suggestions),
    latestDate: latestValue(records),
  };
  if (Object.values(stageCounts).some((count) => count > 0)) {
    summary.masteryStageCounts = stageCounts;
    summary.masteryStage = MASTERY_STAGES.reduce((best, stage) => stageCounts[stage] > 0 ? stage : best, "未掌握");
  }
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

  const masteryCounts = { 低: 0, 中: 0, 高: 0 };
  const masteryStageCounts = { 未掌握: 0, 部分掌握: 0, 已掌握: 0, 熟练: 0 };
  let hasMasteryStages = false;
  const scoreValues = [];
  for (const record of usableRecords) {
    masteryCounts[validMastery(record.mastery)] += 1;
    if (record.masteryStage) {
      hasMasteryStages = true;
      masteryStageCounts[validMasteryStage(record.masteryStage, record.mastery)] += 1;
    }
    if (typeof record.score === "number" && Number.isFinite(record.score)) scoreValues.push(record.score);
  }

  const categories = [...groups.entries()]
    .map(([category, categoryRecords]) => createCategorySummary(category, categoryRecords))
    .sort((left, right) => right.masteryScore === left.masteryScore
      ? ((right.averageScore ?? -1) - (left.averageScore ?? -1)) || right.attempts - left.attempts || left.category.localeCompare(right.category)
      : left.masteryScore - right.masteryScore);

  const analysis = {
    totalRecords: usableRecords.length,
    answeredCount: usableRecords.filter((record) => record.action !== "跳过题目").length,
    skippedCount: usableRecords.filter((record) => record.action === "跳过题目").length,
    averageScore: average(scoreValues),
    masteryCounts,
    studyDays: new Set(usableRecords.map((record) => String(record.date || record.timestamp || "").slice(0, 10)).filter(Boolean)).size,
    categories,
  };
  if (hasMasteryStages) {
    analysis.masteryStageCounts = masteryStageCounts;
    analysis.masteryStage = MASTERY_STAGES.reduce((best, stage) => masteryStageCounts[stage] > 0 ? stage : best, "未掌握");
  }
  return analysis;
}

export function createImprovementPlan(analysis) {
  if (!analysis || !Array.isArray(analysis.categories)) return [];
  return analysis.categories
    .filter((category) => category.mastery !== "高")
    .slice(0, 3)
    .map((category) => {
      const target = category.mastery === "低" ? "中及以上" : "高";
      const actions = [
        ...category.suggestions,
        category.mastery === "低"
          ? "复习本分类中最近的薄弱题目，并重新组织回答"
          : "复盘本分类的审阅问题，补充项目证据和边界条件",
      ].filter((action, index, list) => action && list.indexOf(action) === index).slice(0, 3);
      return {
        category: category.category,
        title: `优先补强：${category.category}`,
        priority: category.mastery === "低" ? "高" : "中",
        reason: category.issues.length ? `主要问题：${category.issues.join("；")}` : `当前掌握度为${category.mastery}，需要增加有效练习。`,
        actions,
        target: `连续完成 3 道本分类题目，并将掌握度提升到${target}`,
      };
    });
}
