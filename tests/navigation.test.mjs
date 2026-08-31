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
    "问题树",
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
  assert.doesNotMatch(page, /name: "项目答辩"/);
  assert.doesNotMatch(page, /name: "综合模拟"/);
  assert.match(page, /专业知识/);
});
