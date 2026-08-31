Warning: truncated output (original token count: 49808)
Total output lines: 2772

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Archive, BarChart3, BookOpenCheck, Bot, BrainCircuit, Check, ChevronDown,
  ChevronRight, CircleAlert, CircleCheck, Clock3, FileText, FolderKanban,
  BookOpen, Clipboard, Eye, EyeOff, Gauge, Globe2, HardDrive, Lightbulb, ListTree, Mic, Pause, Play, RotateCcw, Save, Settings, Upload,
  Pencil, Plus, ShieldCheck, Sparkles, Target, Trash2, UserRound, Volume2,
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
  collectAiQuestionGroup,
  createQuestionBankArchiveEntries,
  fillQuestionGroup,
  mergeQuestionBankArchive,
  type AiGeneratedQuestion,
  type QuestionBankArchiveEntry,
} from "@/lib/ai-question-bank";
import {
  appendRuntimeLog,
  clearRuntimeLogs,
  createRecordsUploadPayload,
  filterRuntimeLogs,
  normalizeRuntimeLogs,
  RUNTIME_LOG_STORAGE_KEY,
} from "@/lib/backup-core.mjs";

type TrainingMode = "专业专项" | "项目答辩" | "综合模拟";
type TechStack = "通用原理" | "HALCON" | "OpenCV" | "VisionPro" | "C#视觉开发";
type AiProvider = string;
type AiPreferences = {
  provider: AiProvider;
  model: string;
  openaiBaseUrl: string;
  aiScoring: boolean;
  bestAnswer: boolean;
  smartFollowUp: boolean;
  webQuestions: boolean;
};
type AiModelOption = { label: string; value: string };
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
type RuntimeLogLevel = "INFO" | "WARN" | "ERROR";
type RuntimeLog = {
  id: string;
  timestamp: string;
  level: RuntimeLogLevel;
  event: string;
  message: string;
  context?: Record<string, unknown>;
};
type Question = {
  title: string; type: string; category: string; source: "专业" | "项目"; difficulty: string; tags: string[];
  keywords: string[]; followUp: string; hint: string; basis?: string; techStacks?: TechStack[];
  reference?: { title: string; url: string };
  bestAnswer?: string; principle?: string;
  origin?: "AI" | "本地题库";
};
type TrainingRecord = {
  id?: string; question: string; score?: number; project: string; date: string;
  timestamp?: string; action?: "完成答题" | "跳过题目" | "查看答案"; mode?: TrainingMode;
  category?: string; source?: "专业" | "项目"; seconds?: number;
  answer?: string; bestAnswerViewed?: boolean;
  bestAnswer?: string;
  reviewIssues?: string[]; reviewSuggestions?: string[];
  mastery?: MasteryLevel; masteryUpdatedAt?: string;
  masteryReason?: string; reviewSource?: "AI" | "本地规则";
  answerKeywords?: string[]; principle?: string;
};
type AnswerReview = { strengths: string[]; issues: string[]; suggestions: string[]; missing: string[] };
type SessionAnswer = {
  question: Question; answer: string; seconds: number; status: "answered" | "skipped";
  bestAnswer: string; review: AnswerReview; mastery: MasteryLevel;
  masteryReason?: string; reviewSource?: "AI" | "本地规则";
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

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

const techStackFilters = ["随机技术栈", "通用原理", "HALCON", "OpenCV", "VisionPro", "C#视觉开发"] as const;
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
    type: "现场故障", category: "PLC与现场", source: "项目", difficulty: "困难", tags: ["PLC", "时序", "日志"],
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
    techStacks: ["C#视觉开发"],
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
    techStacks: ["C#视觉开发"],
    reference: { title: ".NET Channels 官方文档", url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/channels" },
  },
  {
    title: "C# 调用相机或图像 SDK 时为什么必须重视 IDisposable？",
    type: "C# 资源管理", category: "C#与软件架构", source: "专业", difficulty: "中等", tags: ["IDisposable", "非托管资源", "using"],
    keywords: ["非托管资源", "Dispose", "using", "图像缓冲区", "句柄", "内存泄漏", "finally"],
    followUp: "如果 SDK 对象同时实现 IDisposable 和 IAsyncDisposable，你会如何选择释放方式？",
    hint: "说明 GC 的边界、SDK 常见非托管资源、异常路径和确定性释放。",
    techStacks: ["C#视觉开发"],
    reference: { title: ".NET Dispose 模式官方文档", url: "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose" },
  },
  {
    title: "C# 桌面视觉程序为什么不能在 UI 线程同步等待异步任务？",
    type: "C# 异步", category: "C#与软件架构", source: "专业", difficulty: "困难", tags: ["async/await", "UI 线程", "死锁"],
    keywords: ["UI 线程", "阻塞", "死锁", "await", "同步上下文", "Dispatcher", "取消"],
    followUp: "后台算法完成后，怎样安全更新 WPF 或 WinForms 控件？",
    hint: "解释同步等待、续体回到 UI 上下文和消息循环之间的关系。",
    techStacks: ["C#视觉开发"],
    reference: { title: "C# Task 异步编程官方文档", url: "https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/task-asynchronous-programming-model" },
  },
  {
    title: "Modbus TCP 与 PLC 进行视觉握手时应包含哪些信号？",
    type: "工业通讯", category: "PLC与现场", source: "专业", difficulty: "中等", tags: ["触发", "忙碌", "完成"],
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

const professionalCategories = ["随机类型", "图像处理基础", "边缘与特征", "模板与定位", "标定与坐标", "相机镜头光源", "C#与软件架构", "PLC与现场"];

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
  PLC与现场: {
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
      hint: "说…29808 tokens truncated…0 text-rose-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{record.action === "跳过题目" ? "跳过题目" : "完成答题"}</Badge><span className="truncate text-sm font-medium text-slate-800">{record.question}</span></div>
                      <p className="mt-1.5 text-xs text-slate-500">{record.timestamp ?? record.date}{typeof record.seconds === "number" ? ` · 用时 ${formatTime(record.seconds)}` : ""}</p>
                      {record.answer && <p className="mt-1.5 line-clamp-1 text-xs text-slate-400">我的回答：{record.answer}</p>}
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                      <Badge variant="outline" className={`rounded-md ${masteryClass(record.mastery)}`}>掌握度：{masteryLabel(record.mastery)}</Badge>
                      {record.reviewSource && <Badge variant="outline" className="rounded-md border-slate-200 bg-slate-50 text-slate-600">{record.reviewSource === "AI" ? "AI审阅" : "本地规则"}</Badge>}
                      {hasIssues ? <button type="button" onClick={() => setExpandedRecordId(expanded ? null : recordId)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-amber-700 transition hover:bg-amber-50" aria-expanded={expanded}>
                        {expanded ? "收起改进" : `${record.reviewIssues?.length || 1} 项待改进`}<ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button> : <span className="text-sm text-emerald-700">已完成回答审阅</span>}
                    </div>
                    {expanded && <div className="grid gap-4 border-t border-slate-200 pt-4 lg:col-span-2 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">我的回答</p><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{record.answer || "本题未填写回答"}</p></div>
                        <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-4"><p className="text-xs font-semibold text-violet-700">标准答案</p>{answerKeywords.length > 0 && <><p className="mt-2 text-xs font-semibold text-violet-700">关键词要点</p><div className="mt-2 flex flex-wrap gap-2">{answerKeywords.map((keyword) => <span key={keyword} className="rounded-md bg-violet-100 px-2 py-1 text-xs text-violet-800">{keyword}</span>)}</div></>}<p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{standardAnswer}</p></div>
                        {principle && <details className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 group"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-700"><Lightbulb className="size-4 text-slate-500" />技术原理（默认隐藏）<ChevronDown className="ml-auto size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary><p className="mt-3 whitespace-pre-line border-t border-slate-200 pt-3 text-sm leading-7 text-slate-700">{principle}</p></details>}
                      </div>
                      <div className="space-y-4">
                        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800"><CircleAlert className="size-4" />回答与标准答案的差异</h3><ul className="mt-2 space-y-2">{(record.reviewIssues?.length ? record.reviewIssues : ["暂未发现明显遗漏，可继续加强回答中的项目证据和边界条件。"]).map((text) => <li key={text} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">{text}</li>)}</ul></div>
                        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-blue-800"><Lightbulb className="size-4" />提升建议</h3><ol className="mt-2 space-y-2">{(record.reviewSuggestions?.length ? record.reviewSuggestions : ["用“结论—原理或步骤—项目证据—局限”重新组织回答。"]).map((text, suggestionIndex) => <li key={text} className="flex gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-950"><span className="font-semibold text-blue-600">{suggestionIndex + 1}.</span><span>{text}</span></li>)}</ol></div>
                        {record.masteryReason && <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700"><strong className="font-semibold text-slate-600">掌握度判断：</strong>{record.masteryReason}</div>}
                      </div>
                    </div>}
                  </div>;
                })}
              </div>
            </AccordionContent>
          </AccordionItem>;
        })}</Accordion>
      )}
    </section>
  </PageShell>;
}

const aiModels: Record<string, AiModelOption[]> = {
  deepseek: [
    { label: "DeepSeek V4 Flash（速度优先）", value: "deepseek-v4-flash" },
    { label: "DeepSeek V4 Pro（质量优先）", value: "deepseek-v4-pro" },
  ],
  openai: [
    { label: "GPT-5 mini（成本优先）", value: "gpt-5-mini" },
    { label: "GPT-5（质量优先）", value: "gpt-5" },
  ],
};

const builtinAiProviders: AiProviderDefinition[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "适合中文技术问答，默认推荐使用",
    baseUrl: "https://api.deepseek.com",
    models: aiModels.deepseek,
    builtin: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "支持官方 API 与 OpenAI 兼容中转站",
    baseUrl: "https://api.openai.com/v1",
    models: aiModels.openai,
    builtin: true,
  },
];

const defaultAiPreferences: AiPreferences = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  openaiBaseUrl: "https://api.openai.com/v1",
  aiScoring: true,
  bestAnswer: true,
  smartFollowUp: true,
  webQuestions: true,
};

type AiServerStatus = {
  providers?: Record<AiProvider, { configured: boolean; baseUrl: string; defaultModel: string }>;
};

const aiProviderSettingsStorageKey = "vision-interview-ai-provider-settings";

function readAiProviderSettings(): AiProviderSettingsStore {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(aiProviderSettingsStorageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const settings: AiProviderSettingsStore = {};
    for (const [id, raw] of Object.entries(parsed as Record<string, unknown>)) {
      if (!id || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const value = raw as Record<string, unknown>;
      const availableModels = Array.isArray(value.availableModels)
        ? value.availableModels
          .filter((model): model is Record<string, unknown> => Boolean(model) && typeof model === "object")
          .map((model) => ({
            label: typeof model.label === "string" ? model.label : typeof model.value === "string" ? model.value : "",
            value: typeof model.value === "string" ? model.value : "",
          }))
          .filter((model) => model.value)
        : undefined;
      settings[id] = {
        name: typeof value.name === "string" ? value.name : undefined,
        description: typeof value.description === "string" ? value.description : undefined,
        model: typeof value.model === "string" ? value.model : undefined,
        baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : undefined,
        openaiBaseUrl: typeof value.openaiBaseUrl === "string" ? value.openaiBaseUrl : undefined,
        availableModels,
      };
    }
    return settings;
  } catch {
    return {};
  }
}

function writeAiProviderSettings(settings: AiProviderSettingsStore) {
  localStorage.setItem(aiProviderSettingsStorageKey, JSON.stringify(settings));
}

function getBuiltinProvider(provider: AiProvider) {
  return builtinAiProviders.find((item) => item.id === provider);
}

function isKnownProvider(provider: AiProvider, settings: AiProviderSettingsStore) {
  return Boolean(getBuiltinProvider(provider) || settings[provider]);
}

function getProviderDefinition(provider: AiProvider, settings: AiProviderSettingsStore = {}) {
  const builtin = getBuiltinProvider(provider);
  if (builtin) return builtin;
  const saved = settings[provider];
  return {
    id: provider,
    name: saved?.name?.trim() || "自定义服务商",
    description: saved?.description?.trim() || "兼容 OpenAI 格式的自定义服务商",
    baseUrl: saved?.baseUrl?.trim() || saved?.openaiBaseUrl?.trim() || "",
    models: saved?.availableModels?.length ? saved.availableModels : [],
    builtin: false,
  } satisfies AiProviderDefinition;
}

function createCustomProviderId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type ProviderDraft = { id?: AiProvider; name: string; description: string; baseUrl: string };
type SettingsSection = "model" | "training" | "privacy" | "about";

function SettingsPage() {
  const [preferences, setPreferences] = useState<AiPreferences>(defaultAiPreferences);
  const [serverStatus, setServerStatus] = useState<AiServerStatus>({});
  const [providerSettings, setProviderSettings] = useState<AiProviderSettingsStore>({});
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<AiModelOption[]>(aiModels.deepseek);
  const [saved, setSaved] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderDraft | null>(null);
  const [providerFormError, setProviderFormError] = useState("");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("model");

  const providerOptions = useMemo(() => {
    const customProviders = Object.keys(providerSettings)
      .filter((provider) => !getBuiltinProvider(provider))
      .map((provider) => getProviderDefinition(provider, providerSettings));
    return [...builtinAiProviders, ...customProviders];
  }, [providerSettings]);

  useEffect(() => {
    const stored = localStorage.getItem("vision-interview-ai-preferences");
    const storedProviderSettings = readAiProviderSettings();
    setProviderSettings(storedProviderSettings);
    let restored = defaultAiPreferences;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<AiPreferences>;
        const requestedProvider = typeof parsed.provider === "string" ? parsed.provider : defaultAiPreferences.provider;
        const provider: AiProvider = isKnownProvider(requestedProvider, storedProviderSettings) ? requestedProvider : defaultAiPreferences.provider;
        const savedProvider = storedProviderSettings[provider];
        const definition = getProviderDefinition(provider, storedProviderSettings);
        const fallbackBaseUrl = provider === "deepseek" ? definition.baseUrl : (typeof parsed.openaiBaseUrl === "string" ? parsed.openaiBaseUrl : definition.baseUrl);
        restored = {
          ...defaultAiPreferences,
          ...parsed,
          provider,
          model: savedProvider?.model || (typeof parsed.model === "string" ? parsed.model : "") || definition.models[0]?.value || defaultAiPreferences.model,
          openaiBaseUrl: savedProvider?.baseUrl || savedProvider?.openaiBaseUrl || fallbackBaseUrl,
        };
        setPreferences(restored);
        setAvailableModels(savedProvider?.availableModels?.length ? savedProvider.availableModels : definition.models);
      } catch { /* 忽略损坏的本地设置 */ }
    } else {
      const savedProvider = storedProviderSettings[defaultAiPreferences.provider];
      if (savedProvider) {
        const definition = getProviderDefinition(defaultAiPreferences.provider, storedProviderSettings);
        restored = {
          ...restored,
          model: savedProvider.model || definition.models[0]?.value || restored.model,
          openaiBaseUrl: savedProvider.baseUrl || savedProvider.openaiBaseUrl || definition.baseUrl || restored.openaiBaseUrl,
        };
        setPreferences(restored);
        setAvailableModels(savedProvider.availableModels?.length ? savedProvider.availableModels : definition.models);
      }
    }
    setApiKey(sessionStorage.getItem(`vision-interview-ai-key-${restored.provider}`) || "");
    fetch("/api/ai/config", { cache: "no-store" })
      .then((response) => response.json())
      .then(setServerStatus)
      .catch(() => setServerStatus({}));
  }, []);

  const providerStatus = serverStatus.providers?.[preferences.provider];
  const activeProvider = providerOptions.find((provider) => provider.id === preferences.provider) || getProviderDefinition(preferences.provider, providerSettings);
  const providerName = activeProvider.name;
  const baseUrl = activeProvider.id === "deepseek" ? activeProvider.baseUrl : preferences.openaiBaseUrl || activeProvider.baseUrl;
  const hasCredential = Boolean(apiKey.trim() || providerStatus?.configured);

  function persistActivePreferences(nextPreferences: AiPreferences) {
    localStorage.setItem("vision-interview-ai-preferences", JSON.stringify(nextPreferences));
  }

  function persistProviderSettings(nextPreferences: AiPreferences = preferences, models: AiModelOption[] = availableModels) {
    const settings = readAiProviderSettings();
    const previous = settings[nextPreferences.provider] || {};
    const definition = getProviderDefinition(nextPreferences.provider, settings);
    const nextBaseUrl = nextPreferences.provider === "deepseek" ? definition.baseUrl : nextPreferences.openaiBaseUrl;
    settings[nextPreferences.provider] = {
      ...previous,
      model: nextPreferences.model,
      baseUrl: nextBaseUrl,
      openaiBaseUrl: nextBaseUrl,
      availableModels: models,
    };
    writeAiProviderSettings(settings);
    setProviderSettings(settings);
  }

  function changeProvider(provider: AiProvider) {
    persistProviderSettings();
    const settings = readAiProviderSettings();
    const savedProvider = settings[provider];
    const definition = getProviderDefinition(provider, settings);
    const models = savedProvider?.availableModels?.length ? savedProvider.availableModels : definition.models;
    const model = savedProvider?.model || models[0]?.value || "";
    const nextBaseUrl = provider === "deepseek" ? definition.baseUrl : savedProvider?.baseUrl || savedProvider?.openaiBaseUrl || definition.baseUrl;
    const nextPreferences = { ...preferences, provider, model, openaiBaseUrl: nextBaseUrl };
    setPreferences(nextPreferences);
    persistActivePreferences(nextPreferences);
    persistProviderSettings(nextPreferences, models);
    setAvailableModels(models);
    setApiKey(sessionStorage.getItem(`vision-interview-ai-key-${provider}`) || "");
    setSaved(false);
    setTestResult(null);
  }

  function openAddProvider() {
    setProviderForm({ name: "", description: "兼容 OpenAI 格式的自定义服务商", baseUrl: "https://" });
    setProviderFormError("");
  }

  function openEditProvider(provider: AiProvider) {
    const settings = readAiProviderSettings();
    const definition = getProviderDefinition(provider, settings);
    setProviderForm({
      id: provider,
      name: definition.name,
      description: definition.description,
      baseUrl: definition.baseUrl,
    });
    setProviderFormError("");
  }

  function saveProviderDefinition() {
    if (!providerForm) return;
    const name = providerForm.name.trim();
    const baseUrl = providerForm.baseUrl.trim();
    if (!name) {
      setProviderFormError("请填写服务商名称。");
      return;
    }
    if (!baseUrl) {
      setProviderFormError("请填写 API 请求基础地址。");
      return;
    }
    const id = providerForm.id || createCustomProviderId();
    const settings = readAiProviderSettings();
    const previous = settings[id] || {};
    settings[id] = {
      ...previous,
      name,
      description: providerForm.description.trim() || "兼容 OpenAI 格式的自定义服务商",
      baseUrl,
      openaiBaseUrl: baseUrl,
      availableModels: previous.availableModels || [],
    };
    writeAiProviderSettings(settings);
    setProviderSettings(settings);
    setProviderForm(null);
    setProviderFormError("");
    if (!providerForm.id) {
      const models = settings[id].availableModels || [];
      const nextPreferences = { ...preferences, provider: id, model: settings[id].model || models[0]?.value || "", openaiBaseUrl: baseUrl };
      setPreferences(nextPreferences);
      persistActivePreferences(nextPreferences);
      persistProviderSettings(nextPreferences, models);
      setAvailableModels(models);
      setApiKey(sessionStorage.getItem(`vision-interview-ai-key-${id}`) || "");
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
    localStorage.setItem("vision-interview-ai-preferences", JSON.stringify(preferences));
    persistProviderSettings(preferences, availableModels);
    const sessionKey = `vision-interview-ai-key-${preferences.provider}`;
    if (apiKey.trim()) sessionStorage.setItem(sessionKey, apiKey.trim());
    else sessionStorage.removeItem(sessionKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
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
        body: JSON.stringify({ provider: preferences.provider, baseUrl, apiKey: apiKey.trim() || undefined }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; models?: string[] };
      if (result.ok && result.models?.length) {
        const models = result.models.map((model) => ({ label: model, value: model }));
        const nextModel = result.models.includes(preferences.model) ? preferences.model : result.models[0];
        setAvailableModels(models);
        const nextPreferences = { ...preferences, model: nextModel };
        setPreferences(nextPreferences);
        persistActivePreferences(nextPreferences);
        persistProviderSettings(nextPreferences, models);
      }
      setTestResult({ ok: Boolean(result.ok), message: result.message || "未收到测试结果。" });
    } catch {
      setTestResult({ ok: false, message: "无法连接网站服务器，请稍后重试。" });
    } finally {
      setLoadingModels(false);
    }
  }

  const features: { key: keyof Pick<AiPreferences, "aiScoring" | "bestAnswer" | "smartFollowUp" | "webQuestions">; title: string; description: string }[] = [
    { key: "aiScoring", title: "AI 回答审阅与掌握度", description: "不打分，判断低/中/高掌握程度，并指出知识遗漏、表达结构、项目证据和工程局限" },
    { key: "bestAnswer", title: "生成最佳回答", description: "结合题目和项目资料生成个性化参考答案" },
    { key: "smartFollowUp", title: "智能连续追问", description: "根据回答中的遗漏点继续追问，而不是固定题目" },
    { key: "webQuestions", title: "联网整理专业题库", description: "搜索机器视觉题库，并在题目后保留来源" },
  ];
  const settingsSections: { key: SettingsSection; title: string; description: string; icon: typeof Settings }[] = [
    { key: "model", title: "模型服务", description: "服务商、地址、密钥与模型", icon: Bot },
    { key: "training", title: "训练偏好", description: "AI 能力与学习方式", icon: BrainCircuit },
    { key: "privacy", title: "隐私与数据", description: "GitHub 备份与密钥安全", icon: ShieldCheck },
    { key: "about", title: "关于应用", description: "版本与使用说明", icon: FileText },
  ];

  return <PageShell title="设置" subtitle="集中管理 AI 服务、模型与训练辅助能力。内置 DeepSeek、OpenAI，也可以添加任意数量的兼容 OpenAI 格式服务商。">
    <div className="mb-5 grid gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2 xl:grid-cols-4">
      {settingsSections.map((section) => <button key={section.key} type="button" onClick={() => setSettingsSection(section.key)} aria-pressed={settingsSection === section.key} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left transition ${settingsSection === section.key ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" : "text-slate-600 hover:bg-slate-50"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-md ${settingsSection === section.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><section.icon className="size-4" /></span><span className="min-w-0"><strong className="block text-sm font-semibold">{section.title}</strong><span className="mt-0.5 block truncate text-[11px] text-slate-500">{section.description}</span></span></button>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        {settingsSection === "model" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">模型服务</h2>
            <p className="mt-1 text-xs text-slate-500">先选择服务商，再选择用于回答审阅、追问和参考回答的模型；自定义服务商可以无限添加。</p>
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
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{providerForm.id ? "编辑服务商" : "添加服务商"}</h3><p className="mt-1 text-xs text-slate-500">填写兼容 OpenAI API 的服务商信息，保存后即可获取模型列表。</p></div><button type="button" onClick={() => setProviderForm(null)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-800">取消</button></div>
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
                {availableModels.length ? <NativeSelect value={preferences.model} onChange={(event) => { const nextPreferences = { ...preferences, model: event.target.value }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); persistProviderSettings(nextPreferences, availableModels); setSaved(false); }} className="w-full bg-white">
                  {availableModels.map((model) => <NativeSelectOption key={model.value} value={model.value}>{model.label}</NativeSelectOption>)}
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

        {settingsSection === "privacy" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">隐私与数据</h2><p className="mt-1 text-xs text-slate-500">了解网页保存什么、GitHub 备份什么，以及哪些敏感内容不会离开浏览器。</p></div>
          <div className="divide-y divide-slate-100">
            <div className="flex gap-4 px-5 py-5"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600"><HardDrive className="size-4" /></span><div><h3 className="text-sm font-semibold text-slate-800">配置与运行数据</h3><p className="mt-1 text-sm leading-6 text-slate-600">项目配置、学习记录、训练偏好和运行日志先保存在当前浏览器，变化后自动备份到 GitHub；网站启动时优先加载 GitHub 存档。</p></div></div>
            <div className="flex gap-4 px-5 py-5"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-600"><ShieldCheck className="size-4" /></span><div><h3 className="text-sm font-semibold text-slate-800">密钥与 AI 请求</h3><p className="mt-1 text-sm leading-6 text-slate-600">API Key 只保存在当前会话；AI 请求通过网站后端转发，不会写入学习记录或项目配置。</p></div></div>
          </div>
        </section>}

        {settingsSection === "about" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">关于 VisionInterview</h2><p className="mt-1 text-xs text-slate-500">面向机器视觉工程师的项目答辩、专业知识和回答审阅训练工具。</p></div>
          <div className="space-y-4 p-5"><div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-4"><span className="grid size-10 place-items-center rounded-lg bg-blue-600 text-white"><Gauge className="size-5" /></span><div><p className="font-semibold text-slate-900">VisionInterview</p><p className="mt-1 text-xs text-slate-500">机器视觉面试训练台 · 本地优先版本</p></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">核心流程</p><p className="mt-2 text-sm leading-6 text-slate-700">开始学习 → 完成回答 → AI/本地规则审阅 → 学习记录与温故知新。</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">适用技术</p><p className="mt-2 text-sm leading-6 text-slate-700">HALCON、OpenCV、VisionPro、C#视觉开发、相机光源、标定和 PLC 现场协同。</p></div></div><p className="text-xs leading-5 text-slate-500">建议在面试前先准备一组专业题，再整理项目管理中的答辩项目，最后在温故知新中集中补齐低掌握度题目。</p></div>
        </section>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><CircleCheck className="size-4" />配置已保存</span>}
          {settingsSection === "model" && <Button variant="outline" onClick={fetchModels} disabled={loadingModels}><Globe2 />{loadingModels ? "正在测试…" : "测试连接"}</Button>}
          <Button onClick={savePreferences} className="bg-blue-600 hover:bg-blue-700"><Save />保存配置</Button>
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
          <p className="mt-2 text-sm leading-6 text-slate-600">{apiKey.trim() ? "已使用当前会话密钥。请获取模型以验证地址和密钥是否正确。" : providerStatus?.configured ? "服务器已有安全密钥，可以直接获取模型并测试连接。" : "请填写 API 请求地址和 API Key，然后获取可用模型。"}</p>
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
        {settingsSection === "training" && <section className="panel p-5"><Sparkles className="size-6 text-blue-600" /><h2 className="mt-4 font-semibold text-slate-900">训练偏好提示</h2><p className="mt-2 text-sm leading-6 text-slate-600">建议保留 AI 回答审阅和联网专业题库；项目答辩始终以你选择的本地项目资料为依据。</p></section>}
        {settingsSection === "privacy" && <section className="panel p-5"><ShieldCheck className="size-6 text-emerald-600" /><h2 className="mt-4 font-semibold text-slate-900">数据控制</h2><p className="mt-2 text-sm leading-6 text-slate-600">如需清理学习记录或项目缓存，请在浏览器站点数据中删除本应用的本地数据；这不会删除本地磁盘文件。</p></section>}
        {settingsSection === "about" && <section className="panel p-5"><FileText className="size-6 text-blue-600" /><h2 className="mt-4 font-semibold text-slate-900">使用建议</h2><p className="mt-2 text-sm leading-6 text-slate-600">先独立回答，再展开最佳回答和技术原理；每次完成后查看审阅建议，并在温故知新中重新组织表达。</p></section>}
      </aside>
    </div>
  </PageShell>;
}
