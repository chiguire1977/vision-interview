Warning: truncated output (original token count: 84807)
Total output lines: 4683

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Archive, BarChart3, BookOpenCheck, Bot, BrainCircuit, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, CircleCheck, Clock3, FileText, FolderKanban,
  BookOpen, Clipboard, Eye, EyeOff, Gauge, Globe2, GripVertical, HardDrive, Library, Lightbulb, ListTree, Mic, Pause, Play, RotateCcw, Save, Settings, Star, Upload,
  Palette, Pencil, Plus, ShieldCheck, Sparkles, Target, Trash2, UserRound, Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_QUESTION_MAX_ATTEMPTS,
  collectAiQuestionGroup,
  createQuestionBankArchiveEntries,
  deferAsyncTask,
  filterAiGeneratedQuestions,
  filterSimilarQuestionGroup,
  fillQuestionGroup,
  formatAiQuestionGroupProgress,
  isQuestionDirectionSemanticallyCompatible,
  mergeQuestionBankArchive,
  normalizeTrainingMode,
  prepareQuestionBankArchiveQuestions,
  questionKnowledgeClassKey,
  questionSourceForTrainingMode,
  runWithOptionalWebResearch,
  type AiGeneratedQuestion,
  type AiQuestionBlueprint,
  type AiQuestionGroupProgress,
  type AiQuestionSourceFilter,
  type QuestionBankArchiveEntry,
} from "@/lib/ai-question-bank";
import {
  filterQuestionBankItems,
  groupQuestionBankItems,
  mergeQuestionBankItems,
  type QuestionBankSourceFilter,
  type QuestionBankViewItem,
} from "@/lib/question-bank-view";
import {
  resolveQuestionSourceMode,
} from "@/lib/question-source-mode";
import {
  buildLearningFocus,
  buildLearningFocusPrompt,
  prioritizeQuestionCandidates,
} from "@/lib/adaptive-question-focus.mjs";
import {
  buildReviewQueue,
  selectReviewQuestions,
  summarizeReviewQueue,
} from "@/lib/review-queue.mjs";
import { primaryNavigationLabels, utilityNavigationLabels } from "@/lib/navigation.mjs";
import { analyzeLearningMastery, createImprovementPlan } from "@/lib/personal-center.mjs";
import { createGitHubBackupLog } from "@/lib/backup-log.mjs";
import { shouldShowTrainingSettings } from "@/lib/training-ui.mjs";
import { getAnswerCompletionAction, getPreviousQuestionIndex, shouldRestartQuestionGroupPreparation } from "@/lib/training-navigation.mjs";
import { THEME_OPTIONS, normalizeThemeId, themeOptionById } from "@/lib/theme.mjs";
import { modelDisplayName } from "@/lib/model-display.mjs";
import { detectionDirectionsForTechStack, hasDetectionDirections, inferDetectionDirection, normalizeDetectionDirection } from "@/lib/detection-direction.mjs";
import { evaluateAnswerAgainstReference, shouldRunAnswerReview } from "@/lib/answer-review.mjs";
import { buildQuestionBlueprint, normalizeQuestionBlueprint } from "@/lib/question-blueprint.mjs";
import { deriveMasteryStage, masteryStageFromReview, normalizeMasteryStage } from "@/lib/mastery.mjs";
import { AI_UPSTREAM_FORMAT_OPTIONS, DEFAULT_AI_UPSTREAM_FORMAT, normalizeAiUpstreamFormat } from "@/lib/ai-settings.mjs";
import { resolveAiUpstreamFormat } from "@/lib/ai-adapters.mjs";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/ai-request-timeout.mjs";
import {
  DEFAULT_PARALLEL_REQUESTS,
  DEFAULT_QUESTION_GROUP_SIZE,
  MAX_PARALLEL_REQUESTS,
  MAX_QUESTION_GROUP_SIZE,
  MIN_PARALLEL_REQUESTS,
  MIN_QUESTION_GROUP_SIZE,
  normalizeQuestionGroupSettings,
} from "@/lib/question-group-settings.mjs";
import {
  WEB_SOURCE_WHITELIST_STORAGE_KEY,
  normalizeWebSourceWhitelist,
  readWebSourceWhitelist,
  reorderWebSourceWhitelist,
  retrieveWebSources,
} from "@/lib/question-retrieval.mjs";
import {
  FAVORITES_STORAGE_KEY,
  filterFavoriteQuestions,
  groupFavoriteQuestions,
  isFavoriteQuestion,
  normalizeFavoriteQuestions,
  toggleFavoriteQuestion,
} from "@/lib/favorites.mjs";
import {
  appendRuntimeLog,
  clearRuntimeLogs,
  createScopedAutoBackupSnapshot,
  createRecordsUploadPayload,
  DEFAULT_GITHUB_CONNECTION_SETTINGS,
  DEFAULT_GITHUB_SYNC_SETTINGS,
  filterRuntimeLogs,
  filterRuntimeLogsBySession,
  githubApiUrl,
  GITHUB_CONNECTION_SETTINGS_STORAGE_KEY,
  GITHUB_SYNC_SETTINGS_STORAGE_KEY,
  normalizeRuntimeLogs,
  normalizeGitHubSyncSettings,
  readBackupFromStorage,
  readGitHubConnectionSettings,
  readGitHubSyncSettings,
  RUNTIME_LOG_STORAGE_KEY,
  startRuntimeSession,
  writeBackupToStorage,
} from "@/lib/backup-core.mjs";
import { KNOWLEDGE_CATEGORIES, TECH_STACKS, normalizeKnowledgeCategory, normalizeTechStack } from "@/lib/taxonomy.mjs";

type TrainingMode = "专业知识" | "项目答辩" | "综合模拟";
type TechStack = "HALCON" | "OpenCV" | "VisionPro" | "C#" | "WPF";
type AiProvider = string;
type AiUpstreamFormat = "chat-completions" | "responses" | "anthropic-messages";
type AiPreferences = {
  provider: AiProvider;
  model: string;
  upstreamFormat: AiUpstreamFormat;
  openaiBaseUrl: string;
  aiScoring: boolean;
  reviewEnabled: boolean;
  bestAnswer: boolean;
  smartFollowUp: boolean;
  webQuestions: boolean;
  adaptiveQuestions: boolean;
  questionGroupSize: number;
  parallelRequests: number;
};
type AiModelOption = { label: string; value: string; upstreamFormat?: AiUpstreamFormat };
type AiProviderDefinition = { id: AiProvider; name: string; description: string; baseUrl: string; models: AiModelOption[]; builtin?: boolean };
type AiProviderSettings = {
  name?: string;
  description?: string;
  model?: string;
  baseUrl?: string;
  openaiBaseUrl?: string;
  availableModels?: AiModelOption[];
};
type AiProviderSettingsStore = Record<string, AiProviderSettings>;
type MasteryLevel = "低" | "中" | "高";
type MasteryStage = "未掌握" | "部分掌握" | "已掌握" | "熟练";
type RuntimeLogLevel = "INFO" | "WARN" | "ERROR";
type RuntimeLogKind = "system" | "user";
type ThemeId = "ocean" | "midnight" | "graphite" | "vscode-light" | "vscode-dark" | "one-dark" | "dracula";
type RuntimeLog = {
  id: string;
  timestamp: string;
  level: RuntimeLogLevel;
  kind: RuntimeLogKind;
  sessionId?: string;
  event: string;
  message: string;
  context?: Record<string, unknown>;
};
type Question = {
  title: string; type: string; category: string; source: "专业" | "项目"; difficulty: string; tags: string[];
  keywords: string[]; followUp: string; hint: string; basis?: string; techStacks?: TechStack[];
  detectionDirection?: string;
  sourceType?: string; knowledgePoints?: string[];
  blueprint?: AiQuestionBlueprint;
  reference?: { title: string; url: string; snippet?: string };
  bestAnswer?: string; principle?: string;
  origin?: "AI" | "本地题库";
};
type WebResearchSource = { title: string; url: string; snippet: string };
type WebSourceWhitelistEntry = {
  id: string;
  url: string;
  enabled: boolean;
  fixed?: boolean;
  displayName?: string;
  available?: boolean;
  lastCheckedAt?: string;
  checkError?: string;
};

function sourceUrlKey(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().toLocaleLowerCase();
  } catch {
    return "";
  }
}

function verifiedReference(reference: Question["reference"], sources: WebResearchSource[]) {
  if (!reference) return undefined;
  const key = sourceUrlKey(reference.url);
  if (!key) return undefined;
  const source = sources.find((candidate) => sourceUrlKey(candidate.url) === key);
  return source
    ? { title: source.title, url: source.url, ...(source.snippet ? { snippet: source.snippet } : {}) }
    : undefined;
}

function isWebResearchSource(value: unknown): value is WebResearchSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return typeof source.title === "string" && Boolean(source.title.trim())
    && typeof source.url === "string" && /^https?:\/\//i.test(source.url)
    && typeof source.snippet === "string";
}

function isProfessionalQuestionValue(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const source = (value as { source?: unknown }).source;
  return source === "专业" || source === "professional" || source === "knowledge";
}
type TrainingRecord = {
  id?: string; question: string; score?: number; project: string; date: string;
  timestamp?: string; action?: "完成答题" | "跳过题目" | "查看答案"; mode?: TrainingMode;
  category?: string; source?: "专业" | "项目"; seconds?: number;
  answer?: string; bestAnswerViewed?: boolean;
  bestAnswer?: string;
  reviewIssues?: string[]; reviewSuggestions?: string[];
  mastery?: MasteryLevel; masteryUpdatedAt?: string;
  masteryReason?: string; reviewSource?: "AI" | "本地规则";
  reviewStatus?: "pending" | "reviewed" | "disabled";
  masteryStage?: MasteryStage;
  knowledgeKey?: string;
  questionType?: string;
  attemptId?: string;
  answerKeywords?: string[]; principle?: string;
};
type AnswerReview = { strengths: string[]; issues: string[]; suggestions: string[]; missing: string[]; coveredPoints?: string[]; criticalMissingPoints?: string[]; criticalCoveredPoints?: string[] };
type SessionAnswer = {
  question: Question; answer: string; seconds: number; status: "answered" | "skipped";
  bestAnswer: string; review: AnswerReview; mastery: MasteryLevel; masteryStage?: MasteryStage;
  reviewStatus: "pending" | "reviewed";
  masteryReason?: string; reviewSource?: "AI" | "本地规则";
  attemptId?: string;
};
type ProjectConfig = {
  id: string;
  name: string;
  category: string;
  progress: number;
};

const defaultProjects: ProjectConfig[] = [
  { id: "tire-ocr", name: "轮胎字符深度 OCR", category: "字符识别", progress: 82 },
  { id: "battery-defect", name: "锂电池极片缺陷分类", category: "缺陷分类", progress: 68 },
  { id: "glass-chipping", name: "前盖玻璃崩边检测", category: "外观检测", progress: 74 },
  { id: "vision-workflow", name: "视觉工作流框架", category: "软件架构", progress: 61 },
];

const techStackFilters = ["随机技术栈", ...TECH_STACKS] as const;
const difficultyFilters = ["随机难度", "基础", "中等", "困难"] as const;

const questionBank: Question[] = [
  {
    title: "为什么选择 HALCON 深度 OCR，而不是模板匹配？",
    type: "项目深挖", category: "项目答辩", source: "项目", difficulty: "中等", tags: ["倾斜字符", "磨损", "光照变化"],
    keywords: ["模板匹配", "深度 OCR", "倾斜", "磨损", "光照", "数据增强", "准确率", "测试集"],
    followUp: "你提到识别准确率，这个数据是如何统计的？测试集是否与训练集完全独立？",
    hint: "按照“结论—方案对比—项目数据—方案局限”四步回答。",
  },
  {
    title: "NCC 模板匹配为什么要先对图像和模板去均值？",
    type: "算法原理", category: "模板与定位", source: "专业", difficulty: "中等", tags: ["NCC", "归一化", "光照鲁棒性"],
    keywords: ["均值", "亮度", "相关性", "归一化", "灰度", "偏移", "分子", "分母"],
    followUp: "如果图像存在局部阴影，仅去均值是否足够？你会如何改善？",
    hint: "先说明去均值消除了什么，再解释归一化相关系数的分子和分母。",
  },
  {
    title: "视觉判定正确但 PLC 剔除失败，你会如何定位问题？",
    type: "现场故障", category: "通讯协议", source: "项目", difficulty: "困难", tags: ["PLC", "时序", "日志"],
    keywords: ["日志", "时序", "延迟", "握手", "触发", "队列", "工件", "异步"],
    followUp: "如果算法耗时偶发抖动，你如何保证剔除信号仍然对应正确工件？",
    hint: "按照“现象—定位—根因—修复—验证”回答，并说明如何关联工件 ID。",
  },
  {
    title: "九点标定解决了什么问题？完整实施步骤是什么？",
    type: "标定定位", category: "标定与坐标", source: "专业", difficulty: "中等", tags: ["像素坐标", "机械坐标", "仿射变换"],
    keywords: ["像素", "机械", "坐标", "九点", "仿射", "矩阵", "误差", "验证"],
    followUp: "标定完成后中心区域准确、边缘误差较大，可能是什么原因？",
    hint: "明确输入、输出、采点过程、矩阵求解和独立验证点。",
  },
  {
    title: "曝光时间和增益分别会对检测结果产生什么影响？",
    type: "光学硬件", category: "相机镜头光源", source: "专业", difficulty: "基础", tags: ["曝光", "增益", "运动模糊"],
    keywords: ["亮度", "曝光", "增益", "噪声", "运动模糊", "信噪比", "光源", "光圈"],
    followUp: "高速运动场景亮度不足时，你会按照什么顺序调整硬件和参数？",
    hint: "不要只说图像变亮，要说明曝光影响时间，增益会同时放大信号与噪声。",
  },
  {
    title: "Otsu 阈值分割为什么要让类间方差最大？",
    type: "算法原理", category: "图像处理基础", source: "专业", difficulty: "中等", tags: ["阈值分割", "类间方差", "直方图"],
    keywords: ["前景", "背景", "均值", "权重", "方差", "最大", "直方图", "双峰"],
    followUp: "当目标与背景灰度分布不是明显双峰时，Otsu 为什么容易失败？",
    hint: "从前景和背景可分性解释类间方差，不要只背公式。",
  },
  {
    title: "Sobel 算子为什么要分别计算 X 和 Y 方向梯度？",
    type: "算法原理", category: "图像处理基础", source: "专业", difficulty: "基础", tags: ["卷积", "梯度", "边缘方向"],
    keywords: ["卷积", "水平", "垂直", "梯度", "幅值", "方向", "一阶导数"],
    followUp: "得到 Gx 和 Gy 后，如何计算梯度幅值和边缘方向？",
    hint: "说明两个卷积核检测的灰度变化方向，再讲向量合成。",
  },
  {
    title: "Canny 边缘检测包含哪些步骤？每一步解决什么问题？",
    type: "算法流程", category: "边缘与特征", source: "专业", difficulty: "中等", tags: ["高斯滤波", "非极大值抑制", "双阈值"],
    keywords: ["高斯", "梯度", "非极大值", "双阈值", "滞后", "噪声", "细化", "连接"],
    followUp: "为什么仅对梯度幅值进行阈值分割，得到的边缘通常比较粗？",
    hint: "按降噪、求梯度、细化、筛选和连接五个阶段回答。",
  },
  {
    title: "形状模板匹配与 NCC 灰度模板匹配有什么区别？",
    type: "算法对比", category: "模板与定位", source: "专业", difficulty: "中等", tags: ["轮廓", "灰度", "旋转"],
    keywords: ["灰度", "轮廓", "梯度", "旋转", "光照", "纹理", "遮挡", "尺度"],
    followUp: "目标纹理丰富但轮廓不稳定时，你会优先选择哪一种？为什么？",
    hint: "从特征来源、鲁棒性、速度和适用场景四方面比较。",
  },
  {
    title: "RANSAC 为什么能够在存在大量离群点时估计模型？",
    type: "算法原理", category: "边缘与特征", source: "专业", difficulty: "困难", tags: ["随机采样", "内点", "模型估计"],
    keywords: ["随机", "最小样本", "模型", "内点", "离群点", "阈值", "迭代", "置信度"],
    followUp: "RANSAC 的迭代次数与内点比例有什么关系？",
    hint: "说明随机抽取最小样本、计算模型、统计内点和保留最佳模型。",
  },
  {
    title: "Harris 角点中的两个特征值分别表示什么？",
    type: "特征检测", category: "边缘与特征", source: "专业", difficulty: "困难", tags: ["结构张量", "特征值", "角点"],
    keywords: ["梯度", "结构张量", "特征值", "方向", "平坦", "边缘", "角点"],
    followUp: "为什么边缘区域通常只有一个较大的特征值？",
    hint: "不要把两个特征值简单等同于 X、Y，要说明主方向上的灰度变化强度。",
  },
  {
    title: "如何根据视野和最小缺陷尺寸估算相机分辨率？",
    type: "硬件选型", category: "相机镜头光源", source: "专业", difficulty: "中等", tags: ["视野", "像素精度", "安全系数"],
    keywords: ["视野", "缺陷", "像素", "分辨率", "安全系数", "宽度", "高度", "精度"],
    followUp: "为什么工程中不能让一个最小缺陷只占一个像素？",
    hint: "先算单像素对应的物理尺寸，再根据最小缺陷需要的像素数加入安全系数。",
  },
  {
    title: "同轴光、环形光和背光分别适合什么检测场景？",
    type: "光源选型", category: "相机镜头光源", source: "专业", difficulty: "基础", tags: ["反光表面", "轮廓", "表面缺陷"],
    keywords: ["同轴光", "环形光", "背光", "反光", "轮廓", "表面", "入射角"],
    followUp: "检测金属表面浅划痕时，为什么低角度照明通常更有效？",
    hint: "围绕光线入射方向、表面反射和目标特征回答。",
  },
  {
    title: "Eye-in-hand 与 Eye-to-hand 手眼标定有什么区别？",
    type: "标定定位", category: "标定与坐标", source: "专业", difficulty: "困难", tags: ["机器人", "坐标系", "位姿"],
    keywords: ["相机", "机器人", "末端", "固定", "坐标系", "位姿", "变换矩阵", "标定板"],
    followUp: "Eye-in-hand 标定时，为什么需要采集多个不同姿态而不只是平移？",
    hint: "先说明相机安装位置，再说明要求解的坐标变换关系。",
  },
  {
    title: "C# 视觉程序中如何设计采集、处理和结果输出线程？",
    type: "软件工程", category: "C#与软件架构", source: "专业", difficulty: "困难", tags: ["生产者消费者", "队列", "取消"],
    keywords: ["采集", "处理", "队列", "生产者", "消费者", "取消", "异常", "资源释放", "背压"],
    followUp: "算法处理速度低于相机采集速度时，队列应该无限增长吗？",
    hint: "说明线程职责、数据队列、背压策略、取消和异常处理。",
    techStacks: ["C#"],
    reference: { title: ".NET Channels 官方文档", url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/channels" },
  },
  {
    title: "HALCON 中 Image、Region 和 XLD 的区别是什么？",
    type: "HALCON 基础", category: "图像处理基础", source: "专业", difficulty: "基础", tags: ["Image", "Region", "XLD"],
    keywords: ["灰度", "区域", "轮廓", "像素", "几何", "亚像素", "运算对象"],
    followUp: "如果要做亚像素边缘拟合，为什么通常优先使用 XLD 而不是 Region？",
    hint: "分别从数据表达、是否包含灰度、精度和常用算子说明。",
    techStacks: ["HALCON"],
    reference: { title: "MVTec HALCON 官方文档", url: "https://www.mvtec.com/products/halcon/documentation" },
  },
  {
    title: "HALCON 的 dyn_threshold 与普通 threshold 有什么区别？",
    type: "HALCON 算子", category: "图像处理基础", source: "专业", difficulty: "中等", tags: ["dyn_threshold", "局部阈值", "光照不均"],
    keywords: ["全局阈值", "平滑图像", "局部", "灰度差", "光照不均", "Offset"],
    followUp: "平滑核过大或 Offset 过小时，结果分别可能出现什么问题？",
    hint: "先说明两个输入图像的关系，再结合不均匀背景解释局部比较。",
    techStacks: ["HALCON"],
    reference: { title: "MVTec dyn_threshold 算子参考", url: "https://www.mvtec.com/doc/halcon/2211/en/dyn_threshold.html" },
  },
  {
    title: "HALCON 形状模板匹配中的金字塔、角度范围和 Greediness 如何影响结果？",
    type: "HALCON 匹配", category: "模板与定位", source: "专业", difficulty: "困难", tags: ["shape model", "金字塔", "Greediness"],
    keywords: ["金字塔", "角度范围", "步长", "Greediness", "速度", "漏检", "精定位"],
    followUp: "现场要求提速但不能明显增加漏检，你会按什么顺序调整参数？",
    hint: "围绕搜索空间、粗到细定位和提前终止三个机制回答。",
    techStacks: ["HALCON"],
    reference: { title: "MVTec create_shape_model 算子参考", url: "https://www.mvtec.com/doc/halcon/2211/en/create_shape_model.html" },
  },
  {
    title: "OpenCV 中 cv::Mat 赋值、clone 和 copyTo 有什么区别？",
    type: "OpenCV 基础", category: "C#与软件架构", source: "专业", difficulty: "基础", tags: ["cv::Mat", "浅拷贝", "深拷贝"],
    keywords: ["引用计数", "数据共享", "浅拷贝", "深拷贝", "clone", "copyTo", "生命周期"],
    followUp: "函数返回局部 cv::Mat 为什么通常不会立即造成悬空数据？",
    hint: "重点说明矩阵头、底层数据、引用计数以及何时需要独立副本。",
    techStacks: ["OpenCV"],
    reference: { title: "OpenCV cv::Mat 官方参考", url: "https://docs.opencv.org/4.x/d3/d63/classcv_1_1Mat.html" },
  },
  {
    title: "OpenCV findContours 的检索模式和轮廓近似方式如何选择？",
    type: "OpenCV 轮廓", category: "边缘与特征", source: "专业", difficulty: "中等", tags: ["findContours", "RETR_TREE", "CHAIN_APPROX_SIMPLE"],
    keywords: ["外轮廓", "层级", "RETR_EXTERNAL", "RETR_TREE", "CHAIN_APPROX_NONE", "CHAIN_APPROX_SIMPLE", "内存"],
    followUp: "检测带孔零件时只使用 RETR_EXTERNAL 会丢失什么信息？",
    hint: "先根据是否需要父子层级选择检索模式，再根据点集精度与内存选择近似方式。",
    techStacks: ["OpenCV"],
    reference: { title: "OpenCV Structural Analysis 官方参考", url: "https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html" },
  },
  {
    title: "OpenCV 相机标定输出哪些参数，如何验证标定质量？",
    type: "OpenCV 标定", category: "标定与坐标", source: "专业", difficulty: "困难", tags: ["calibrateCamera", "畸变系数", "重投影误差"],
    keywords: ["内参", "外参", "畸变系数", "旋转", "平移", "重投影误差", "独立图像"],
    followUp: "平均重投影误差很小，为什么实际测量仍可能不准？",
    hint: "列出返回参数，再说明误差计算、样本覆盖和独立验证。",
    techStacks: ["OpenCV"],
    reference: { title: "OpenCV Camera Calibration 官方教程", url: "https://docs.opencv.org/4.x/dc/dbb/tutorial_py_calibration.html" },
  },
  {
    title: "VisionPro 的 CogPMAlign 与普通灰度模板匹配相比有什么优势？",
    type: "VisionPro 定位", category: "模板与定位", source: "专业", difficulty: "中等", tags: ["CogPMAlign", "PatMax", "定位"],
    keywords: ["几何特征", "旋转", "尺度", "遮挡", "对比度", "训练区域", "搜索区域"],
    followUp: "定位分数很高但位置偶发跳变，你会检查哪些训练与搜索参数？",
    hint: "从匹配特征、姿态变化、遮挡适应和工具配置角度回答。",
    techStacks: ["VisionPro"],
    reference: { title: "Cognex CogPMAlign 官方教程", url: "https://docs.cognex.com/vpro_930sr1/web/help/html/aa87a13d-16c8-4114-ab52-0c470f732b1e.htm" },
  },
  {
    title: "VisionPro 中 CogFixture 的作用是什么？为什么定位后要建立夹具坐标系？",
    type: "VisionPro 坐标", category: "标定与坐标", source: "专业", difficulty: "中等", tags: ["CogFixture", "坐标空间", "跟随定位"],
    keywords: ["坐标系", "变换", "定位结果", "Fixture", "测量区域", "跟随", "标定空间"],
    followUp: "Fixture 建立在像素空间与标定空间时，下游测量单位有什么区别？",
    hint: "说明上游定位结果如何变换图像空间，以及下游 ROI 为什么能跟随工件。",
    techStacks: ["VisionPro"],
    reference: { title: "Cognex Space Selection 官方说明", url: "https://docs.cognex.com/apasap_431/web/EN/UserManual/Content/Topics/General/Reference/Space%20Tree/Selected%20Space.htm" },
  },
  {
    title: "VisionPro 中 CogCaliper 如何稳定找到边缘，多个卡尺点如何用于直线拟合？",
    type: "VisionPro 测量", category: "边缘与特征", source: "专业", difficulty: "困难", tags: ["CogCaliper", "极性", "直线拟合"],
    keywords: ["投影", "边缘极性", "对比度", "卡尺", "异常点", "拟合", "阈值"],
    followUp: "表面有毛刺导致少数卡尺点偏离时，怎样避免直线结果被拉偏？",
    hint: "从一维投影找边、候选筛选、多点采样与稳健拟合回答。",
    techStacks: ["VisionPro"],
    reference: { title: "Cognex CogCaliper 官方参考", url: "https://docs.cognex.com/vpro_0x091500sr1/web/EN/help/html/T_Cognex_VisionPro_Caliper_CogCaliperTool.htm" },
  },
  {
    title: "C# 视觉程序为什么适合用有界 Channel 连接采集与处理？",
    type: "C# 并发", category: "C#与软件架构", source: "专业", difficulty: "中等", tags: ["Channel", "背压", "生产者消费者"],
    keywords: ["有界队列", "生产者", "消费者", "背压", "容量", "丢帧策略", "内存"],
    followUp: "在线检测要求处理最新画面时，Wait、DropOldest 和 DropWrite 你会选哪一种？",
    hint: "结合相机生产速度、算法消费速度、内存上限和业务丢帧规则回答。",
    techStacks: ["C#"],
    reference: { title: ".NET Channels 官方文档", url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/channels" },
  },
  {
    title: "C# 调用相机或图像 SDK 时为什么必须重视 IDisposable？",
    type: "C# 资源管理", category: "C#与软件架构", source: "专业", difficulty: "中等", tags: ["IDisposable", "非托管资源", "using"],
    keywords: ["非托管资源", "Dispose", "using", "图像缓冲区", "句柄", "内存泄漏", "finally"],
    followUp: "如果 SDK 对象同时实现 IDisposable 和 IAsyncDisposable，你会如何选择释放方式？",
    hint: "说明 GC 的边界、SDK 常见非托管资源、异常路径和确定性释放。",
    techStacks: ["C#"],
    reference: { title: ".NET Dispose 模式官方文档", url: "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose" },
  },
  {
    title: "C# 桌面视觉程序为什么不能在 UI 线程同步等待异步任务？",
    type: "C# 异步", category: "C#与软件架构", source: "专业", difficulty: "困难", tags: ["async/await", "UI 线程", "死锁"],
    keywords: ["UI 线程", "阻塞", "死锁", "await", "同步上下文", "Dispatcher", "取消"],
    followUp: "后台算法完成后，怎样安全更新 WPF 或 WinForms 控件？",
    hint: "解释同步等待、续体回到 UI 上下文和消息循环之间的关系。",
    techStacks: ["C#"],
    reference: { title: "C# Task 异步编程官方文档", url: "https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/task-asynchronous-programming-model" },
  },
  {
    title: "Modbus TCP 与 PLC 进行视觉握手时应包含哪些信号？",
    type: "工业通讯", category: "通讯协议", source: "专业", difficulty: "中等", tags: ["触发", "忙碌", "完成"],
    keywords: ["触发", "忙碌", "完成", "结果", "复位", "超时", "心跳", "序号"],
    followUp: "如果同一个触发信号保持高电平，如何避免视觉系统重复拍照？",
    hint: "围绕触发、忙碌、完成、结果、确认、复位和异常超时回答。",
  },
  {
    title: "你的 OCR 项目中，99.2% 的准确率具体是如何统计的？",
    type: "项目证据", category: "项目答辩", source: "项目", difficulty: "困难", tags: ["测试集", "统计口径", "误识别"],
    keywords: ["独立测试集", "字符级", "整图", "样本", "正确", "错误", "漏检", "误检"],
    followUp: "如果字符级准确率很高，但整串字符通过率较低，原因是什么？",
    hint: "明确样本数量、测试集来源、字符级或整图口径，以及误检漏检如何统计。",
  },
  {
    title: "请说明你在项目中亲自完成了哪些部分，最难的技术决策是什么？",
    type: "项目职责", category: "项目答辩", source: "项目", difficulty: "中等", tags: ["个人职责", "技术决策", "验证"],
    keywords: ["负责", "实现", "调试", "决策", "原因", "验证", "结果", "协作"],
    followUp: "这个技术决策如果重新做一次，你会改变什么？",
    hint: "清晰区分团队工作和个人工作，并给出一个有取舍的技术决策。",
  },
];

const professionalCategories = ["随机类型", ...KNOWLEDGE_CATEGORIES];

const webQuestionSources: Record<string, { title: string; url: string }> = {
  图像处理基础: {
    title: "Computer Vision Interview Questions · GitHub",
    url: "https://github.com/Devinterview-io/computer-vision-interview-questions",
  },
  边缘与特征: {
    title: "Computer Vision Interview Preparation · GitHub",
    url: "https://github.com/rohanmistry231/Computer-Vision-Interview-Preparation",
  },
  模板与定位: {
    title: "OpenCV Interview Questions",
    url: "https://opencv.org/computer-vision-engineer-interview-questions/",
  },
  标定与坐标: {
    title: "OpenCV Camera Calibration Tutorials",
    url: "https://docs.opencv.org/4.x/dc/dbb/tutorial_py_calibration.html",
  },
  相机镜头光源: {
    title: "Computer Vision Interview · GitHub",
    url: "https://github.com/badtyprr/computer-vision-interview",
  },
  "C#与软件架构": {
    title: "机器视觉工程实践题库 · 联网整理",
    url: "https://opencv.org/computer-vision-engineer-interview-questions/",
  },
  通讯协议: {
    title: "机器视觉工程实践题库 · 联网整理",
    url: "https://opencv.org/computer-vision-engineer-interview-questions/",
  },
};

const projectQuestionBasis: Record<string, string> = {
  "为什么选择 HALCON 深度 OCR，而不是模板匹配？": "项目算法：HALCON 深度 OCR；候选方案：传统模板匹配",
  "视觉判定正确但 PLC 剔除失败，你会如何定位问题？": "项目问题：图像处理延迟导致 PLC 未及时收到剔除信号",
  "你的 OCR 项目中，99.2% 的准确率具体是如何统计的？": "项目指标：字符识别准确率 99.2%",
  "请说明你在项目中亲自完成了哪些部分，最难的技术决策是什么？": "项目资料：个人职责、技术选型与现场调试记录",
};

const professionalBestAnswers: Record<string, string> = {
  "NCC 模板匹配为什么要先对图像和模板去均值？": "NCC 先分别减去模板和搜索窗口的平均灰度，使参与比较的是灰度相对均值的变化，而不是整体亮度。随后再用两侧能量进行归一化，把相关值限制到统一范围。因此它对整体亮度偏移更稳健，但局部阴影、强非线性光照和形变仍可能导致匹配下降。",
  "九点标定解决了什么问题？完整实施步骤是什么？": "九点标定用于建立图像像素坐标与机械平面坐标之间的映射。实施时让标定点覆盖整个视野，记录每个点的像素坐标和对应机械坐标，利用这些对应点求取仿射或更合适的变换模型，再用未参与求解的独立点验证误差。若边缘误差明显增大，还要检查镜头畸变、采点分布和标定平面是否一致。",
  "曝光时间和增益分别会对检测结果产生什么影响？": "曝光时间决定传感器积累光子的时间，增加曝光会提高亮度和信噪比，但会降低可用帧率并增加运动模糊。增益是在采集后放大电信号，能够快速增亮，但信号和噪声会一起放大。高速场景应优先改善光源、光圈和曝光，在仍不足时再谨慎增加增益。",
  "Otsu 阈值分割为什么要让类间方差最大？": "Otsu 对每个候选阈值把直方图分成前景和背景，计算两类的权重与均值。类间方差越大，说明两类中心距离越远、分离程度越好，因此选择类间方差最大的阈值。它适合灰度分布近似双峰的场景，光照不均或前背景严重重叠时应考虑局部阈值或先做光照校正。",
  "Sobel 算子为什么要分别计算 X 和 Y 方向梯度？": "图像灰度变化是二维向量，需要分别估计水平方向和垂直方向的一阶导数。Sobel 的两个卷积核得到 Gx 和 Gy，再通过平方和开方计算梯度幅值，通过 atan2(Gy,Gx) 计算方向。只有同时保留两个分量，才能描述任意方向的边缘强度与方向。",
  "Canny 边缘检测包含哪些步骤？每一步解决什么问题？": "Canny 先用高斯滤波抑制噪声，再计算梯度幅值和方向；然后用非极大值抑制把宽边缘细化为单像素候选；最后使用高低双阈值和滞后连接，保留强边缘以及与强边缘连通的弱边缘。这样同时兼顾抗噪、定位精度和边缘连续性。",
  "形状模板匹配与 NCC 灰度模板匹配有什么区别？": "NCC 比较模板与搜索窗口的灰度分布，适合纹理稳定、旋转尺度变化较小的目标。形状模板通常使用轮廓或梯度方向，对整体亮度变化更稳健，也更适合存在旋转、一定遮挡的工业目标。纹理丰富但轮廓不稳定时倾向 NCC；轮廓稳定、光照变化明显时倾向形状模板，最终仍需用现场样本验证。",
  "RANSAC 为什么能够在存在大量离群点时估计模型？": "RANSAC 反复随机抽取能够确定模型的最小样本，计算候选模型，再统计落在误差阈值内的内点数量，并保留内点支持最多的模型。只要某次抽样全部来自真实内点，就有机会得到正确模型。内点比例越低，为达到相同置信度所需的迭代次数越多。",
  "Harris 角点中的两个特征值分别表示什么？": "两个特征值表示结构张量两个主方向上的灰度变化强度，并不简单等同于图像 X、Y 方向。两个都小表示平坦区域；一个大一个小表示边缘，因为只在跨边缘方向变化明显；两个都大表示角点，因为沿两个独立方向移动都会产生明显灰度变化。",
  "如何根据视野和最小缺陷尺寸估算相机分辨率？": "先确定水平和垂直视野，再规定最小缺陷至少需要多少像素表达，工程上通常不能只占一个像素。所需水平像素数约等于水平视野除以允许的单像素物理尺寸，垂直方向同理，并加入定位误差、镜头质量和现场波动的安全系数。最终还要核对镜头分辨率与采集节拍。",
  "同轴光、环形光和背光分别适合什么检测场景？": "同轴光沿镜头轴线照明，适合平整高反光表面的印刷、划痕或灰度差异；环形光从多个方向照射，适合一般表面特征和减少方向性阴影；背光从物体背面形成高对比轮廓，适合尺寸、外形和孔洞检测。金属浅划痕常使用低角度暗场，让划痕散射光进入镜头而正常表面保持较暗。",
  "Eye-in-hand 与 Eye-to-hand 手眼标定有什么区别？": "Eye-in-hand 的相机安装在机器人末端，标定目标是求相机坐标系与末端坐标系的固定关系；Eye-to-hand 的相机固定在外部，通常求相机与机器人基坐标系之间的关系。采集多个不同姿态是为了提供充分的旋转和平移约束，仅做单方向平移容易导致方程退化或解不稳定。",
  "C# 视觉程序中如何设计采集、处理和结果输出线程？": "可以采用生产者—消费者模型：采集线程只负责触发与取图，把带工件序号的图像放入有界队列；处理线程消费图像并运行算法；结果线程按序号发送 PLC、记录日志和保存结果。队列必须有容量和背压策略，配合 CancellationToken、异常隔离和图像资源释放，不能在处理落后时无限增长。",
  "HALCON 中 Image、Region 和 XLD 的区别是什么？": "Image 保存规则像素网格上的灰度或多通道数据，是滤波、增强和灰度运算的输入；Region 表示由像素集合构成的区域，不保存灰度，适合连通域、面积、形态学等区域运算；XLD 是亚像素轮廓或多边形数据，适合边缘、几何拟合和轮廓匹配。需要亚像素测量时通常使用 XLD，需要掩膜和区域统计时使用 Region。",
  "HALCON 的 dyn_threshold 与普通 threshold 有什么区别？": "threshold 用固定灰度范围对整幅图做全局分割，适合背景稳定、直方图可分的场景。dyn_threshold 将原图与通常经过平滑的参考图逐点比较，根据两者灰度差和 Offset 提取比局部背景更亮或更暗的区域，因此更适合光照不均。平滑尺度应大于目标特征尺度；核太小会把缺陷一起平滑掉，Offset 太小则容易把噪声分出来。",
  "HALCON 形状模板匹配中的金字塔、角度范围和 Greediness 如何影响结果？": "金字塔让匹配先在低分辨率层粗搜，再回到高分辨率精定位，层数越多通常越快，但小特征可能在高层消失。角度范围和步长决定搜索空间，范围越大、步长越细，计算量越高。Greediness 控制候选提前淘汰，值高速度快但可能漏掉弱候选。提速时先收紧有效 ROI 和角度范围，再调整金字塔与步长，最后小幅提高 Greediness，并用困难样本验证召回率。",
  "OpenCV 中 cv::Mat 赋值、clone 和 copyTo 有什么区别？": "cv::Mat 由矩阵头和底层数据组成，直接赋值通常只复制矩阵头并增加数据引用计数，两个 Mat 共享同一块像素数据，修改像素会互相影响。clone 创建完整独立副本；copyTo 把数据复制到目标 Mat，还可配合掩膜。只读传递可以利用浅拷贝降低开销；跨线程、需要修改或生命周期边界不清时，应创建独立副本。",
  "OpenCV findContours 的检索模式和轮廓近似方式如何选择？": "RETR_EXTERNAL 只保留最外层轮廓，适合只关心物体外形；RETR_LIST 返回全部轮廓但不建立层级；RETR_CCOMP 建立两级结构；RETR_TREE 保留完整父子层级，适合孔洞和嵌套结构。CHAIN_APPROX_NONE 保存所有边界点，信息最完整但占内存；CHAIN_APPROX_SIMPLE 会压缩水平、垂直和斜线段，只保留端点，通常更适合常规形状分析。",
  "OpenCV 相机标定输出哪些参数，如何验证标定质量？": "calibrateCamera 主要输出相机内参矩阵、畸变系数，以及每张标定图对应的旋转和平移外参。验证时将标定板三维点按求得参数重新投影到图像，统计重投影误差，同时检查各张图的误差分布。标定图应覆盖视野、距离和姿态，最终还应使用未参与求解的图像或已知尺寸做独立验证，因为低重投影误差并不保证标定平面、镜头固定和测量模型都正确。",
  "VisionPro 的 CogPMAlign 与普通灰度模板匹配相比有什么优势？": "CogPMAlign/PatMax 主要利用目标的几何边缘特征进行训练和搜索，相比逐像素灰度相关，对整体亮度、一定程度的对比度变化、旋转、尺度变化和部分遮挡通常更稳健，并能输出位置、角度、尺度和得分。工程配置时要限制训练区域与搜索区域，设置合理的姿态范围，并避免训练到重复或不稳定特征。",
  "VisionPro 中 CogFixture 的作用是什么？为什么定位后要建立夹具坐标系？": "CogFixture 根据上游定位得到的位置和角度，在图像空间树中建立随工件运动的新坐标系。下游卡尺、测量和检测 ROI 都在该 Fixture 空间中定义，因此工件发生平移或旋转时，工具区域仍能跟随目标。Fixture 不会自动改变单位：建立在像素空间时下游仍是像素，建立在已标定空间时才可按毫米或英寸测量。",
  "VisionPro 中 CogCaliper 如何稳定找到边缘，多个卡尺点如何用于直线拟合？": "CogCaliper 沿卡尺方向对灰度进行一维投影，根据边缘极性、对比度阈值和期望位置选择边缘。FindLine 类工具会在多个卡尺位置独立得到边缘点，再对点集拟合直线。稳定性的关键是让卡尺方向垂直于真实边缘、限制搜索范围与极性，并通过异常点剔除或稳健拟合降低毛刺、缺口和反光点的影响。",
  "C# 视觉程序为什么适合用有界 Channel 连接采集与处理？": "Channel 能把相机采集作为生产者、算法处理作为消费者进行异步解耦。有界容量限制待处理帧数量，处理跟不上时产生明确背压，避免队列无限增长导致内存耗尽和结果延迟。策略取决于业务：逐件检测且不可丢帧时通常使用 Wait 并联动停机或降速；实时预览只关心最新画面时可考虑 DropOldest；无论哪种都要记录丢帧、帧号和队列水位。",
  "C# 调用相机或图像 SDK 时为什么必须重视 IDisposable？": "相机句柄、驱动缓冲区、原生图像内存和文件句柄通常是非托管资源，GC 只管理托管对象，不能保证这些资源及时释放。应使用 using/await using 或 try-finally 确保异常时也调用 Dispose/DisposeAsync，并明确对象所有权，避免重复释放。泄漏常表现为进程私有内存持续增长、取图失败、缓冲区耗尽或相机无法重新打开。",
  "C# 桌面视觉程序为什么不能在 UI 线程同步等待异步任务？": "UI 线程依赖消息循环处理绘制和输入。若在 UI 线程调用 .Result 或 Wait 同步阻塞，而异步任务的续体又要回到同一同步上下文，就可能互相等待形成死锁，即使不死锁也会造成界面卡顿。应让事件处理器一路 async/await，计算密集型算法放到受控后台任务，并通过 WPF Dispatcher、WinForms Invoke 或捕获的 UI 上下文更新控件，同时传递 CancellationToken。",
  "Modbus TCP 与 PLC 进行视觉握手时应包含哪些信号？": "典型握手包含触发、视觉忙、处理完成、结果值、PLC确认和复位，同时建议增加心跳、超时与工件序号。视觉只在检测到触发边沿且当前允许执行时拍照，置忙后完成处理，再写结果与完成信号；PLC读取后写确认，双方按约定复位。工件序号可避免异步处理时结果错位。",
};

const localProjectProfiles: Record<string, { solution: string; metric: string; challenge: string; tags: string[] }> = {
  "轮胎字符深度 OCR": {
    solution: "HALCON 深度 OCR、局部对比度增强、数据增强与 Modbus TCP",
    metric: "字符识别准确率 99.2%，目标节拍 60 件/分钟",
    challenge: "倾斜、磨损、字符阴影以及 PLC 结果时序",
    tags: ["深度 OCR", "数据增强", "Modbus TCP"],
  },
  "锂电池极片缺陷分类": {
    solution: "Canny 亚像素、Blob ROI、纹理与几何特征、HALCON MLP",
    metric: "对划痕、气泡和异物进行分类并发送 PLC 剔除",
    challenge: "复杂纹理、类别相似与误检漏检平衡",
    tags: ["缺陷分类", "纹理特征", "MLP"],
  },
  "前盖玻璃崩边检测": {
    solution: "双相机、斜射光、Blob 分析与缺陷等级划分",
    metric: "完成边缘崩边检测、等级判定和 PLC 剔除",
    challenge: "反光、边缘定位以及处理延迟导致的剔除失败",
    tags: ["双相机", "斜射光", "崩边检测"],
  },
  "视觉工作流框架": {
    solution: "WPF、MVVM、DAG 节点、类型化数据上下文与正交连线",
    metric: "实现可视化工具编排、运行跟踪和统一图像预览",
    challenge: "连接路由稳定性、上下文数据绑定和多结果传递",
    tags: ["WPF", "DAG", "数据上下文"],
  },
};

function buildLocalProjectQuestions(projectName: string): Question[] {
  const profile = localProjectProfiles[projectName] ?? localProjectProfiles["轮胎字符深度 OCR"];
  return [
    {
      title: `请完整介绍“${projectName}”的需求、方案和执行流程。`,
      type: "项目概述", category: "项目答辩", source: "项目", difficulty: "基础", tags: profile.tags,
      keywords: ["需求", "方案", "流程", "检测", "结果", "职责"],
      followUp: "这个项目中你本人负责了哪些模块？哪些工作是由其他成员完成的？",
      hint: "按照需求—硬件—算法—软件—通讯—结果的顺序回答。",
      basis: `本地方案：${profile.solution}`,
    },
    {
      title: `“${projectName}”中最关键的技术选型是什么？为什么这样选择？`,
      type: "技术选型", category: "项目答辩", source: "项目", difficulty: "中等", tags: profile.tags,
      keywords: ["选择", "原因", "对比", "优点", "局限", "验证"],
      followUp: "如果重新实施一次，你会保留这个方案还是更换其他算法？",
      hint: "说明候选方案、最终选择、取舍依据和验证结果。",
      basis: `本地技术方案：${profile.solution}`,
    },
    {
      title: `“${projectName}”的检测结果和性能指标是如何验证的？`,
      type: "项目证据", category: "项目答辩", source: "项目", difficulty: "困难", tags: ["测试集", "统计口径", "性能验证"],
      keywords: ["样本", "测试", "指标", "准确率", "节拍", "误检", "漏检", "验证"],
      followUp: "测试数据是否覆盖了现场最差工况？如何避免只在理想样本上验证？",
      hint: "明确样本规模、数据划分、指标口径、最差工况和连续运行时间。",
      basis: `本地指标记录：${profile.metric}`,
    },
    {
      title: `“${projectName}”遇到的最大现场问题是什么？你是如何定位和解决的？`,
      type: "现场故障", category: "项目答辩", source: "项目", difficulty: "困难", tags: ["故障定位", "根因", "验证"],
      keywords: ["现象", "日志", "定位", "根因", "解决", "验证", "结果"],
      followUp: "你如何证明修改真正解决了根因，而不是暂时掩盖了问题？",
      hint: "按照现象—排查—根因—解决—回归验证回答。",
      basis: `本地问题记录：${profile.challenge}`,
    },
  ];
}

function getBestAnswer(question: Question, projectName: string) {
  if (question.bestAnswer?.trim()) return question.bestAnswer.trim();
  if (question.source === "专业") {
    return professionalBestAnswers[question.title] ?? `回答这道题时，先准确说明“${question.title}”涉及的核心定义和原理，再按处理过程展开，最后补充适用场景、局限性以及与相近方案的区别。必须覆盖：${question.keywords.join("、")}。`;
  }
  const profile = localProjectProfiles[projectName] ?? localProjectProfiles["轮胎字符深度 OCR"];
  if (question.type === "项目概述") {
    return `这个项目是“${projectName}”。核心方案包括：${profile.solution}。项目主要需要处理${profile.challenge}。我会按照检测需求、硬件配置、算法流程、软件与通讯、最终指标的顺序介绍，其中实际设备数量、样本规模和个人职责需要以本地项目资料中的真实记录为准，不完整的数据标记为【待补充】。`;
  }
  if (question.type === "技术选型") {
    return `本项目的核心技术方案是：${profile.solution}。选择时需要与候选方案从鲁棒性、节拍、现场维护和开发成本进行比较，并用实际样本验证。面试回答中应明确说明最终方案解决了${profile.challenge}，同时坦诚它的局限；缺少的对比实验数据应标记为【待补充】，不能编造。`;
  }
  if (question.type === "项目证据") {
    return `本项目当前记录的结果是：${profile.metric}。完整回答还应给出样本规模、训练集与测试集划分、准确率或通过率的统计口径、误检漏检数量、单次耗时和连续运行时间。现有档案没有明确记录的数值必须回答“需要查阅项目测试报告确认”，不能临时估计。`;
  }
  return `本项目最大的现场难点是：${profile.challenge}。回答时应按“现象—日志与数据排查—根因—修改方案—回归验证”展开，并说明修改前后的可量化差异。当前项目资料未记录的时间、数量和精度数据使用【待补充】标记，不添加虚假结果。`;
}

const technicalPrinciples: Record<string, string> = {
  "NCC 模板匹配为什么要先对图像和模板去均值？": "基本原理：先减去模板和搜索窗口的平均灰度，再用归一化内积比较灰度变化方向，从而降低整体亮度偏移的影响；局部阴影和形变仍需要光学或算法补偿。",
  "Otsu 阈值分割为什么要让类间方差最大？": "基本原理：遍历候选阈值，把直方图分成前景和背景；类间方差同时考虑两类权重和均值距离，最大时表示两类分离度最好，因此选择该阈值。",
  "Sobel 算子为什么要分别计算 X 和 Y 方向梯度？": "基本原理：灰度变化是二维向量，分别用 X、Y 卷积核估计一阶导数 Gx、Gy，再计算梯度幅值和方向，才能描述任意方向的边缘。",
  "Canny 边缘检测包含哪些步骤？每一步解决什么问题？": "基本原理：高斯滤波抑制噪声，梯度计算找到变化方向，非极大值抑制细化边缘，双阈值和滞后连接保留强边缘及其连通的弱边缘。",
  "HALCON 的 dyn_threshold 与普通 threshold 有什么区别？": "基本原理：threshold 用固定灰度范围做全局分割；dyn_threshold 将原图与平滑得到的局部背景逐点比较，用灰度差和 Offset 判断目标比背景更亮或更暗，所以更适合光照不均。",
  "九点标定解决了什么问题？完整实施步骤是什么？": "基本原理：通过多个像素坐标与机械平面坐标的对应点，求解仿射或其他映射矩阵，将图像测量位置转换为设备可执行的机械坐标，并用独立点验证误差。",
  "Eye-in-hand 与 Eye-to-hand 手眼标定有什么区别？": "基本原理：Eye-in-hand 求相机与机器人末端之间的固定变换；Eye-to-hand 求外部固定相机与机器人基座之间的变换。多个不同姿态提供旋转和平移约束，避免方程退化。",
  "VisionPro 中 CogCaliper 如何稳定找到边缘，多个卡尺点如何用于直线拟合？": "基本原理：卡尺沿测量方向把二维图像投影为一维灰度剖面，通过极性和对比度阈值寻找边缘；多位置采样得到点集后，使用剔除异常点的拟合得到稳定直线。",
  "Modbus TCP 与 PLC 进行视觉握手时应包含哪些信号？": "基本原理：用触发、忙碌、完成、结果、确认和复位形成状态机，并通过超时、心跳和工件序号处理异常与异步错位，避免重复拍照或结果串件。",
};

function getQuestionPrinciple(question: Question, projectName: string) {
  if (question.principle?.trim()) return question.principle.trim();
  if (technicalPrinciples[question.title]) return technicalPrinciples[question.title];
  const technical = question.source === "专业" || /算法|技术|标定|HALCON|OpenCV|VisionPro|C#|PLC|通讯|相机|光源|模板|匹配|阈值|边缘/.test(`${question.type}${question.category}${question.title}`);
  if (!technical) return "";
  const context = question.source === "项目" ? `结合“${projectName}”的真实实现说明输入、处理、验证和异常边界。` : `围绕“${question.keywords.slice(0, 5).join("、")}”说明输入、处理过程、输出和适用边界。`;
  return `基本原理：${context}`;
}

type QuestionGenerationSelection = {
  trainingMode: TrainingMode;
  category: string;
  difficulty: string;
  techStack: string;
  detectionDirection: string;
  learningFocus?: ReturnType<typeof buildLearningFocus>;
};

type PreparedGroupResult = {
  questions: Question[];
  source: "AI" | "本地规则";
  message?: string;
  aiCount?: number;
};
type RecordsUploadResult = { ok: boolean; message: string };

const pendingQuestionGroupRequests = new Map<string, Promise<PreparedGroupResult>>();
const pendingAiQuestionBackupKey = "vision-interview-ai-question-bank-pending";
const aiQuestionBankStorageKey = "vision-interview-ai-question-bank";
const aiQuestionBankLastSyncKey = "vision-interview-ai-question-bank-last-sync";
const recordsUploadedSnapshotKey = "vision-interview-records-uploaded-snapshot";
const supportedTechStacks = new Set<TechStack>(TECH_STACKS as TechStack[]);

function configuredGithubApiUrl(path: string) {
  return githubApiUrl(path, readGitHubConnectionSettings(localStorage));
}

function isTechStack(value: string): value is TechStack {
  return supportedTechStacks.has(value as TechStack);
}

function parsePreparedQuestions(content: string) {
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  const jsonText = objectStart >= 0 && objectEnd >= objectStart
    ? cleaned.slice(objectStart, objectEnd + 1)
    : arrayStart >= 0 && arrayEnd >= arrayStart
      ? cleaned.slice(arrayStart, arrayEnd + 1)
      : cleaned;
  const parsed = JSON.parse(jsonText) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)) {
    return (parsed as { questions: unknown[] }).questions;
  }
  return [];
}

function normalizeGeneratedDifficulty(value: string, selection: QuestionGenerationSelection) {
  if (value === "基础" || value === "中等" || value === "困难") return value;
  return selection.difficulty === "基础" || selection.difficulty === "中等" || selection.difficulty === "困难"
    ? selection.difficulty
    : "中等";
}

function toAppQuestion(question: AiGeneratedQuestion, selection: QuestionGenerationSelection): Question {
  const source: Question["source"] = selection.trainingMode === "专业知识"
    ? "专业"
    : selection.trainingMode === "项目答辩"
      ? "项目"
      : question.source === "项目"
        ? "项目"
        : "专业";
  const generatedStacks = (question.techStacks ?? []).map(normalizeTechStack).filter(isTechStack);
  const techStacks = isTechStack(selection.techStack) ? [selection.techStack] : generatedStacks;
  const generatedDirection = normalizeDetectionDirection(question.detectionDirection);
  const detectionDirection = hasDetectionDirections(selection.techStack)
    ? selection.detectionDirection !== "随机方向"
      ? normalizeDetectionDirection(selection.detectionDirection)
      : generatedDirection
    : "";
  const difficulty = selection.difficulty === "基础" || selection.difficulty === "中等" || selection.difficulty === "困难"
    ? selection.difficulty
    : normalizeGeneratedDifficulty(question.difficulty, selection);
  const category = selection.category !== "随机类型" ? normalizeKnowledgeCategory(selection.category) : normalizeKnowledgeCategory(question.category);
  return {
    title: question.title,
    type: question.type,
    category,
    source,
    difficulty,
    tags: question.tags,
    keywords: question.keywords,
    followUp: question.followUp,
    hint: question.hint,
    ...(question.basis ? { basis: question.basis } : {}),
    ...(question.sourceType ? { sourceType: question.sourceType } : {}),
    ...(question.knowledgePoints?.length ? { knowledgePoints: question.knowledgePoints } : {}),
    blueprint: normalizeQuestionBlueprint(question.blueprint ?? buildQuestionBlueprint(question)),
    ...(techStacks.length ? { techStacks } : {}),
    ...(detectionDirection ? { detectionDirection } : {}),
    ...(question.reference ? { reference: question.reference } : {}),
    bestAnswer: question.bestAnswer,
    principle: question.principle,
    origin: "AI",
  };
}

function buildQuestionFallbackPool(
  candidates: Question[],
  projectName: string,
  selection: QuestionGenerationSelection,
) {
  const professional = questionBank.filter((item) => item.source === "专业");
  const projectQuestions = buildLocalProjectQuestions(projectName);
  const matchesSelection = (question: Question) => {
    const expectedSource = questionSourceForTrainingMode(selection.trainingMode);
    if (expectedSource !== "专业或项目" && question.source !== expectedSource) return false;
    if (selection.category !== "随机类型" && question.category !== selection.category) return false;
    if (selection.difficulty !== "随机难度" && question.difficulty !== selection.difficulty) return false;
    if (selection.techStack !== "随机技术栈" && !(question.techStacks ?? []).includes(selection.techStack as TechStack)) return false;
    if (selection.detectionDirection !== "随机方向" && hasDetectionDirections(selection.techStack)) {
      const questionDirection = normalizeDetectionDirection(question.detectionDirection || inferDetectionDirection(question, selection.techStack));
      if (questionDirection !== normalizeDetectionDirection(selection.detectionDirection)) return false;
    }
    return true;
  };
  const supplemental = selection.trainingMode === "专业知识"
    ? professional
    : selection.trainingMode === "项目答辩"
      ? projectQuestions
      : [...professional, ...projectQuestions];
  const orderedCandidates = selection.learningFocus?.active
    ? prioritizeQuestionCandidates(candidates, selection.learningFocus)
    : candidates;
  const orderedSupplemental = selection.learningFocus?.active
    ? prioritizeQuestionCandidates(supplemental, selection.learningFocus)
    : supplemental;
  const seen = new Set<string>();
  return [...orderedCandidates.filter(matchesSelection), ...orderedSupplemental.filter(matchesSelection)]
    .filter((question) => {
      const key = question.title.trim().toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((question) => ({
      ...question,
      ...(selection.detectionDirection !== "随机方向" && hasDetectionDirections(selection.techStack)
        ? { detectionDirection: normalizeDetectionDirection(question.detectionDirection || inferDetectionDirection(question, selection.techStack)) }
        : {}),
      bestAnswer: getBestAnswer({ ...question, bestAnswer: undefined }, projectName),
      principle: getQuestionPrinciple(question, projectName)
        || `本题主要考察“${question.title}”的工程判断与表达，请结合输入、处理、验证和异常边界说明。`,
    }));
}

type AiQuestionBankSyncResult = { archived: boolean; pendingCount: number };

async function syncAiQuestionBankBackup(entries: QuestionBankArchiveEntry[]): Promise<AiQuestionBankSyncResult> {
  let previous: unknown[] = [];
  let cached: unknown[] = [];
  try {
    const saved = JSON.parse(localStorage.getItem(pendingAiQuestionBackupKey) || "[]") as unknown;
    previous = Array.isArray(saved) ? saved : [];
  } catch {
    previous = [];
  }
  try {
    const saved = JSON.parse(localStorage.getItem(aiQuestionBankStorageKey) || "[]") as unknown;
    cached = Array.isArray(saved) ? saved : [];
  } catch {
    cached = [];
  }

  const pending = mergeQuestionBankArchive(previous, entries);
  const completeArchive = mergeQuestionBankArchive(mergeQuestionBankArchive(cached,…54807 tokens truncated…rview-ai-key-${id}`) || "");
    } else if (preferences.provider === id) {
      const nextPreferences = { ...preferences, openaiBaseUrl: baseUrl };
      setPreferences(nextPreferences);
      persistActivePreferences(nextPreferences);
      persistProviderSettings(nextPreferences, availableModels);
    }
    setSaved(false);
    setTestResult({ ok: true, message: `服务商“${name}”已保存。` });
  }

  function removeCustomProvider(provider: AiProvider) {
    const definition = providerOptions.find((item) => item.id === provider);
    if (!definition || definition.builtin || !window.confirm(`确定删除“${definition.name}”及其本地配置吗？`)) return;
    const settings = readAiProviderSettings();
    delete settings[provider];
    writeAiProviderSettings(settings);
    setProviderSettings(settings);
    sessionStorage.removeItem(`vision-interview-ai-key-${provider}`);
    if (preferences.provider === provider) {
      const fallback = builtinAiProviders[0];
      const fallbackSettings = settings[fallback.id];
      const models = fallbackSettings?.availableModels?.length ? fallbackSettings.availableModels : fallback.models;
      const nextPreferences = { ...preferences, provider: fallback.id, model: fallbackSettings?.model || models[0]?.value || "", openaiBaseUrl: fallback.baseUrl };
      setPreferences(nextPreferences);
      persistActivePreferences(nextPreferences);
      persistProviderSettings(nextPreferences, models);
      setAvailableModels(models);
      setApiKey(sessionStorage.getItem(`vision-interview-ai-key-${fallback.id}`) || "");
    }
    setSaved(false);
    setTestResult({ ok: true, message: `已删除服务商“${definition.name}”。` });
  }

  function savePreferences() {
    const nextPreferences = { ...preferences, ...normalizeQuestionGroupSettings(preferences) };
    setPreferences(nextPreferences);
    localStorage.setItem("vision-interview-ai-preferences", JSON.stringify(nextPreferences));
    persistProviderSettings(nextPreferences, availableModels);
    const sessionKey = `vision-interview-ai-key-${preferences.provider}`;
    if (apiKey.trim()) sessionStorage.setItem(sessionKey, apiKey.trim());
    else sessionStorage.removeItem(sessionKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  function persistWebSourceWhitelist(nextValues: WebSourceWhitelistEntry[]) {
    const next = normalizeWebSourceWhitelist([...nextValues, ...readWebSourceWhitelist(null)]);
    localStorage.setItem(WEB_SOURCE_WHITELIST_STORAGE_KEY, JSON.stringify(next));
    setWebSourceWhitelist(next);
    setSaved(false);
    recordRuntimeEvent("INFO", "question-bank.web-whitelist.changed", "联网题目网址白名单已更新", {
      count: next.length,
      enabledCount: next.filter((entry) => entry.enabled).length,
      order: next.map((entry) => entry.url),
    });
  }

  function saveWebSourceWhitelist() {
    persistWebSourceWhitelist(webSourceWhitelist);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  function openAddWhitelistEntry() {
    setWhitelistDraft({ url: "https://", enabled: true });
    setWhitelistFormError("");
  }

  function openEditWhitelistEntry(entry: WebSourceWhitelistEntry) {
    setWhitelistDraft({ id: entry.id, url: entry.url, enabled: entry.enabled });
    setWhitelistFormError("");
  }

  async function validateWhitelistEntryUrl(url: string) {
    const response = await fetch("/api/web-source/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const result = await response.json() as { ok?: boolean; url?: string; displayName?: string; message?: string };
    if (!response.ok || !result.ok || !result.displayName) {
      throw new Error(result.message || "网址检测失败，请检查地址后重试。");
    }
    return { url: result.url || url, displayName: result.displayName };
  }

  async function saveWhitelistEntry() {
    if (!whitelistDraft) return;
    const normalized = normalizeWebSourceWhitelist([{ ...whitelistDraft, id: whitelistDraft.id || `source-${Date.now().toString(36)}` }]);
    if (!normalized.length) {
      setWhitelistFormError("请输入有效的 http:// 或 https:// 网址。");
      return;
    }
    const normalizedCandidate = normalized[0];
    const existingEntry = whitelistDraft.id ? webSourceWhitelist.find((entry) => entry.id === whitelistDraft.id) : undefined;
    const duplicate = webSourceWhitelist.find((entry) => entry.url === normalizedCandidate.url && entry.id !== whitelistDraft.id);
    if (duplicate) {
      setWhitelistFormError("该网址已经在白名单中。");
      return;
    }
    const candidate = existingEntry && existingEntry.url === normalizedCandidate.url
      ? { ...existingEntry, ...normalizedCandidate }
      : normalizedCandidate;
    const needsValidation = !existingEntry || existingEntry.url !== candidate.url;
    const checkingId = whitelistDraft.id || "__new__";
    setWhitelistCheckingId(checkingId);
    setWhitelistFormError("");
    try {
      const checked = needsValidation ? await validateWhitelistEntryUrl(candidate.url) : { url: candidate.url, displayName: candidate.displayName || "" };
      const checkedCandidate = {
        ...candidate,
        url: checked.url,
        ...(checked.displayName ? { displayName: checked.displayName } : {}),
        available: true,
        lastCheckedAt: new Date().toISOString(),
        checkError: "",
      };
      const next = whitelistDraft.id
        ? webSourceWhitelist.map((entry) => entry.id === whitelistDraft.id ? checkedCandidate : entry)
        : [...webSourceWhitelist, checkedCandidate];
      persistWebSourceWhitelist(next);
      setWhitelistDraft(null);
      setWhitelistFormError("");
    } catch (error) {
      setWhitelistFormError(error instanceof Error ? error.message : "网址检测失败，请检查地址后重试。");
    } finally {
      setWhitelistCheckingId(null);
    }
  }

  function removeWhitelistEntry(entry: WebSourceWhitelistEntry) {
    if (entry.fixed) return;
    if (!window.confirm(`确定删除白名单网址“${entry.url}”吗？`)) return;
    persistWebSourceWhitelist(webSourceWhitelist.filter((item) => item.id !== entry.id));
  }

  function toggleWhitelistEntry(entry: WebSourceWhitelistEntry) {
    if (entry.fixed) return;
    persistWebSourceWhitelist(webSourceWhitelist.map((item) => item.id === entry.id ? { ...item, enabled: !item.enabled } : item));
  }

  async function recheckWhitelistEntry(entry: WebSourceWhitelistEntry) {
    setWhitelistCheckingId(entry.id);
    try {
      const checked = await validateWhitelistEntryUrl(entry.url);
      persistWebSourceWhitelist(webSourceWhitelist.map((item) => item.id === entry.id ? {
        ...item,
        url: checked.url,
        displayName: checked.displayName,
        available: true,
        lastCheckedAt: new Date().toISOString(),
        checkError: "",
      } : item));
    } catch (error) {
      persistWebSourceWhitelist(webSourceWhitelist.map((item) => item.id === entry.id ? {
        ...item,
        available: false,
        lastCheckedAt: new Date().toISOString(),
        checkError: error instanceof Error ? error.message : "网址检测失败，请稍后重试。",
      } : item));
    } finally {
      setWhitelistCheckingId(null);
    }
  }

  function dropWhitelistEntry(targetId: string) {
    if (!draggedWhitelistId || draggedWhitelistId === targetId) return;
    const fromIndex = webSourceWhitelist.findIndex((entry) => entry.id === draggedWhitelistId);
    const toIndex = webSourceWhitelist.findIndex((entry) => entry.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    persistWebSourceWhitelist(reorderWebSourceWhitelist(webSourceWhitelist, fromIndex, toIndex));
    setDraggedWhitelistId(null);
  }

  async function fetchModels() {
    if (!baseUrl.trim()) {
      setTestResult({ ok: false, message: "请填写 API 请求地址。" });
      return;
    }
    if (!hasCredential) {
      setTestResult({ ok: false, message: "请填写 API Key。" });
      return;
    }
    setLoadingModels(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({ provider: preferences.provider, baseUrl, apiKey: apiKey.trim() || undefined }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; models?: string[] };
      if (result.ok && result.models?.length) {
        const models = result.models.map((model) => {
          const upstreamFormat = resolveAiUpstreamFormat(baseUrl, model, preferences.upstreamFormat);
          const formatLabel = AI_UPSTREAM_FORMAT_OPTIONS.find((option) => option.value === upstreamFormat)?.label || upstreamFormat;
          return { label: `${model} · ${formatLabel}`, value: model, upstreamFormat };
        });
        const nextModel = result.models.includes(preferences.model) ? preferences.model : result.models[0];
        const nextModelOption = models.find((model) => model.value === nextModel);
        setAvailableModels(models);
        const nextPreferences = { ...preferences, model: nextModel, upstreamFormat: nextModelOption?.upstreamFormat || preferences.upstreamFormat };
        setPreferences(nextPreferences);
        persistActivePreferences(nextPreferences);
        persistProviderSettings(nextPreferences, models);
      }
      setTestResult({ ok: Boolean(result.ok), message: result.message || "未收到测试结果。" });
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "获取模型请求超时，请稍后重试。"
        : "无法连接网站服务器，请稍后重试。";
      setTestResult({ ok: false, message });
    } finally {
      setLoadingModels(false);
    }
  }

  async function testConnection() {
    if (!baseUrl.trim()) {
      setTestResult({ ok: false, message: "请填写 API 请求地址。" });
      return;
    }
    if (!preferences.model.trim()) {
      setTestResult({ ok: false, message: "请先填写或获取模型 ID。" });
      return;
    }
    if (!hasCredential) {
      setTestResult({ ok: false, message: "请填写 API Key。" });
      return;
    }
    const upstreamFormat = effectiveUpstreamFormat;
    const formatLabel = AI_UPSTREAM_FORMAT_OPTIONS.find((option) => option.value === upstreamFormat)?.label || upstreamFormat;
    const startedAt = performance.now();
    setLoadingTest(true);
    setTestResult(null);
    recordRuntimeEvent("INFO", "ai.connection-test.started", "开始真实聊天连接测试", {
      provider: preferences.provider,
      model: preferences.model,
      upstreamFormat,
    });
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          provider: preferences.provider,
          upstreamFormat,
          baseUrl,
          model: preferences.model,
          maxTokens: 64,
          temperature: 0.1,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          messages: [{ role: "user", content: "请只回复：连接成功" }],
        }),
      });
      const result = await response.json() as { ok?: boolean; content?: string; message?: string; format?: string };
      const durationMs = Math.round(performance.now() - startedAt);
      if (result.ok && result.content?.trim()) {
        if (apiKey.trim()) sessionStorage.setItem(`vision-interview-ai-key-${preferences.provider}`, apiKey.trim());
        const nextPreferences = { ...preferences, upstreamFormat };
        setPreferences(nextPreferences);
        persistActivePreferences(nextPreferences);
        persistProviderSettings(nextPreferences, availableModels);
        recordRuntimeEvent("INFO", "ai.connection-test.completed", "真实聊天连接测试成功", {
          provider: preferences.provider,
          model: preferences.model,
          upstreamFormat,
          durationMs,
        });
        setTestResult({ ok: true, message: `真实聊天测试成功：${formatLabel} · ${preferences.model} · ${durationMs} ms` });
      } else {
        const message = result.message || `真实聊天测试失败（HTTP ${response.status}）。`;
        recordRuntimeEvent("WARN", "ai.connection-test.failed", message, {
          provider: preferences.provider,
          model: preferences.model,
          upstreamFormat: result.format || upstreamFormat,
          status: response.status,
          durationMs,
        });
        setTestResult({ ok: false, message: `真实聊天测试失败：${message}` });
      }
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const message = error instanceof Error && error.name === "TimeoutError" ? "真实聊天请求超时。" : "无法连接网站服务器，请稍后重试。";
      recordRuntimeEvent("ERROR", "ai.connection-test.failed", message, {
        provider: preferences.provider,
        model: preferences.model,
        upstreamFormat,
        durationMs,
      });
      setTestResult({ ok: false, message });
    } finally {
      setLoadingTest(false);
    }
  }

  type GitHubSnapshot = {
    backupResponse: Response;
    backupBody: { ok?: boolean; available?: boolean; data?: Record<string, unknown>; updatedAt?: string; reason?: string };
    questionBankResponse: Response;
    questionBankBody: { ok?: boolean; available?: boolean; questions?: unknown[]; questionCount?: number; updatedAt?: string; reason?: string };
  };

  async function readGitHubSnapshot(): Promise<GitHubSnapshot> {
    const [backupResponse, questionBankResponse] = await Promise.all([
      fetch(configuredGithubApiUrl("/api/backup"), { cache: "no-store" }),
      fetch(configuredGithubApiUrl("/api/question-bank"), { cache: "no-store" }),
    ]);
    const [backupBody, questionBankBody] = await Promise.all([
      backupResponse.json() as Promise<GitHubSnapshot["backupBody"]>,
      questionBankResponse.json() as Promise<GitHubSnapshot["questionBankBody"]>,
    ]);
    return { backupResponse, backupBody, questionBankResponse, questionBankBody };
  }

  function isAvailable(response: Response, body: { ok?: boolean; available?: boolean }) {
    return response.ok && body.ok !== false && body.available !== false;
  }

  async function refreshGithubStatus() {
    try {
      const snapshot = await readGitHubSnapshot();
      const backupAvailable = isAvailable(snapshot.backupResponse, snapshot.backupBody);
      const questionBankAvailable = isAvailable(snapshot.questionBankResponse, snapshot.questionBankBody);
      const updatedAt = snapshot.backupBody.updatedAt || snapshot.questionBankBody.updatedAt;
      setGithubStatus({
        state: backupAvailable && questionBankAvailable ? "connected" : "offline",
        detail: backupAvailable && questionBankAvailable
          ? `已连接 · AI 题库 ${snapshot.questionBankBody.questionCount ?? snapshot.questionBankBody.questions?.length ?? 0} 题`
          : "GitHub 存档暂不可用，仍可继续使用本地数据",
        updatedAt,
        questionCount: snapshot.questionBankBody.questionCount ?? snapshot.questionBankBody.questions?.length ?? 0,
      });
    } catch (error) {
      setGithubStatus({ state: "error", detail: error instanceof Error ? error.message : "GitHub 状态检查失败" });
    }
  }

  async function testGithubConnection() {
    setGithubBusy(true);
    setGithubStatus((current) => ({ ...current, state: "loading", detail: "正在测试 GitHub 仓库连接和服务端凭据" }));
    await refreshGithubStatus();
    recordRuntimeEvent("INFO", "backup.connection.tested", "GitHub 连接测试完成", {
      repository: readGitHubConnectionSettings(localStorage).repository,
      branch: readGitHubConnectionSettings(localStorage).branch,
    });
    setGithubBusy(false);
  }

  async function saveGitHubToken() {
    const token = githubTokenInput.trim();
    if (!token) {
      setGithubTokenMessage("请输入新的 GitHub Token。");
      return;
    }
    const connection = readGitHubConnectionSettings(localStorage);
    setGithubTokenBusy(true);
    setGithubTokenMessage("正在验证 Token 的仓库读写权限…");
    try {
      const response = await fetch(configuredGithubApiUrl("/api/github/credentials"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, repository: connection.repository, branch: connection.branch }),
      });
      const body = await response.json() as { ok?: boolean; reason?: string };
      if (!response.ok || body.ok !== true) throw new Error(body.reason || `Token 验证失败（HTTP ${response.status}）。`);
      setGithubTokenInput("");
      setGithubTokenMessage("Token 验证成功，已保存到当前浏览器安全会话。");
      recordRuntimeEvent("INFO", "backup.connection.credential.updated", "GitHub Token 已验证并保存到当前浏览器安全会话", {
        repository: connection.repository,
        branch: connection.branch,
      });
      await refreshGithubStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token 验证失败。";
      setGithubTokenMessage(message);
      recordRuntimeEvent("WARN", "backup.connection.credential.update.failed", "GitHub Token 验证失败", {
        repository: connection.repository,
        branch: connection.branch,
        error: message,
      });
    } finally {
      setGithubTokenBusy(false);
    }
  }

  async function clearGitHubToken() {
    setGithubTokenBusy(true);
    setGithubTokenMessage("正在清除浏览器 Token…");
    try {
      const response = await fetch(configuredGithubApiUrl("/api/github/credentials"), { method: "DELETE" });
      const body = await response.json() as { ok?: boolean; reason?: string };
      if (!response.ok || body.ok !== true) throw new Error(body.reason || `清除失败（HTTP ${response.status}）。`);
      setGithubTokenInput("");
      setGithubTokenMessage("浏览器 Token 已清除，后续将回退到服务器环境变量。");
      recordRuntimeEvent("INFO", "backup.connection.credential.cleared", "已清除当前浏览器 GitHub Token", {});
      await refreshGithubStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "清除浏览器 Token 失败。";
      setGithubTokenMessage(message);
    } finally {
      setGithubTokenBusy(false);
    }
  }

  function saveGitHubConnection() {
    const repository = githubConnection.repository.trim();
    const branch = githubConnection.branch.trim();
    const normalized = normalizeGitHubConnectionSettings({ repository, branch }) as GitHubConnectionSettings;
    const repositoryPath = repository.replace(/^https?:\/\/github\.com\//i, "").replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    const repositoryInputIsPath = /^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(repositoryPath);
    const branchIsValid = /^[A-Za-z0-9._/-]{1,200}$/.test(branch) && !branch.includes("..");
    if ((!repositoryInputIsUrl && !repositoryInputIsPath) || !normalized.repository || !branchIsValid) {
      setGithubStatus({ state: "error", detail: "请填写有效的 GitHub 仓库（owner/repo）和分支名称。" });
      return;
    }
    setGithubConnection(normalized);
    localStorage.setItem(GITHUB_CONNECTION_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event("vision-interview-github-connection-changed"));
    setSaved(true);
    recordRuntimeEvent("INFO", "backup.connection.changed", "GitHub 连接设置已更新", {
      repository: normalized.repository,
      branch: normalized.branch,
    });
    window.setTimeout(() => setSaved(false), 2400);
    void refreshGithubStatus();
  }

  function saveGitHubSyncSettings(value: GitHubSyncSettings) {
    const next = normalizeGitHubSyncSettings(value) as GitHubSyncSettings;
    setGithubSyncSettings(next);
    localStorage.setItem(GITHUB_SYNC_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("vision-interview-backup-settings-changed"));
    setSaved(true);
    recordRuntimeEvent("INFO", "backup.settings.changed", "GitHub 备份范围已更新", {
      autoBackup: next.autoBackup,
      syncAiSettings: next.syncAiSettings,
      syncFavorites: next.syncFavorites,
      syncProjects: next.syncProjects,
      syncRuntimeLogs: next.syncRuntimeLogs,
      syncQuestionBank: next.syncQuestionBank,
    });
    window.setTimeout(() => setSaved(false), 2400);
  }

  const features: { key: keyof Pick<AiPreferences, "reviewEnabled" | "aiScoring" | "bestAnswer" | "smartFollowUp">; title: string; description: string }[] = [
    { key: "reviewEnabled", title: "启用回答评审", description: "完成整个题组后，将回答与最佳回答对照，检查关键内容是否覆盖" },
    { key: "aiScoring", title: "AI 回答审阅与掌握度", description: "优先使用 AI 进行题组要点评审；AI 不可用时自动使用内置规则兜底，不进行分数计算" },
    { key: "bestAnswer", title: "生成最佳回答", description: "结合题目和项目资料生成个性化参考答案" },
    { key: "smartFollowUp", title: "智能连续追问", description: "根据回答中的遗漏点继续追问，而不是固定题目" },
  ];
  const settingsSections: { key: SettingsSection; title: string; description: string; icon: typeof Settings }[] = [
    { key: "model", title: "模型服务", description: "服务商、地址、密钥与模型", icon: Bot },
    { key: "training", title: "训练偏好", description: "AI 能力与学习方式", icon: BrainCircuit },
    { key: "group", title: "题组设置", description: "题目数量与并行生成", icon: ListTree },
    { key: "github", title: "GitHub 同步", description: "备份范围与同步状态", icon: HardDrive },
    { key: "whitelist", title: "网址白名单", description: "联网题目来源优先级", icon: Globe2 },
  ];

  return <PageShell title="设置" subtitle="集中管理 AI 服务、模型与训练辅助能力。支持 Chat Completions、Responses 和 Anthropic Messages 三种上游协议。">
    <div className="mb-5 grid gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2 xl:grid-cols-5">
      {settingsSections.map((section) => <button key={section.key} type="button" onClick={() => setSettingsSection(section.key)} aria-pressed={settingsSection === section.key} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left transition ${settingsSection === section.key ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" : "text-slate-600 hover:bg-slate-50"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-md ${settingsSection === section.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><section.icon className="size-4" /></span><span className="min-w-0"><strong className="block text-sm font-semibold">{section.title}</strong><span className="mt-0.5 block truncate text-[11px] text-slate-500">{section.description}</span></span></button>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        {settingsSection === "model" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">模型服务</h2>
            <p className="mt-1 text-xs text-slate-500">先选择服务商，再选择用于题组评审、追问和参考回答的模型；OpenCode Go 会按模型自动匹配对应协议。</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {providerOptions.map((provider) => {
              const configured = Boolean(serverStatus.providers?.[provider.id]?.configured || (preferences.provider === provider.id && apiKey.trim()));
              return <div key={provider.id} className={`rounded-lg border transition ${preferences.provider === provider.id ? "border-blue-300 bg-blue-50 ring-2 ring-blue-500/10" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <button type="button" onClick={() => changeProvider(provider.id)} aria-pressed={preferences.provider === provider.id} className="w-full rounded-lg p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`grid size-9 place-items-center rounded-md ${preferences.provider === provider.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><Bot className="size-4" /></span>
                    <Badge variant="outline" className={`rounded-md ${configured ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{configured ? "密钥已配置" : "等待配置密钥"}</Badge>
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900">{provider.name}</h3>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{provider.description}</p>
                </button>
                {!provider.builtin && <div className="flex justify-end gap-1 border-t border-slate-200/80 px-3 py-2">
                  <button type="button" onClick={() => openEditProvider(provider.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Pencil className="size-3.5" />编辑</button>
                  <button type="button" onClick={() => removeCustomProvider(provider.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"><Trash2 className="size-3.5" />删除</button>
                </div>}
              </div>;
            })}
            <button type="button" onClick={openAddProvider} className="flex min-h-[152px] items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"><Plus className="size-4" />添加服务商</button>
          </div>
          {providerForm && <div className="mx-5 mb-5 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{providerForm.id ? "编辑服务商" : "添加服务商"}</h3><p className="mt-1 text-xs text-slate-500">填写服务商地址，随后按模型要求选择 Chat、Responses 或 Anthropic Messages 协议。</p></div><button type="button" onClick={() => setProviderForm(null)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-800">取消</button></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700"><span>服务商名称</span><Input value={providerForm.name} onChange={(event) => setProviderForm((current) => current && { ...current, name: event.target.value })} placeholder="例如：硅基流动、通义千问" className="bg-white" /></label>
              <label className="space-y-2 text-sm font-medium text-slate-700"><span>API 请求基础地址</span><Input value={providerForm.baseUrl} onChange={(event) => setProviderForm((current) => current && { ...current, baseUrl: event.target.value })} placeholder="例如：https://api.example.com/v1" className="bg-white font-mono text-xs" /></label>
              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>说明（可选）</span><Input value={providerForm.description} onChange={(event) => setProviderForm((current) => current && { ...current, description: event.target.value })} placeholder="例如：团队统一中转站" className="bg-white" /></label>
            </div>
            {providerFormError && <p className="mt-3 text-xs text-rose-600">{providerFormError}</p>}
            <div className="mt-4 flex justify-end"><Button type="button" onClick={saveProviderDefinition} className="bg-blue-600 hover:bg-blue-700"><Save />保存服务商</Button></div>
          </div>}
          <div className="space-y-4 border-t border-slate-200 bg-slate-50/60 p-5">
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>API 请求基础地址</span>
              <Input value={baseUrl} readOnly={activeProvider.id === "deepseek"}
                onChange={(event) => { const nextPreferences = { ...preferences, openaiBaseUrl: event.target.value }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); persistProviderSettings(nextPreferences, availableModels); setSaved(false); setTestResult(null); }}
                placeholder="例如：https://api.example.com/v1" className="bg-white font-mono text-xs text-slate-700" />
              <span className="block text-[11px] font-normal text-slate-500">{activeProvider.id === "deepseek" ? "DeepSeek 使用官方固定接口地址。" : "填写服务商提供的基础地址，通常以 /v1 结尾；系统会请求其 /models 接口。"}</span>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>上游格式</span>
              <NativeSelect value={effectiveUpstreamFormat} onChange={(event) => {
                const nextPreferences = { ...preferences, upstreamFormat: normalizeAiUpstreamFormat(event.target.value) };
                setPreferences(nextPreferences);
                persistActivePreferences(nextPreferences);
                setSaved(false);
                setTestResult(null);
              }} className="w-full bg-white">
                {AI_UPSTREAM_FORMAT_OPTIONS.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}
              </NativeSelect>
              <span className="block text-[11px] font-normal text-slate-500">{AI_UPSTREAM_FORMAT_OPTIONS.find((option) => option.value === effectiveUpstreamFormat)?.description} 当前实际使用：{effectiveUpstreamFormat}。</span>
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>API Key</span>
              <span className="relative block">
                <Input type={showApiKey ? "text" : "password"} value={apiKey}
                  onChange={(event) => { setApiKey(event.target.value); setSaved(false); setTestResult(null); }}
                  placeholder={providerStatus?.configured ? "服务器已配置密钥；也可以填写会话密钥" : "请输入 API Key"}
                  autoComplete="off" className="bg-white pr-11 font-mono text-xs" />
                <button type="button" onClick={() => setShowApiKey((value) => !value)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}>
                  {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
              <span className="block text-[11px] font-normal text-slate-500">页面填写的密钥仅保存在当前浏览器会话，关闭标签页后需要重新填写。</span>
            </label>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="space-y-2 text-sm font-medium text-slate-700">可用模型
                {availableModels.length ? <NativeSelect value={preferences.model} onChange={(event) => { const selectedModel = availableModels.find((model) => model.value === event.target.value); const nextPreferences = { ...preferences, model: event.target.value, upstreamFormat: selectedModel?.upstreamFormat || preferences.upstreamFormat }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); persistProviderSettings(nextPreferences, availableModels); setSaved(false); }} className="w-full bg-white">
                  {availableModels.map((model) => <NativeSelectOption key={model.value} value={model.value}>{modelDisplayName(model)}</NativeSelectOption>)}
                </NativeSelect> : <Input value={preferences.model} onChange={(event) => { const nextPreferences = { ...preferences, model: event.target.value }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); persistProviderSettings(nextPreferences, availableModels); setSaved(false); }} placeholder="输入模型 ID，或点击右侧获取模型" className="bg-white font-mono text-xs" />}
              </label>
              <Button variant="outline" onClick={fetchModels} disabled={loadingModels} className="bg-white">
                <Globe2 />{loadingModels ? "正在获取…" : "获取可用模型"}
              </Button>
            </div>
          </div>
        </section>}

        {settingsSection === "training" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">启用的 AI 能力</h2><p className="mt-1 text-xs text-slate-500">这些开关会随配置备份到 GitHub，但不包含任何密钥。</p></div>
          <div className="divide-y divide-slate-100">
            {features.map((feature) => <label key={feature.key} className="flex cursor-pointer items-center gap-4 px-5 py-4">
              <span className="min-w-0 flex-1"><strong className="block text-sm font-medium text-slate-800">{feature.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{feature.description}</span></span>
              <Switch checked={preferences[feature.key]} onCheckedChange={(checked) => { const nextPreferences = { ...preferences, [feature.key]: checked }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); setSaved(false); }} aria-label={feature.title} />
            </label>)}
          </div>
        </section>}

        {settingsSection === "group" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">题组设置</h2><p className="mt-1 text-xs text-slate-500">控制题目来源、薄弱知识强化、题组数量，以及同时发起多少个 AI 生成请求。</p></div>
          <div className="space-y-4 p-5">
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              <label className="flex cursor-pointer items-center gap-4 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600"><Globe2 className="size-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-medium text-slate-800">联网获取题目</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">开启后每个新题组都会联网检索资料并请求 AI；关闭后只从内置题库和已归档题库检索。</span></span>
                <Switch checked={preferences.webQuestions} onCheckedChange={(checked) => { const nextPreferences = { ...preferences, webQuestions: checked }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); setSaved(false); recordRuntimeEvent("INFO", "question-bank.source.changed", checked ? "题目来源已切换为联网获取" : "题目来源已切换为题库检索", { sourceMode: checked ? "network" : "bank" }); }} aria-label="联网获取题目" />
              </label>
              <label className="flex cursor-pointer items-center gap-4 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-600"><Target className="size-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-medium text-slate-800">薄弱知识强化</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">根据学习记录中的低掌握、跳过和审阅问题，优先生成相关变式题。</span></span>
                <Switch checked={preferences.adaptiveQuestions} onCheckedChange={(checked) => { const nextPreferences = { ...preferences, adaptiveQuestions: checked }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); setSaved(false); }} aria-label="薄弱知识强化" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700"><span>每个题组的题目数量</span><Input type="number" min={MIN_QUESTION_GROUP_SIZE} max={MAX_QUESTION_GROUP_SIZE} step={1} value={preferences.questionGroupSize} onChange={(event) => { const nextPreferences = { ...preferences, questionGroupSize: normalizeQuestionGroupSettings({ questionGroupSize: event.target.value, parallelRequests: preferences.parallelRequests }).questionGroupSize }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); setSaved(false); }} className="bg-white" /><span className="block text-[11px] font-normal text-slate-500">范围 {MIN_QUESTION_GROUP_SIZE}–{MAX_QUESTION_GROUP_SIZE}，默认 {DEFAULT_QUESTION_GROUP_SIZE} 道。</span></label>
              <label className="space-y-2 text-sm font-medium text-slate-700"><span>并行 AI 请求数</span><Input type="number" min={MIN_PARALLEL_REQUESTS} max={MAX_PARALLEL_REQUESTS} step={1} value={preferences.parallelRequests} disabled={!preferences.webQuestions} onChange={(event) => { const nextPreferences = { ...preferences, parallelRequests: normalizeQuestionGroupSettings({ questionGroupSize: preferences.questionGroupSize, parallelRequests: event.target.value }).parallelRequests }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); setSaved(false); }} className="bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" /><span className="block text-[11px] font-normal text-slate-500">范围 {MIN_PARALLEL_REQUESTS}–{MAX_PARALLEL_REQUESTS}，默认 {DEFAULT_PARALLEL_REQUESTS} 个；{preferences.webQuestions ? "过高可能触发服务商限流。" : "当前为题库模式，不会发起 AI 请求。"}</span></label>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-blue-900"><p className="font-semibold">生成策略</p><p className="mt-1">联网模式会把每个请求分配给并行 AI，同时生成后自动去重；题库模式只按当前分类、难度、技术栈和薄弱知识排序检索。某个请求失败时，其余结果仍会保留，并继续下一轮补齐。</p></div>
          </div>
        </section>}

        {settingsSection === "github" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold text-slate-900">GitHub 备份范围</h2><p className="mt-1 text-xs text-slate-500">管理网站启动加载、运行期间自动备份和关闭前同步的内容。</p></div>
              <Badge variant="outline" className={`rounded-md ${githubStatus.state === "connected" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : githubStatus.state === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {githubStatus.state === "loading" ? "检查中" : githubStatus.state === "connected" ? "GitHub 已连接" : githubStatus.state === "error" ? "连接异常" : "仅本地可用"}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">{githubStatus.detail}{githubStatus.updatedAt ? ` · 最近更新 ${new Date(githubStatus.updatedAt).toLocaleString("zh-CN")}` : ""}</p>
          </div>
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">GitHub 连接设置</h3><span className="text-xs text-slate-500">服务端凭据：{githubStatus.state === "connected" ? "已配置并可用" : githubStatus.state === "loading" ? "检测中" : "未确认"}</span></div>
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">GitHub 仓库 / 分支</span>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(160px,220px)]">
                    <Input aria-label="GitHub 仓库" value={githubConnection.repository} onChange={(event) => setGithubConnection((current) => ({ ...current, repository: event.target.value }))} placeholder="owner/repository" className="bg-white font-mono text-xs" />
                    <span className="text-lg font-medium text-slate-400">/</span>
                    <label className="col-span-2 sm:col-span-1"><span className="sr-only">GitHub 分支</span><Input aria-label="GitHub 分支" value={githubConnection.branch} onChange={(event) => setGithubConnection((current) => ({ ...current, branch: event.target.value }))} placeholder="main" className="bg-white font-mono text-xs" /></label>
                  </div>
                  <span className="block text-[11px] font-normal text-slate-500">填写 owner/repository，也支持 https://github.com/… 地址。</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={saveGitHubConnection} disabled={githubBusy} className="bg-white"><Save />保存连接设置</Button>
                  <Button type="button" variant="outline" onClick={() => void testGithubConnection()} disabled={githubBusy || githubTokenBusy} className="bg-white"><CircleCheck />测试 GitHub 连接</Button>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">默认访问令牌由网站服务端环境变量管理；下方更换的 Token 只写入 HttpOnly Cookie，不进入 localStorage、日志或 GitHub。</p>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-semibold text-slate-800">更换 GitHub Token</h4><p className="mt-1 text-xs leading-5 text-slate-500">Token 仅通过 HttpOnly Cookie 保存，前端脚本无法读取；清除站点数据或 30 天后需要重新设置。</p></div><span className="text-xs text-slate-500">当前仅对本浏览器生效</span></div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input type="password" value={githubTokenInput} onChange={(event) => setGithubTokenInput(event.target.value)} placeholder="输入新的 GitHub Token" autoComplete="new-password" aria-label="新的 GitHub Token" className="bg-white font-mono text-xs" />
                  <Button type="button" onClick={() => void saveGitHubToken()} disabled={githubTokenBusy || githubBusy} className="bg-blue-600 hover:bg-blue-700"><CircleCheck />保存并测试 Token</Button>
                  <Button type="button" variant="outline" onClick={() => void clearGitHubToken()} disabled={githubTokenBusy || githubBusy} className="bg-white">清除浏览器 Token</Button>
                </div>
                {githubTokenMessage && <p className={`mt-2 text-xs ${githubTokenMessage.includes("失败") || githubTokenMessage.includes("错误") ? "text-rose-700" : "text-slate-500"}`}>{githubTokenMessage}</p>}
              </div>
            </div>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              <label className="flex cursor-pointer items-center gap-4 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600"><Save className="size-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-medium text-slate-800">自动备份</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">学习过程中的配置、收藏、项目和运行日志按变化自动提交；关闭后仍可手动备份。</span></span>
                <Switch checked={githubSyncSettings.autoBackup} onCheckedChange={(checked) => saveGitHubSyncSettings({ ...githubSyncSettings, autoBackup: checked })} aria-label="自动备份" />
              </label>
              {([
                ["syncAiSettings", "AI 服务与训练设置", "同步服务商选择、模型和训练偏好，不包含 API Key。"],
                ["syncFavorites", "收藏题目", "同步收藏夹中的题目和归档信息。"],
                ["syncProjects", "项目配置", "同步项目名称、分类和学习进度。"],
                ["syncRuntimeLogs", "系统与用户操作日志", "同步运行日志；页面仍只显示本次启动会话的日志。"],
                ["syncQuestionBank", "AI 分类题库", "按技术栈分类同步 AI 生成题库的 JSON 与 Markdown 文件。"],
              ] as const).map(([key, title, description]) => <label key={key} className="flex cursor-pointer items-center gap-4 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600"><HardDrive className="size-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-medium text-slate-800">{title}</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span></span>
                <Switch checked={githubSyncSettings[key]} onCheckedChange={(checked) => saveGitHubSyncSettings({ ...githubSyncSettings, [key]: checked })} aria-label={title} />
              </label>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">配置存档</p><p className="mt-2 break-all font-mono text-xs text-slate-700">data/vision-interview-data.json</p></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">AI 题库存档</p><p className="mt-2 break-all font-mono text-xs text-slate-700">data/ai-question-bank/&lt;技术栈&gt;.json · .md</p></div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-900"><p className="font-semibold">学习记录：手动上传</p><p className="mt-1">学习记录不会随自动备份覆盖 GitHub 数据，请在“学习记录”页面使用统一上传按钮；这样可以避免答题过程中产生大量提交。</p></div>
          </div>
        </section>}

        {settingsSection === "whitelist" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold text-slate-900">网址白名单</h2><p className="mt-1 text-xs text-slate-500">白名单按排序优先检索；白名单结果不足时，系统再使用其他合规来源补充。</p></div>
              <Button type="button" variant="outline" onClick={openAddWhitelistEntry} disabled={Boolean(whitelistDraft)} className="bg-white"><Plus />添加网址</Button>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-blue-900">
              <p className="font-semibold">检索优先级</p>
              <p className="mt-1">拖动网址卡片调整顺序，排名越靠前越优先检索和展示。关闭的网址会保留在列表中，但不会参与本轮联网检索。白名单会在页面关闭时备份到 GitHub，并在下次启动时恢复。</p>
            </div>
            {whitelistDraft && <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{whitelistDraft.id ? "编辑网址" : "添加网址"}</h3><p className="mt-1 text-xs text-slate-500">可填写域名或具体路径，匹配该地址下的页面来源。</p></div><button type="button" onClick={() => { setWhitelistDraft(null); setWhitelistFormError(""); }} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-800">取消</button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="space-y-2 text-sm font-medium text-slate-700"><span>网址</span><Input value={whitelistDraft.url} onChange={(event) => setWhitelistDraft((current) => current && { ...current, url: event.target.value })} placeholder="例如：https://docs.opencv.org/" className="bg-white font-mono text-xs" /></label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><Switch checked={whitelistDraft.enabled} onCheckedChange={(checked) => setWhitelistDraft((current) => current && { ...current, enabled: checked })} aria-label="启用网址" /><span>启用</span></label>
              </div>
              {whitelistFormError && <p className="mt-3 text-xs text-rose-600">{whitelistFormError}</p>}
              <div className="mt-4 flex justify-end"><Button type="button" onClick={() => void saveWhitelistEntry()} disabled={whitelistCheckingId === (whitelistDraft.id || "__new__")} className="bg-blue-600 hover:bg-blue-700"><Globe2 />{whitelistCheckingId === (whitelistDraft.id || "__new__") ? "正在检测…" : whitelistDraft.id ? "保存网址" : "检测并添加"}</Button></div>
            </div>}
            {webSourceWhitelist.length ? <div className="space-y-2">
              {webSourceWhitelist.map((entry, index) => <div key={entry.id} draggable onDragStart={() => setDraggedWhitelistId(entry.id)} onDragEnd={() => setDraggedWhitelistId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropWhitelistEntry(entry.id)} className={`flex items-center gap-3 rounded-lg border bg-white p-3 transition ${draggedWhitelistId === entry.id ? "border-blue-300 bg-blue-50/60 opacity-70" : "border-slate-200 hover:border-blue-200"}`}>
                <span className="grid size-8 shrink-0 cursor-grab place-items-center rounded-md bg-slate-100 text-slate-400 active:cursor-grabbing" title="拖动调整顺序" aria-label="拖动调整顺序"><GripVertical className="size-4" /></span>
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-blue-50 text-xs font-semibold text-blue-700">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${entry.enabled ? "text-slate-800" : "text-slate-400 line-through"}`}>{entry.displayName || "未命名网站"}</p><p className={`mt-1 truncate font-mono text-xs ${entry.enabled ? "text-slate-600" : "text-slate-400 line-through"}`}>{entry.url}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]"><span className={`inline-flex items-center gap-1 ${entry.available === false ? "text-rose-600" : "text-emerald-700"}`}>{entry.available === false ? <CircleAlert className="size-3" /> : <CircleCheck className="size-3" />}{entry.available === false ? "不可用" : "可用"}</span><span className="text-slate-400">{entry.enabled ? "参与联网检索" : "已停用"}</span>{entry.lastCheckedAt && <span className="text-slate-400">检测于 {new Date(entry.lastCheckedAt).toLocaleString()}</span>}</div>{entry.checkError && <p className="mt-1 truncate text-[11px] text-rose-600" title={entry.checkError}>{entry.checkError}</p>}</div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-slate-600"><span>{entry.fixed ? "固定启用" : entry.enabled ? "启用" : "停用"}</span><Switch checked={entry.enabled} disabled={entry.fixed} onCheckedChange={() => toggleWhitelistEntry(entry)} aria-label={`${entry.enabled ? "停用" : "启用"} ${entry.displayName || entry.url}`} /></label>
                <button type="button" onClick={() => void recheckWhitelistEntry(entry)} disabled={whitelistCheckingId === entry.id} className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"><RotateCcw className={`size-3.5 ${whitelistCheckingId === entry.id ? "animate-spin" : ""}`} />{whitelistCheckingId === entry.id ? "检测中" : "重新检测"}</button>
                <button type="button" onClick={() => openEditWhitelistEntry(entry)} disabled={entry.fixed} className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Pencil className="size-3.5" />编辑</button>
                <button type="button" onClick={() => removeWhitelistEntry(entry)} disabled={entry.fixed} title={entry.fixed ? "系统固定白名单不可删除" : undefined} className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="size-3.5" />{entry.fixed ? "固定" : "删除"}</button>
              </div>)}
            </div> : <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center"><Globe2 className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">暂未添加网址白名单</p><p className="mt-1 text-xs text-slate-500">添加常用官方文档或 GitHub 项目地址后，联网题目会优先从这些来源检索。</p></div>}
          </div>
        </section>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><CircleCheck className="size-4" />配置已保存</span>}
          {settingsSection === "model" && <Button variant="outline" onClick={testConnection} disabled={loadingTest || loadingModels}><CircleCheck />{loadingTest ? "正在测试真实聊天…" : "测试真实聊天"}</Button>}
          {settingsSection === "github"
            ? <Button onClick={() => saveGitHubSyncSettings(githubSyncSettings)} className="bg-blue-600 hover:bg-blue-700"><Save />保存 GitHub 设置</Button>
            : settingsSection === "whitelist"
              ? <Button onClick={saveWebSourceWhitelist} className="bg-blue-600 hover:bg-blue-700"><Save />保存网址白名单</Button>
              : <Button onClick={savePreferences} className="bg-blue-600 hover:bg-blue-700"><Save />保存配置</Button>}
        </div>
        {settingsSection === "model" && testResult && <div className={`flex items-start gap-2.5 rounded-md border p-3 text-sm ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {testResult.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}{testResult.message}
        </div>}
      </div>

      <aside className="space-y-5">
        {settingsSection === "model" && <>
        <section className="panel p-5">
          <div className="flex items-center justify-between gap-3"><span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-600"><ShieldCheck className="size-5" /></span><Badge variant="outline" className={`rounded-md ${hasCredential ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{hasCredential ? "凭据已填写" : "等待配置"}</Badge></div>
          <h2 className="mt-5 font-semibold text-slate-900">{providerName} 连接信息</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{apiKey.trim() ? "已使用当前会话密钥。可先获取模型，再测试真实聊天请求。" : providerStatus?.configured ? "服务器已有安全密钥，可以获取模型并测试真实聊天。" : "请填写 API 请求地址和 API Key，然后获取模型并测试真实聊天。"}</p>
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-500">API Key · ••••••••••••••••</div>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold text-slate-900">安全说明</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-emerald-600" />中转站地址必须使用 HTTPS，禁止访问本机和内网地址。</p>
            <p className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-emerald-600" />会话密钥不会写入长期配置、学习记录或源代码。</p>
            <p className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-emerald-600" />模型列表和后续 AI 请求统一通过网站后端转发。</p>
          </div>
        </section>
        </>}
        {settingsSection === "training" && <section className="panel p-5"><Sparkles className="size-6 text-blue-600" /><h2 className="mt-4 font-semibold text-slate-900">训练偏好提示</h2><p className="mt-2 text-sm leading-6 text-slate-600">建议开启回答评审，先完成整组回答，再查看 AI 或内置规则给出的关键要点反馈。</p></section>}
        {settingsSection === "group" && <section className="panel p-5"><ListTree className="size-6 text-blue-600" /><h2 className="mt-4 font-semibold text-slate-900">题组生成提示</h2><p className="mt-2 text-sm leading-6 text-slate-600">建议普通服务商使用 2–3 个并行请求；如果出现超时或限流，可以降低并行数，系统仍会自动重试并补齐题目。</p></section>}
        {settingsSection === "github" && <section className="panel p-5"><ShieldCheck className="size-6 text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">同步安全说明</h2><div className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><p>GitHub Token 只在服务端使用，不会显示在此页面。</p><p>API Key、Token 和密码不会写入备份文件、题库或日志。</p><p>关闭自动备份不会删除 GitHub 历史数据，只会停止后续自动提交。</p></div></section>}
        {settingsSection === "whitelist" && <section className="panel p-5"><Globe2 className="size-6 text-blue-600" /><h2 className="mt-4 font-semibold text-slate-900">白名单使用建议</h2><div className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><p>建议优先添加官方文档、论文发布页和可信的 GitHub 项目地址。</p><p>网址可以填写域名，也可以填写某个文档路径；路径匹配会覆盖该路径下的页面。</p><p>白名单只改变来源优先级，不会阻断其他合规搜索结果。</p></div></section>}
      </aside>
    </div>
  </PageShell>;
}
