function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasReviewIssues(record) {
  return (Array.isArray(record.reviewIssues) && record.reviewIssues.length > 0)
    || (Array.isArray(record.reviewSuggestions) && record.reviewSuggestions.length > 0);
}

function scoreRecord(record) {
  const low = record.mastery === "低" ? 100 : 0;
  const skipped = record.action === "跳过题目" ? 2 : 0;
  const medium = record.mastery === "中" ? 55 : 0;
  const issueCount = (Array.isArray(record.reviewIssues) ? record.reviewIssues.length : 0)
    + (Array.isArray(record.reviewSuggestions) ? record.reviewSuggestions.length : 0);
  return low + skipped + medium + Math.min(issueCount, 4) * 5;
}

function reviewReason(record) {
  const reasons = [];
  if (record.mastery === "低") reasons.push("低掌握");
  if (record.action === "跳过题目") reasons.push("跳过");
  if (hasReviewIssues(record)) reasons.push("存在审阅问题");
  return reasons.join("、") || "需要复习";
}

export function buildReviewQueue(records) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  return records
    .filter((record) => record && typeof record === "object" && clean(record.question))
    .filter((record) => record.mastery === "低" || record.action === "跳过题目" || (record.mastery === "中" && hasReviewIssues(record)))
    .filter((record) => {
      const key = `${clean(record.source) || "历史"}|${clean(record.question)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((record, index) => ({
      ...record,
      queueIndex: index,
      score: scoreRecord(record),
      priority: scoreRecord(record) >= 100 ? "高" : "中",
      reason: reviewReason(record),
    }))
    .sort((left, right) => right.score - left.score || left.queueIndex - right.queueIndex);
}

export function selectReviewQuestions(questions, records, startTitle = "") {
  if (!Array.isArray(questions)) return [];
  const questionMap = new Map(questions.map((question) => [clean(question?.title), question]));
  const selected = buildReviewQueue(records)
    .map((record) => questionMap.get(clean(record.question)))
    .filter(Boolean);
  const startIndex = selected.findIndex((question) => clean(question.title) === clean(startTitle));
  if (startIndex > 0) return [selected[startIndex], ...selected.slice(0, startIndex), ...selected.slice(startIndex + 1)];
  return selected;
}

export function summarizeReviewQueue(queue) {
  const items = Array.isArray(queue) ? queue : [];
  return {
    total: items.length,
    high: items.filter((item) => item.priority === "高").length,
    categories: new Set(items.map((item) => clean(item.category) || "待分类")).size,
  };
}
