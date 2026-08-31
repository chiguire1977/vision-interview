import assert from "node:assert/strict";
import test from "node:test";

import {
  primaryNavigationLabels,
  utilityNavigationLabels,
} from "../lib/navigation.mjs";

test("navigation keeps the learning flow first and settings at the bottom", () => {
  assert.deepEqual(primaryNavigationLabels, [
    "个人中心",
    "开始学习",
    "项目管理",
    "问题树",
    "题库",
    "收藏夹",
    "温故知新",
    "学习记录",
    "运行日志",
  ]);
  assert.deepEqual(utilityNavigationLabels, ["设置"]);
});
