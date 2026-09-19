import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pagePath = fileURLToPath(new URL("../app/page.tsx", import.meta.url));

test("training UI exposes the learning-loop controls without a timer", async () => {
  const source = await readFile(pagePath, "utf8");
  for (const label of ["今日待复习", "稍后再学", "太难", "不感兴趣", "Ctrl/Cmd+Enter"]) {
    assert.ok(source.includes(label), `missing UI label: ${label}`);
  }
  assert.doesNotMatch(source, /setSeconds|formatTime/);
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "s"/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "b"/);
});
