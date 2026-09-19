import assert from "node:assert/strict";
import test from "node:test";
import {
  favoriteQuestionKey,
  filterFavoriteQuestions,
  groupFavoriteQuestions,
  isFavoriteQuestion,
  normalizeFavoriteQuestions,
  toggleFavoriteQuestion,
} from "../lib/favorites.mjs";

function question(title, overrides = {}) {
  return {
    title,
    type: "算法原理",
    category: "图像处理基础",
    source: "专业",
    difficulty: "中等",
    tags: ["梯度"],
    keywords: ["边缘"],
    followUp: "追问",
    hint: "提示",
    bestAnswer: "答案",
    principle: "原理",
    origin: "本地题库",
    ...overrides,
  };
}

test("favorite questions use a stable source-aware key and remove duplicates", () => {
  const first = question("NCC 模板匹配");
  const duplicate = question(" NCC  模板匹配 ", { bestAnswer: "更新后的答案" });
  const projectQuestion = question("NCC 模板匹配", { source: "项目", origin: "AI" });

  assert.equal(favoriteQuestionKey(first), "专业|ncc模板匹配");
  assert.notEqual(favoriteQuestionKey(first), favoriteQuestionKey(projectQuestion));
  assert.deepEqual(normalizeFavoriteQuestions([first, duplicate, projectQuestion]).map((item) => item.title), ["NCC 模板匹配", "NCC 模板匹配"]);
});

test("toggling a question adds it once and toggling again removes it", () => {
  const first = question("Otsu 阈值");
  const second = question("Canny 边缘");
  let favorites = toggleFavoriteQuestion([], first);
  favorites = toggleFavoriteQuestion(favorites, first);
  assert.equal(favorites.length, 0);
  favorites = toggleFavoriteQuestion(favorites, first);
  favorites = toggleFavoriteQuestion(favorites, second);
  assert.equal(isFavoriteQuestion(favorites, first), true);
  assert.equal(isFavoriteQuestion(favorites, question("Otsu 阈值")), true);
  assert.deepEqual(favorites.map((item) => item.title), ["Canny 边缘", "Otsu 阈值"]);
});

test("favorite questions can be searched and grouped by category", () => {
  const values = [
    question("HALCON 深度 OCR", { category: "字符识别", tags: ["OCR"] }),
    question("九点标定步骤", { category: "标定与坐标", source: "项目" }),
    question("NCC 模板匹配"),
  ];
  assert.deepEqual(filterFavoriteQuestions(values, "ocr", "全部").map((item) => item.title), ["HALCON 深度 OCR"]);
  assert.deepEqual(filterFavoriteQuestions(values, "", "项目").map((item) => item.title), ["九点标定步骤"]);
  assert.deepEqual(groupFavoriteQuestions(values).map(([category, entries]) => [category, entries.length]), [["模板与定位", 1], ["图像处理基础", 1], ["标定与坐标", 1]].sort((a, b) => String(a[0]).localeCompare(String(b[0]), "zh-CN")));
});
