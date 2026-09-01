const MAX_CATEGORIES = 4;
const MAX_KEYWORDS = 12;
const MAX_ISSUES = 6;
const MAX_TITLES = 12;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values, limit = Infinity) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = text(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function recordWeight(record) {
  const masteryWeight = record.mastery === "低" ? 7 : record.mastery === "中" ? 2 : 0;
  const skippedWeight = record.action === "跳过题目" ? 4 : 0;
  const reviewWeight = Math.min(3, list(record.reviewIssues).length + list(record.reviewSuggestions).length);
  return masteryWeight + skippedWeight + reviewWeight;
}

function categoryLabel(record) {
  return text(record.category) || "待分类";
}

function emptyFocus() {
  return {
    active: false,
    categories: [],
    keywords: [],
    issues: [],
    questionTitles: [],
    summary: "暂无足够的学习记录，先完成几道题后再生成薄弱知识强化题组。",
  };
}

export function buildLearningFocus(records) {
  if (!Array.isArray(records)) return emptyFocus();
  const validRecords = records.filter((record) => {
    if (!record || typeof record !== "object") return false;
    if (record.action === "查看答案") return false;
    return record.mastery === "低" || record.mastery === "中" || record.action === "跳过题目";
  });
  if (!validRecords.length) return emptyFocus();

  const groups = new Map();
  for (const record of validRecords) {
    const category = categoryLabel(record);
    const current = groups.get(category) || {
      category,
      score: 0,
      attempts: 0,
      lowCount: 0,
      mediumCount: 0,
      skippedCount: 0,
      issues: [],
      suggestions: [],
      questionTitles: [],
    };
    current.score += recordWeight(record);
    current.attempts += 1;
    if (record.mastery === "低") current.lowCount += 1;
    if (record.mastery === "中") current.mediumCount += 1;
    if (record.action === "跳过题目") current.skippedCount += 1;
    current.issues.push(...list(record.reviewIssues), ...list(record.reviewSuggestions));
    current.suggestions.push(...list(record.reviewSuggestions));
    if (text(record.question)) current.questionTitles.push(record.question);
    groups.set(category, current);
  }

  const categories = [...groups.values()]
    .sort((left, right) => right.score - left.score || right.lowCount - left.lowCount || right.skippedCount - left.skippedCount || left.category.localeCompare(right.category))
    .slice(0, MAX_CATEGORIES)
    .map((item) => ({
      ...item,
      issues: unique(item.issues, MAX_ISSUES),
      suggestions: unique(item.suggestions, MAX_ISSUES),
      questionTitles: unique(item.questionTitles, MAX_TITLES),
    }));

  const focusRecords = validRecords.filter((record) => record.mastery === "低" || record.action === "跳过题目" || record.reviewIssues?.length);
  const keywords = unique(focusRecords.flatMap((record) => [
    ...list(record.answerKeywords),
    ...list(record.reviewIssues),
    ...list(record.reviewSuggestions),
  ].flatMap((value) => value.split(/[、，,；;\n|/]/).map((part) => part.trim()).filter((part) => part.length >= 2))), MAX_KEYWORDS);
  const issues = unique(validRecords.flatMap((record) => [...list(record.reviewIssues), ...list(record.reviewSuggestions)]), MAX_ISSUES);
  const questionTitles = unique(validRecords.map((record) => record.question), MAX_TITLES);
  const summary = `重点强化：${categories.map((item) => `${item.category}（低掌握${item.lowCount}，跳过${item.skippedCount}）`).join("、")}。优先安排薄弱知识变式题，并穿插相关知识覆盖。`;

  return { active: categories.length > 0, categories, keywords, issues, questionTitles, summary };
}

function candidateText(question) {
  return [question?.title, question?.category, ...(Array.isArray(question?.keywords) ? question.keywords : []), ...(Array.isArray(question?.tags) ? question.tags : [])]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();
}

function candidateScore(question, focus) {
  if (!focus?.active) return 0;
  const title = text(question?.title).toLocaleLowerCase();
  const category = text(question?.category);
  const weakCategories = new Set((focus.categories || []).map((item) => item.category));
  let score = weakCategories.has(category) ? 6 : 0;
  if ((focus.questionTitles || []).some((item) => text(item).toLocaleLowerCase() === title)) score += 3;
  const haystack = candidateText(question);
  for (const keyword of focus.keywords || []) {
    if (keyword && haystack.includes(text(keyword).toLocaleLowerCase())) score += 2;
  }
  return score;
}

export function prioritizeQuestionCandidates(questions, focus) {
  if (!Array.isArray(questions) || !focus?.active) return Array.isArray(questions) ? [...questions] : [];
  return questions
    .map((question, index) => ({ question, index, score: candidateScore(question, focus) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.question);
}

export function buildLearningFocusPrompt(focus) {
  if (!focus?.active) return "当前没有可用的薄弱知识记录，保持分类、难度和技术栈约束并覆盖常规知识面。";
  const categories = (focus.categories || []).map((item) => `${item.category}（低掌握${item.lowCount}，中等${item.mediumCount}，跳过${item.skippedCount}）`).join("、");
  const issues = (focus.issues || []).join("；");
  const keywords = (focus.keywords || []).join("、");
  return `薄弱知识强化已开启。重点分类：${categories}。${issues ? `审阅问题：${issues}。` : ""}${keywords ? `重点关键词：${keywords}。` : ""}请按约 60% 低掌握/跳过知识的变式题、30% 相关知识题、10% 其他覆盖题组织本题组；不要机械重复原题，必须保持用户选择的分类、难度和技术栈约束。`;
}
