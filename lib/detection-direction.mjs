const DIRECTIONS_BY_TECH_STACK = {
  HALCON: ["随机方向", "传统 2D 视觉", "3D 视觉", "深度学习"],
  OpenCV: ["随机方向", "传统 2D 算法", "3D 视觉", "DNN/深度学习"],
  VisionPro: ["随机方向", "传统 2D 工具链", "3D 视觉", "深度学习"],
};

const aliases = new Map([
  ["传统2d视觉", "传统 2D 视觉"],
  ["传统2d算法", "传统 2D 算法"],
  ["传统2d工具链", "传统 2D 工具链"],
  ["dnn/深度学习", "DNN/深度学习"],
  ["dnn / 深度学习", "DNN/深度学习"],
  ["3d视觉", "3D 视觉"],
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function detectionDirectionsForTechStack(techStack) {
  const value = cleanText(techStack);
  return DIRECTIONS_BY_TECH_STACK[value] ? [...DIRECTIONS_BY_TECH_STACK[value]] : [];
}

export function hasDetectionDirections(techStack) {
  return detectionDirectionsForTechStack(techStack).length > 0;
}

export function normalizeDetectionDirection(value) {
  const text = cleanText(value);
  return aliases.get(text.toLocaleLowerCase()) || text;
}

function directionForFamily(techStack, family) {
  const directions = detectionDirectionsForTechStack(techStack);
  if (family === "3d") return directions.find((item) => item === "3D 视觉") || "";
  if (family === "deep") return directions.find((item) => item.includes("深度学习")) || "";
  return directions.find((item) => item !== "随机方向" && !item.includes("3D") && !item.includes("深度学习")) || "";
}

export function inferDetectionDirection(question, techStack) {
  if (!hasDetectionDirections(techStack) || !question || typeof question !== "object") return "";
  const record = question;
  const text = [record.title, record.type, record.category, ...(Array.isArray(record.tags) ? record.tags : []), ...(Array.isArray(record.keywords) ? record.keywords : [])]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();
  if (/(3d|三维|点云|深度图|表面模型|立体视觉)/i.test(text)) return directionForFamily(techStack, "3d");
  if (/(深度学习|深度ocr|深度 ocr|dnn|cnn|神经网络|分类网络)/i.test(text)) return directionForFamily(techStack, "deep");
  return directionForFamily(techStack, "traditional");
}
