import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  primaryNavigationLabels,
  utilityNavigationLabels,
} from "../lib/navigation.mjs";

test("navigation keeps the learning flow first and settings at the bottom", () => {
  assert.deepEqual(primaryNavigationLabels, [
    "个人中心",
    "开始学习",
    "题库",
    "收藏夹",
    "温故知新",
    "学习记录",
    "运行日志",
  ]);
  assert.deepEqual(utilityNavigationLabels, ["设置"]);
});

test("learning flow no longer exposes project or comprehensive training modes", () => {
  const page = readFileSync(fileURLToPath(new URL("../app/page.tsx", import.meta.url)), "utf8");
  assert.doesNotMatch(page, /activeNav === "项目管理"/);
  assert.doesNotMatch(page, /activeNav === "问题树"/);
  assert.doesNotMatch(page, /function QuestionTree/);
  assert.doesNotMatch(page, /name: "项目答辩"/);
  assert.doesNotMatch(page, /name: "综合模拟"/);
  assert.doesNotMatch(page, /筛选范围：/);
  assert.doesNotMatch(page, /面试官追问/);
  assert.doesNotMatch(page, /根据你刚才的回答继续深挖/);
  assert.match(page, /showTrainingSettings && <div className="border-t border-slate-100 px-4 py-3">/);
  assert.match(page.slice(page.indexOf("最佳回答")), /回答思路/);
  assert.match(page, /专业知识/);
  assert.match(page, /const techStackFilters = \["随机技术栈", \.\.\.TECH_STACKS\]/);
  assert.match(page, /const professionalCategories = \["随机类型", \.\.\.KNOWLEDGE_CATEGORIES\]/);
  assert.doesNotMatch(page, /const techStackFilters = .*通用原理/);
  assert.doesNotMatch(page, /const professionalCategories = .*PLC与现场/);
});

test("first training screen lets the learner configure scope before starting", () => {
  const page = readFileSync(fileURLToPath(new URL("../app/page.tsx", import.meta.url)), "utf8");
  const startPanel = page.slice(page.indexOf("function TrainingStartPanel"), page.indexOf("function TrainingPreparingPanel"));
  assert.match(startPanel, /professionalCategories\.map/);
  assert.match(startPanel, /difficultyFilters\.map/);
  assert.match(startPanel, /techStackFilters\.map/);
  assert.match(startPanel, /detectionDirectionsForTechStack\(techStack\)/);
  assert.match(startPanel, /onCategoryChange/);
  assert.match(startPanel, /onTechStackChange/);
  assert.match(startPanel, /onDetectionDirectionChange/);
});

test("settings includes a dedicated GitHub synchronization tab", () => {
  const page = readFileSync(fileURLToPath(new URL("../app/page.tsx", import.meta.url)), "utf8");
  assert.match(page, /key: "github", title: "GitHub 同步"/);
  assert.match(page, /GitHub 备份范围/);
  assert.match(page, /GitHub 仓库/);
  assert.match(page, /GitHub 分支/);
  assert.match(page, /服务端凭据/);
  assert.match(page, /测试 GitHub 连接/);
  assert.doesNotMatch(page, /立即从 GitHub 加载/);
  assert.doesNotMatch(page, /立即备份到 GitHub/);
  assert.match(page, /GitHub 仓库 \/ 分支/);
  assert.doesNotMatch(page, /<span>GitHub 分支<\/span>/);
  assert.match(page, /<span className="text-lg font-medium text-slate-400">\/<\/span>/);
  assert.match(page, /<div className="flex flex-wrap gap-2">\s*<Button type="button" variant="outline" onClick=\{saveGitHubConnection\}/);
  assert.match(page, /<Button type="button" variant="outline" onClick=\{\(\) => void testGithubConnection\(\)\}/);
  assert.match(page, /学习记录.*手动上传/);
});
