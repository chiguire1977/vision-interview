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
});
