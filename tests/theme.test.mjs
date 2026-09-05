import test from "node:test";
import assert from "node:assert/strict";
import {
  THEME_OPTIONS,
  THEME_PALETTES,
  getThemeContrastFailures,
  normalizeThemeId,
  themeOptionById,
} from "../lib/theme.mjs";

test("theme options expose the selectable site themes without the removed high-contrast theme", () => {
  assert.deepEqual(THEME_OPTIONS.map((theme) => theme.id), [
    "ocean", "midnight", "graphite",
    "vscode-light", "vscode-dark", "one-dark", "dracula",
  ]);
  assert.deepEqual(THEME_OPTIONS.slice(0, 3).map((theme) => theme.label), ["海洋蓝", "午夜深色", "石墨灰"]);
  assert.deepEqual(THEME_OPTIONS.slice(3).map((theme) => theme.source), ["VS Code Light+", "VS Code Dark+", "One Dark Pro", "Dracula"]);
  assert.ok(THEME_OPTIONS.slice(3).every((theme) => theme.referenceUrl.startsWith("https://github.com/")));
  assert.equal(themeOptionById("midnight")?.label, "午夜深色");
  assert.equal(themeOptionById("vscode-dark")?.label, "VS Code Dark+");
  assert.equal(THEME_OPTIONS.some((theme) => theme.id === "contrast"), false);
  assert.equal(themeOptionById("contrast")?.id, "ocean");
});

test("invalid saved theme values fall back to the ocean theme", () => {
  assert.equal(normalizeThemeId("midnight"), "midnight");
  assert.equal(normalizeThemeId("contrast"), "ocean");
  assert.equal(normalizeThemeId("unknown"), "ocean");
  assert.equal(normalizeThemeId(null), "ocean");
});

test("every selectable theme has readable semantic foreground pairs", () => {
  assert.deepEqual(Object.keys(THEME_PALETTES).sort(), ["dracula", "graphite", "midnight", "ocean", "one-dark", "vscode-dark", "vscode-light"]);
  for (const theme of THEME_OPTIONS) {
    assert.deepEqual(getThemeContrastFailures(theme.id), [], `${theme.id} has low-contrast pairs`);
  }
});
