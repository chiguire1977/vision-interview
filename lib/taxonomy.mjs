export const KNOWLEDGE_CATEGORIES = [
  "图像处理基础",
  "边缘与特征",
  "模板与定位",
  "标定与坐标",
  "相机镜头光源",
  "C#与软件架构",
  "通讯协议",
];

export const TECH_STACKS = ["HALCON", "OpenCV", "VisionPro", "C#", "WPF"];

const categoryAliases = new Map([
  ["PLC与现场", "通讯协议"],
  ["PLC通信", "通讯协议"],
  ["PLC通讯", "通讯协议"],
]);

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

export function normalizeKnowledgeCategory(value) {
  const text = cleanText(value);
  return categoryAliases.get(text) || text;
}

export function normalizeTechStack(value) {
  const text = cleanText(value);
  return techStackAliases.get(text) || text;
}
