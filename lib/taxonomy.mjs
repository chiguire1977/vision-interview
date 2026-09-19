export const KNOWLEDGE_CATEGORIES = [
  "图像处理基础",
  "边缘与特征",
  "模板与定位",
  "标定与坐标",
  "相机镜头光源",
  "C#与软件架构",
  "通讯协议",
  "其他",
];

export const TECH_STACKS = ["HALCON", "OpenCV", "VisionPro", "C#", "WPF"];

/** @type {Map<string, string>} */
const categoryAliases = new Map([
  ["PLC与现场", "通讯协议"],
  ["PLC通信", "通讯协议"],
  ["PLC通讯", "通讯协议"],
]);

/** @type {Array<[string, RegExp]>} */
const categoryRules = [
  ["边缘与特征", /blob|区域|轮廓|分割|边缘|特征/i],
  ["模板与定位", /模板|定位|匹配|matching|template|localization|ocr|读码|字符识别/i],
  ["标定与坐标", /标定|坐标|仿射|透视|手眼/i],
  ["相机镜头光源", /相机|镜头|光源|曝光|照明/i],
  ["C#与软件架构", /c#|csharp|wpf|软件|架构|线程|异步/i],
  ["通讯协议", /plc|通讯|通信|modbus|tcp|串口|总线/i],
  ["图像处理基础", /图像处理|灰度|滤波|阈值|直方图|形态学/i],
];

/** @type {Map<string, string>} */
const techStackAliases = new Map([
  ["C#视觉开发", "C#"],
  ["CSharp", "C#"],
  ["csharp", "C#"],
  ["通用原理", "通用原理"],
  ["general", "通用原理"],
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function comparisonKey(value) {
  return cleanText(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}#]+/gu, "");
}

export function normalizeKnowledgeCategory(value) {
  const text = cleanText(value);
  if (!text) return "其他";
  const key = comparisonKey(text);
  const canonical = KNOWLEDGE_CATEGORIES.find((category) => comparisonKey(category) === key);
  if (canonical) return canonical;
  const alias = [...categoryAliases.entries()].find(([candidate]) => comparisonKey(candidate) === key);
  if (alias) return alias[1];
  const rule = categoryRules.find(([, pattern]) => pattern.test(text));
  return rule?.[0] || "其他";
}

export function normalizeTechStack(value) {
  const text = cleanText(value);
  return techStackAliases.get(text) || text;
}
