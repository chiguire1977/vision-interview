"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, BarChart3, BookOpenCheck, Bot, BrainCircuit, Check, ChevronDown,
  ChevronRight, CircleAlert, CircleCheck, Clock3, FileText, FolderKanban,
  BookOpen, Eye, EyeOff, Gauge, Globe2, HardDrive, Lightbulb, ListTree, Mic, Pause, Play, RotateCcw, Save, Settings,
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
type Question = {
  title: string; type: string; category: string; source: "专业" | "项目"; difficulty: string; tags: string[];
  keywords: string[]; followUp: string; hint: string; basis?: string; techStacks?: TechStack[];
  reference?: { title: string; url: string };
  bestAnswer?: string; principle?: string;
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

type PreparedGroupResult = { questions: Question[]; source: "AI" | "本地规则"; message?: string };
const pendingQuestionGroupRequests = new Map<string, Promise<PreparedGroupResult>>();

function parsePreparedQuestions(content: string) {
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const objectText = start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(objectText) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)) return (parsed as { questions: unknown[] }).questions;
  return [];
}

async function prepareQuestionGroup(candidates: Question[], projectName: string): Promise<PreparedGroupResult> {
  const fallback = candidates.map((question) => ({
    ...question,
    bestAnswer: getBestAnswer({ ...question, bestAnswer: undefined }, projectName),
    principle: getQuestionPrinciple(question, projectName),
  }));
  try {
    const storedPreferences = localStorage.getItem("vision-interview-ai-preferences");
    const preferences = storedPreferences ? JSON.parse(storedPreferences) as Partial<AiPreferences> : {};
    if (preferences.webQuestions === false) return { questions: fallback, source: "本地规则", message: "已关闭联网题组预取，使用本地题库与标准答案。" };
    const provider = typeof preferences.provider === "string" ? preferences.provider : "deepseek";
    const providerSettings = readAiProviderSettings();
    const definition = getProviderDefinition(provider, providerSettings);
    const baseUrl = provider === "deepseek"
      ? definition.baseUrl
      : providerSettings[provider]?.baseUrl || providerSettings[provider]?.openaiBaseUrl || preferences.openaiBaseUrl || definition.baseUrl;
    const model = providerSettings[provider]?.model || (typeof preferences.model === "string" ? preferences.model : definition.models[0]?.value || "");
    if (!baseUrl || !model) return { questions: fallback, source: "本地规则", message: "未配置 AI，已使用本地题库与标准答案。" };
    const apiKey = sessionStorage.getItem(`vision-interview-ai-key-${provider}`) || "";
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider, baseUrl, model, maxTokens: 1800, temperature: 0.15, ...(apiKey ? { apiKey } : {}),
        messages: [
          {
            role: "system",
            content: "你是机器视觉面试题库整理器。请在用户开始本题组前，一次性整理全部题目对应的标准回答重点和技术原理。优先依据公开题库、官方文档和可靠工程实践；不要编造项目事实。只返回 JSON，不要 Markdown。",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "预取当前面试题组的题目、标准回答和技术原理",
              project: projectName,
              questions: candidates.map((question) => ({
                question: question.title,
                type: question.type,
                category: question.category,
                source: question.source,
                keywords: question.keywords,
                basis: question.basis,
                reference: question.reference,
              })),
              outputSchema: {
                questions: [{ question: "原题目", bestAnswer: "标准回答重点", principle: "技术原理；非技术题可为空", keywords: ["关键词"] }],
              },
            }),
          },
        ],
      }),
    });
    const result = await response.json() as { ok?: boolean; content?: string; message?: string };
    if (!response.ok || !result.ok || !result.content) return { questions: fallback, source: "本地规则", message: result.message || "AI 题组预取失败，已使用本地题库与标准答案。" };
    const entries = parsePreparedQuestions(result.content).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    if (!entries.length) return { questions: fallback, source: "本地规则", message: "AI 未返回有效题组，已使用本地题库与标准答案。" };
    const prepared = candidates.map((question, index) => {
      const entry = entries[index] || entries.find((item) => item.question === question.title) || {};
      const title = typeof entry.question === "string" && entry.question.trim() ? entry.question.trim() : question.title;
      const bestAnswer = typeof entry.bestAnswer === "string" && entry.bestAnswer.trim() ? entry.bestAnswer.trim() : fallback[index].bestAnswer;
      const principle = typeof entry.principle === "string" && entry.principle.trim() ? entry.principle.trim() : fallback[index].principle;
      const keywords = Array.isArray(entry.keywords) ? entry.keywords.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 12) : question.keywords;
      return { ...question, title, bestAnswer, principle, keywords: keywords.length ? keywords : question.keywords };
    });
    return { questions: prepared, source: "AI", message: "本题组题目、标准回答和技术原理已一次性准备完成。" };
  } catch {
    return { questions: fallback, source: "本地规则", message: "AI 题组预取暂不可用，已使用本地题库与标准答案。" };
  }
}

const navItems = [
  { label: "开始学习", icon: BrainCircuit },
  { label: "项目管理", icon: FolderKanban },
  { label: "问题树", icon: ListTree },
  { label: "温故知新", icon: BookOpenCheck },
  { label: "学习记录", icon: BarChart3 },
];

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function randomQuestionRank(title: string, round: number) {
  let value = 2166136261 ^ (round + 1) * 16777619;
  for (let index = 0; index < title.length; index += 1) {
    value = Math.imul(value ^ title.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

function getRecordKey(record: Pick<TrainingRecord, "question" | "source">) {
  return `${record.source ?? "历史"}|${record.question}`;
}

function normalizeTrainingRecords(value: unknown): TrainingRecord[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, TrainingRecord>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as TrainingRecord;
    if (typeof record.question !== "string" || !record.question.trim() || record.action === "查看答案") continue;
    const key = getRecordKey(record);
    const previous = unique.get(key);
    if (!previous) {
      const question = questionBank.find((item) => item.title === record.question);
      const inferredReview = question ? reviewAnswer(record.answer ?? "", question) : undefined;
      unique.set(key, {
        ...record,
        action: record.action === "跳过题目" ? "跳过题目" : "完成答题",
        mastery: record.mastery ?? (inferredReview ? getMasteryLevel(inferredReview, record.answer?.trim() ? "answered" : "skipped") : "低"),
      });
      continue;
    }
    unique.set(key, {
      ...previous,
      action: previous.action ?? (record.action === "跳过题目" ? "跳过题目" : "完成答题"),
      bestAnswerViewed: Boolean(previous.bestAnswerViewed || record.bestAnswerViewed),
      bestAnswer: previous.bestAnswer || record.bestAnswer,
      mastery: previous.mastery || record.mastery || "低",
      masteryReason: previous.masteryReason || record.masteryReason,
      reviewSource: previous.reviewSource || record.reviewSource,
      answerKeywords: previous.answerKeywords || record.answerKeywords,
      principle: previous.principle || record.principle,
    });
  }
  return Array.from(unique.values());
}

function reviewAnswer(answer: string, question: Question): AnswerReview {
  const text = answer.trim();
  const hits = question.keywords.filter((key) => answer.toLowerCase().includes(key.toLowerCase()));
  const missing = question.keywords.filter((key) => !hits.includes(key)).slice(0, 4);
  const markers = ["首先", "其次", "最后", "因此", "项目", "结果", "但是"].filter((x) => answer.includes(x)).length;
  const hasData = /\d+(\.\d+)?(%|毫秒|ms|件|张|万|秒)/i.test(answer);
  const hasBoundary = /(适用|局限|条件|场景|缺点|风险|前提)/.test(answer);
  const issues: string[] = [];
  const suggestions: string[] = [];
  const strengths: string[] = [];

  if (!text) {
    return {
      strengths: [], missing,
      issues: ["本题未作答，无法判断你是否真正掌握了知识点。"],
      suggestions: [`先用一句话给出结论，再围绕“${question.keywords.slice(0, 3).join("、")}”展开说明。`],
    };
  }
  if (hits.length) strengths.push(`已经提到 ${hits.slice(0, 3).join("、")}，回答与题目方向一致。`);
  if (text.length >= 100 && text.length <= 360) strengths.push("回答长度适中，具备进一步整理成面试表达的基础。");
  if (markers >= 2) strengths.push("回答具有一定层次，面试官较容易跟随你的思路。");

  if (missing.length) {
    issues.push(`可能遗漏关键要点：${missing.join("、")}。`);
    suggestions.push(`补充“${missing.join("、")}”，并说明它们与当前结论之间的因果关系。`);
  }
  if (text.length < 80) {
    issues.push("回答偏短，只有结论时容易被认为是背诵，缺少原理或实施过程。 ");
    suggestions.push("扩展为“结论—原理或步骤—实际场景—局限”四段，每段一到两句。");
  } else if (text.length > 420) {
    issues.push("回答较长，重点可能被大量细节淹没。 ");
    suggestions.push("把第一句话改成明确结论，再只保留最能证明结论的两个细节。");
  }
  if (markers < 2) {
    issues.push("回答结构不够明显，面试官难以快速判断你的核心观点。 ");
    suggestions.push("使用“先说结论；其次解释原因；最后说明验证结果或局限”的表达顺序。");
  }
  if (question.source === "项目" && !hasData) {
    issues.push("项目回答缺少可验证的数据或统计口径，可信度不足。 ");
    suggestions.push("补充样本数量、准确率或节拍、异常比例、优化前后对比，并说明数据如何统计。");
  }
  if (!hasBoundary) {
    issues.push("没有说明方案的适用条件或局限，回答显得不够工程化。 ");
    suggestions.push("最后补一句：该方案适合什么条件、在哪些情况下会失败，以及你的补救措施。");
  }
  return { strengths: strengths.length ? strengths : ["回答已经围绕题目展开，可以继续补强关键证据。"], issues, suggestions, missing };
}

function getMasteryLevel(review: AnswerReview, status: "answered" | "skipped" = "answered"): MasteryLevel {
  if (status === "skipped" || !review.strengths.length && !review.missing.length) return "低";
  if (review.issues.length >= 3 || review.missing.length >= 3) return "低";
  if (review.issues.length > 0 || review.missing.length > 0) return "中";
  return "高";
}

function masteryLabel(level: MasteryLevel | undefined) {
  return level ?? "低";
}

function masteryClass(level: MasteryLevel | undefined) {
  if (level === "高") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (level === "中") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

type AiMasteryReview = {
  review: AnswerReview;
  mastery: MasteryLevel;
  reason: string;
  source: "AI" | "本地规则";
};

function asTextList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 8);
}

function parseAiMasteryReview(content: string, fallback: AnswerReview): AiMasteryReview | null {
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned) as Record<string, unknown>;
    const mastery = parsed.mastery;
    if (mastery !== "低" && mastery !== "中" && mastery !== "高") return null;
    const strengths = asTextList(parsed.strengths);
    const issues = asTextList(parsed.issues);
    const suggestions = asTextList(parsed.suggestions);
    const missing = asTextList(parsed.missing);
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "AI 已根据回答内容完成审阅。";
    return {
      mastery,
      reason: reason || "AI 已根据回答内容完成审阅。",
      source: "AI",
      review: {
        strengths: strengths.length ? strengths : fallback.strengths,
        issues: issues.length ? issues : fallback.issues,
        suggestions: suggestions.length ? suggestions : fallback.suggestions,
        missing: missing.length ? missing : fallback.missing,
      },
    };
  } catch {
    return null;
  }
}

async function evaluateAnswerWithAi(question: Question, answer: string, bestAnswer: string, fallbackReview: AnswerReview, fallbackMastery: MasteryLevel): Promise<AiMasteryReview> {
  const localFallback: AiMasteryReview = {
    review: fallbackReview,
    mastery: fallbackMastery,
    reason: "未使用 AI 或 AI 暂不可用，已使用本地审阅规则完成判断。",
    source: "本地规则",
  };
  try {
    const storedPreferences = localStorage.getItem("vision-interview-ai-preferences");
    const preferences = storedPreferences ? JSON.parse(storedPreferences) as Partial<AiPreferences> : {};
    if (preferences.aiScoring === false) return localFallback;
    const provider = typeof preferences.provider === "string" ? preferences.provider : "deepseek";
    const providerSettings = readAiProviderSettings();
    const definition = getProviderDefinition(provider, providerSettings);
    const baseUrl = provider === "deepseek"
      ? definition.baseUrl
      : providerSettings[provider]?.baseUrl || providerSettings[provider]?.openaiBaseUrl || preferences.openaiBaseUrl || definition.baseUrl;
    const model = providerSettings[provider]?.model || (typeof preferences.model === "string" ? preferences.model : definition.models[0]?.value || "");
    if (!baseUrl || !model) return localFallback;
    const apiKey = sessionStorage.getItem(`vision-interview-ai-key-${provider}`) || "";
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider, baseUrl, model, maxTokens: 1000, temperature: 0.1, ...(apiKey ? { apiKey } : {}),
        messages: [
          {
            role: "system",
            content: "你是机器视觉工程师面试回答审阅器。不要打分，只判断掌握程度。必须只返回 JSON，不要 Markdown，不要编造项目事实。掌握程度只能是低、中、高：低表示核心概念或关键步骤缺失；中表示方向基本正确但存在明显遗漏；高表示原理、实施、验证和边界条件表达完整。",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "审阅用户回答并给出掌握程度",
              question: { title: question.title, category: question.category, source: question.source, keywords: question.keywords },
              standardAnswer: bestAnswer,
              userAnswer: answer.trim(),
              outputSchema: { mastery: "低|中|高", reason: "一句话判断依据", strengths: ["可保留的内容"], issues: ["与标准答案相比的不足"], missing: ["遗漏的关键点"], suggestions: ["下一步可执行的提升建议"] },
            }),
          },
        ],
      }),
    });
    const result = await response.json() as { ok?: boolean; content?: string };
    if (!response.ok || !result.ok || !result.content) return localFallback;
    return parseAiMasteryReview(result.content, fallbackReview) ?? localFallback;
  } catch {
    return localFallback;
  }
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("开始学习");
  const [projectCatalog, setProjectCatalog] = useState<ProjectConfig[]>(defaultProjects);
  const [project, setProject] = useState(defaultProjects[0].name);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("专业专项");
  const [category, setCategory] = useState("随机类型");
  const [difficulty, setDifficulty] = useState("随机难度");
  const [techStack, setTechStack] = useState<(typeof techStackFilters)[number]>("随机技术栈");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showBestAnswer, setShowBestAnswer] = useState(false);
  const [bestAnswerViewed, setBestAnswerViewed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
  const [groupCompleted, setGroupCompleted] = useState(false);
  const [groupRound, setGroupRound] = useState(0);
  const [preparedGroupQuestions, setPreparedGroupQuestions] = useState<Question[] | null>(null);
  const [preparingGroup, setPreparingGroup] = useState(true);
  const [groupPreparationSource, setGroupPreparationSource] = useState<"AI" | "本地规则" | "缓存">("本地规则");
  const [groupPreparationMessage, setGroupPreparationMessage] = useState("");
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechInterimRef = useRef("");
  const speechKeepAliveRef = useRef(false);
  const speechRestartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("vision-interview-projects");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return;
      const restored = parsed.filter((item): item is ProjectConfig => Boolean(item) && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" && typeof (item as { name?: unknown }).name === "string" && Boolean((item as { name: string }).name.trim())).map((item) => ({
        id: item.id,
        name: item.name.trim(),
        category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : "未分类",
        progress: typeof item.progress === "number" && Number.isFinite(item.progress) ? Math.max(0, Math.min(100, Math.round(item.progress))) : 0,
      }));
      if (!restored.length) return;
      setProjectCatalog(restored);
      setProject((current) => restored.some((item) => item.name === current) ? current : restored[0].name);
    } catch { /* 忽略损坏的项目管理配置 */ }
  }, []);

  function updateProjectCatalog(next: ProjectConfig[]) {
    setProjectCatalog(next);
    localStorage.setItem("vision-interview-projects", JSON.stringify(next));
  }
  const availableQuestions = useMemo(() => {
    const professional = questionBank.filter((item) => item.source === "专业");
    const localProject = buildLocalProjectQuestions(project);
    let result = trainingMode === "专业专项"
      ? professional
      : trainingMode === "项目答辩"
        ? localProject
        : [...professional, ...localProject];
    if (trainingMode === "专业专项" && category !== "随机类型") {
      result = result.filter((item) => item.category === category);
    }
    if (trainingMode !== "项目答辩" && techStack !== "随机技术栈") {
      result = result.filter((item) => item.source === "项目" || (item.techStacks ?? ["通用原理"]).includes(techStack));
    }
    if (difficulty !== "随机难度") {
      result = result.filter((item) => item.difficulty === difficulty);
    }
    if (result.length) return result;
    const stackFallback = techStack === "随机技术栈"
      ? professional
      : professional.filter((item) => (item.techStacks ?? ["通用原理"]).includes(techStack));
    return stackFallback.length ? stackFallback : professional;
  }, [trainingMode, category, difficulty, techStack, project]);
  const groupQuestionSeed = useMemo(() => {
    const count = Math.min(10, availableQuestions.length);
    const shouldRandomize = category === "随机类型" || difficulty === "随机难度" || techStack === "随机技术栈";
    const ordered = shouldRandomize
      ? [...availableQuestions].sort((left, right) => randomQuestionRank(left.title, groupRound) - randomQuestionRank(right.title, groupRound))
      : availableQuestions;
    const start = shouldRandomize ? 0 : (groupRound * count) % ordered.length;
    return Array.from({ length: count }, (_, index) => ordered[(start + index) % ordered.length]);
  }, [availableQuestions, category, difficulty, techStack, groupRound]);
  let aiSelectionSignature = "";
  if (typeof window !== "undefined") {
    try {
      aiSelectionSignature = localStorage.getItem("vision-interview-ai-preferences") || "";
    } catch { /* 忽略浏览器存储限制 */ }
  }
  const groupPreparationKey = useMemo(() => [project, trainingMode, category, difficulty, techStack, groupRound, aiSelectionSignature, ...groupQuestionSeed.map((item) => item.title)].join("|"), [project, trainingMode, category, difficulty, techStack, groupRound, aiSelectionSignature, groupQuestionSeed]);
  const groupQuestions = preparedGroupQuestions?.length ? preparedGroupQuestions : groupQuestionSeed;
  const question = groupQuestions[questionIndex % groupQuestions.length];
  const currentEvaluation = sessionAnswers.find((item) => item.question.title === question.title);

  function stopRecognition() {
    speechKeepAliveRef.current = false;
    if (speechRestartTimerRef.current !== null) {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    speechInterimRef.current = "";
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.stop(); } catch { try { recognition.abort(); } catch { /* 已结束 */ } }
    }
    setRecording(false);
  }

  function toggleRecording() {
    if (recording) {
      stopRecognition();
      return;
    }
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("当前浏览器不支持语音识别，请使用最新版 Edge 或 Chrome。");
      return;
    }
    if (recognitionRef.current) stopRecognition();
    setAnswer("");
    speechInterimRef.current = "";
    speechKeepAliveRef.current = true;
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.onstart = () => {
      setRecording(true);
      setSpeechError("");
    };
    recognition.onresult = (event) => {
      const finalTranscripts: string[] = [];
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (!transcript) continue;
        if (result.isFinal) finalTranscripts.push(transcript);
        else interimTranscript += transcript;
      }
      setAnswer((current) => {
        let base = current;
        const previousInterim = speechInterimRef.current;
        if (previousInterim && base.endsWith(previousInterim)) base = base.slice(0, -previousInterim.length).trimEnd();
        const spoken = finalTranscripts.join(" ");
        if (spoken) base = base.trim() ? `${base.trim()} ${spoken}` : spoken;
        speechInterimRef.current = interimTranscript;
        return interimTranscript ? `${base.trim()}${base.trim() ? " " : ""}${interimTranscript}` : base;
      });
      if (finalTranscripts.length || interimTranscript) setSpeechError("");
    };
    recognition.onerror = (event) => {
      const permissionError = event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture";
      if (permissionError) speechKeepAliveRef.current = false;
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "麦克风权限未开启，请允许浏览器访问麦克风后重试。"
        : event.error === "audio-capture" ? "没有检测到可用麦克风，请检查系统输入设备。"
        : event.error === "no-speech" ? "暂未识别到清晰语音，仍会继续聆听，请尽量使用短句。" : "语音识别网络暂时波动，正在尝试继续识别。";
      setSpeechError(message);
    };
    recognition.onend = () => {
      if (speechKeepAliveRef.current && recognitionRef.current === recognition) {
        speechRestartTimerRef.current = window.setTimeout(() => {
          speechRestartTimerRef.current = null;
          if (!speechKeepAliveRef.current || recognitionRef.current !== recognition) return;
          try {
            recognition.start();
          } catch {
            speechKeepAliveRef.current = false;
            recognitionRef.current = null;
            setRecording(false);
            setSpeechError("语音识别无法继续，请点击麦克风重新开始。 ");
          }
        }, 160);
        return;
      }
      setRecording(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      speechKeepAliveRef.current = false;
      recognitionRef.current = null;
      setRecording(false);
      setSpeechError("无法启动语音识别，请检查浏览器的麦克风权限。 ");
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("vision-interview-records");
    if (!saved) return;
    try {
      const normalized = normalizeTrainingRecords(JSON.parse(saved));
      setRecords(normalized);
      localStorage.setItem("vision-interview-records", JSON.stringify(normalized));
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    speechKeepAliveRef.current = false;
    if (speechRestartTimerRef.current !== null) window.clearTimeout(speechRestartTimerRef.current);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try { recognition.abort(); } catch { /* 已结束 */ }
    }
  }, []);

  useEffect(() => {
    let active = true;
    stopRecognition();
    setSpeechError("");
    setPreparingGroup(true);
    setPreparedGroupQuestions(null);
    setGroupPreparationSource("本地规则");
    setGroupPreparationMessage("正在一次性准备本题组的题目、标准回答和技术原理…");
    setQuestionIndex(0);
    setAnswer("");
    setSubmitted(false);
    setEvaluating(false);
    setShowHint(false);
    setShowBestAnswer(false);
    setBestAnswerViewed(false);
    setSessionAnswers([]);
    setGroupCompleted(false);

    const cacheKey = `vision-interview-prepared-group-${encodeURIComponent(groupPreparationKey)}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null") as { questions?: unknown[] } | null;
      if (cached?.questions && cached.questions.length === groupQuestionSeed.length && cached.questions.every((item) => item && typeof item === "object" && typeof (item as { title?: unknown }).title === "string")) {
        if (active) {
          setPreparedGroupQuestions(cached.questions as Question[]);
          setGroupPreparationSource("缓存");
          setGroupPreparationMessage("本题组题目、标准回答和技术原理已从本机缓存恢复。进入面试前无需逐题请求。 ");
          setPreparingGroup(false);
        }
        return () => { active = false; };
      }
    } catch { /* 忽略损坏的题组缓存 */ }

    let request = pendingQuestionGroupRequests.get(groupPreparationKey);
    if (!request) {
      request = prepareQuestionGroup(groupQuestionSeed, project);
      pendingQuestionGroupRequests.set(groupPreparationKey, request);
      void request.finally(() => {
        if (pendingQuestionGroupRequests.get(groupPreparationKey) === request) pendingQuestionGroupRequests.delete(groupPreparationKey);
      }).catch(() => undefined);
    }
    request.then((result) => {
      if (!active) return;
      setPreparedGroupQuestions(result.questions);
      setGroupPreparationSource(result.source);
      setGroupPreparationMessage(result.message || "本题组已准备完成。 ");
      setPreparingGroup(false);
      if (result.source === "AI") {
        localStorage.setItem(cacheKey, JSON.stringify({ questions: result.questions, preparedAt: new Date().toISOString() }));
      }
    }).catch(() => {
      if (!active) return;
      setPreparedGroupQuestions(groupQuestionSeed);
      setGroupPreparationSource("本地规则");
      setGroupPreparationMessage("题组预取失败，已切换为本地题库与标准答案。 ");
      setPreparingGroup(false);
    });
    return () => { active = false; };
  }, [groupPreparationKey, groupQuestionSeed, project]);

  useEffect(() => {
    stopRecognition();
    setSpeechError("");
    setShowBestAnswer(false);
    setBestAnswerViewed(false);
  }, [question.title]);

  function appendRecord(record: TrainingRecord) {
    setRecords((current) => {
      const clean = current.filter((item) => item.action !== "查看答案");
      const key = getRecordKey(record);
      const existingIndex = clean.findIndex((item) => getRecordKey(item) === key);
      const existing = existingIndex >= 0 ? clean[existingIndex] : undefined;
      const merged: TrainingRecord = {
        ...existing,
        ...record,
        id: existing?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        action: record.action === "跳过题目" ? "跳过题目" : "完成答题",
        bestAnswerViewed: Boolean(record.bestAnswerViewed || existing?.bestAnswerViewed),
        bestAnswer: record.bestAnswer || existing?.bestAnswer,
      };
      const next = existingIndex >= 0
        ? clean.map((item, index) => index === existingIndex ? merged : item)
        : [merged, ...clean].slice(0, 100);
      localStorage.setItem("vision-interview-records", JSON.stringify(next));
      return next;
    });
  }

  async function submitAnswer() {
    if (preparingGroup || evaluating || submitted) return;
    const localReview = reviewAnswer(answer, question);
    const localMastery = getMasteryLevel(localReview, "answered");
    setEvaluating(true);
    stopRecognition();
    const bestAnswer = getBestAnswer(question, project);
    const evaluation = await evaluateAnswerWithAi(question, answer, bestAnswer, localReview, localMastery);
    const { review, mastery, reason, source } = evaluation;
    setEvaluating(false);
    setSubmitted(true);
    const sessionItem: SessionAnswer = {
      question, answer: answer.trim(), seconds, status: "answered",
      bestAnswer, review, mastery, masteryReason: reason, reviewSource: source,
    };
    setSessionAnswers((current) => {
      const existingIndex = current.findIndex((item) => item.question.title === question.title);
      return existingIndex >= 0 ? current.map((item, index) => index === existingIndex ? sessionItem : item) : [...current, sessionItem];
    });
    const now = new Date();
    appendRecord({
      question: question.title, project, date: now.toLocaleDateString("zh-CN"),
      timestamp: now.toLocaleString("zh-CN"), action: "完成答题", mode: trainingMode,
      category: question.category, source: question.source, seconds, answer,
      bestAnswer, bestAnswerViewed, reviewIssues: review.issues, reviewSuggestions: review.suggestions,
      mastery, masteryUpdatedAt: now.toLocaleString("zh-CN"), masteryReason: reason, reviewSource: source,
      answerKeywords: question.keywords, principle: question.principle || getQuestionPrinciple(question, project),
    });
  }

  function toggleBestAnswer() {
    const opening = !showBestAnswer;
    setShowBestAnswer(opening);
    if (opening) setBestAnswerViewed(true);
  }

  function nextQuestion() {
    if (preparingGroup || evaluating) return;
    if (!submitted) {
      const skippedReview = reviewAnswer("", question);
      const now = new Date();
      const skipped: SessionAnswer = {
        question, answer: "", seconds, status: "skipped",
        bestAnswer: getBestAnswer(question, project), review: skippedReview, mastery: "低",
      };
      setSessionAnswers((current) => current.some((item) => item.question.title === question.title) ? current : [...current, skipped]);
      appendRecord({
        question: question.title, project, date: now.toLocaleDateString("zh-CN"),
        timestamp: now.toLocaleString("zh-CN"), action: "跳过题目", mode: trainingMode,
        category: question.category, source: question.source, seconds, answer: "",
        bestAnswer: skipped.bestAnswer, mastery: "低", masteryUpdatedAt: now.toLocaleString("zh-CN"),
        reviewIssues: skippedReview.issues, reviewSuggestions: skippedReview.suggestions,
        masteryReason: "跳过题目，尚未提交回答。", reviewSource: "本地规则",
        answerKeywords: question.keywords, principle: question.principle || getQuestionPrinciple(question, project),
      });
    }
    if (questionIndex >= groupQuestions.length - 1) {
      setGroupCompleted(true);
      stopRecognition();
      return;
    }
    stopRecognition();
    setQuestionIndex((value) => value + 1);
    setAnswer(""); setSubmitted(false); setShowHint(false); setShowBestAnswer(false); setBestAnswerViewed(false); setSeconds(0);
  }

  function restartGroup() {
    stopRecognition();
    setGroupCompleted(false); setSessionAnswers([]); setQuestionIndex(0); setAnswer(""); setSubmitted(false); setEvaluating(false); setPreparedGroupQuestions(null); setPreparingGroup(true);
    setShowHint(false); setShowBestAnswer(false); setBestAnswerViewed(false); setRecording(false); setSeconds(0);
    setGroupRound((value) => value + 1);
  }

  function retryQuestion(index: number) {
    stopRecognition();
    const previous = sessionAnswers.find((item) => item.question.title === groupQuestions[index]?.title);
    setGroupCompleted(false); setQuestionIndex(index); setAnswer(previous?.answer ?? ""); setSubmitted(false); setEvaluating(false);
    setShowHint(false); setShowBestAnswer(false); setBestAnswerViewed(false); setRecording(false); setSeconds(0);
  }

  function changeMode(mode: TrainingMode) {
    stopRecognition();
    setTrainingMode(mode); setCategory("随机类型"); setDifficulty("随机难度"); setTechStack("随机技术栈");
    setQuestionIndex(0); setAnswer(""); setSubmitted(false); setEvaluating(false); setPreparedGroupQuestions(null); setPreparingGroup(true); setShowHint(false); setShowBestAnswer(false); setBestAnswerViewed(false); setSeconds(0);
    setSessionAnswers([]); setGroupCompleted(false); setGroupRound(0);
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <Sidebar collapsible="offcanvas" className="border-r-0 bg-[#101d2b] text-slate-200">
        <SidebarHeader className="h-16 justify-center border-b border-white/8 px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white"><Gauge className="size-5" /></div>
            <div><p className="text-[15px] font-semibold text-white">VisionInterview</p><p className="text-[11px] text-slate-400">机器视觉面试训练台</p></div>
          </div>
        </SidebarHeader>
        <SidebarContent className="bg-[#101d2b] px-2 py-3">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton isActive={activeNav === item.label} onClick={() => setActiveNav(item.label)}
                      tooltip={item.label} className="h-10 cursor-pointer rounded-md px-3 text-slate-300 hover:bg-white/7 hover:text-white data-[active=true]:bg-blue-500/16 data-[active=true]:text-blue-300">
                      <item.icon /><span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/8 bg-[#101d2b] p-3">
          <SidebarMenuButton isActive={activeNav === "设置"} onClick={() => setActiveNav("设置")}
            className="cursor-pointer text-slate-400 hover:bg-white/7 hover:text-white data-[active=true]:bg-blue-500/16 data-[active=true]:text-blue-300"><Settings /><span>设置</span></SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#f2f5f8]">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="mr-3 md:hidden" />
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-500">
            <span>{activeNav}</span><ChevronRight className="size-3.5" />
            <span className="truncate font-medium text-slate-900">{activeNav === "开始学习" ? trainingMode : project}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 sm:flex">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />面试进行中 {formatTime(seconds)}
            </div>
            <button className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-1.5 pr-2 text-sm" aria-label="打开用户菜单">
              <span className="grid size-7 place-items-center rounded bg-slate-800 text-white"><UserRound className="size-4" /></span><ChevronDown className="size-3.5 text-slate-400" />
            </button>
          </div>
        </header>

        {activeNav === "开始学习" && (groupCompleted ? (
          <GroupReview answers={sessionAnswers} totalQuestions={groupQuestions.length} mode={trainingMode}
            onRestart={restartGroup} onRetry={retryQuestion} />
        ) : <TrainingCenter question={question} questionIndex={questionIndex} totalQuestions={groupQuestions.length}
          trainingMode={trainingMode} category={category} difficulty={difficulty} techStack={techStack} project={project}
          onModeChange={changeMode} onCategoryChange={(value) => { setCategory(value); setQuestionIndex(0); setAnswer(""); setSubmitted(false); setEvaluating(false); setPreparedGroupQuestions(null); setPreparingGroup(true); setSeconds(0); setSessionAnswers([]); setGroupCompleted(false); setGroupRound(0); }}
          onDifficultyChange={(value) => { setDifficulty(value); setQuestionIndex(0); setAnswer(""); setSubmitted(false); setEvaluating(false); setPreparedGroupQuestions(null); setPreparingGroup(true); setSeconds(0); setSessionAnswers([]); setGroupCompleted(false); setGroupRound(0); }}
          onTechStackChange={(value) => { setTechStack(value); setQuestionIndex(0); setAnswer(""); setSubmitted(false); setEvaluating(false); setPreparedGroupQuestions(null); setPreparingGroup(true); setShowBestAnswer(false); setSeconds(0); setSessionAnswers([]); setGroupCompleted(false); setGroupRound(0); }}
          answer={answer} setAnswer={setAnswer} submitted={submitted} showHint={showHint} recording={recording} seconds={seconds} speechError={speechError}
          bestAnswer={getBestAnswer(question, project)} showBestAnswer={showBestAnswer} bestAnswerViewed={bestAnswerViewed} onToggleBestAnswer={toggleBestAnswer}
          evaluating={evaluating} preparingGroup={preparingGroup} groupPreparationSource={groupPreparationSource} groupPreparationMessage={groupPreparationMessage}
          currentMastery={currentEvaluation?.mastery} currentReviewSource={currentEvaluation?.reviewSource} currentMasteryReason={currentEvaluation?.masteryReason}
          onSubmit={submitAnswer} onNext={nextQuestion}
          onToggleHint={() => setShowHint((v) => !v)} onToggleRecording={toggleRecording}
          onReset={() => { stopRecognition(); setSpeechError(""); setAnswer(""); setSubmitted(false); setEvaluating(false); setShowBestAnswer(false); setBestAnswerViewed(false); setSeconds(0); }} />)}
        {activeNav === "项目管理" && <ProjectManagement project={project} setProject={setProject} projects={projectCatalog} onProjectsChange={updateProjectCatalog} />}
        {activeNav === "问题树" && <QuestionTree />}
        {activeNav === "温故知新" && <ReviewCenter records={records} onStart={() => setActiveNav("开始学习")} />}
        {activeNav === "学习记录" && <TrainingReport records={records} />}
        {activeNav === "设置" && <SettingsPage />}

        <footer className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-2"><Volume2 className="size-3.5" />麦克风正常 <i className="size-1.5 rounded-full bg-emerald-500" /></span>
          <span className="flex items-center gap-2"><Save className="size-3.5" />训练记录自动保存在当前设备</span>
          <span className="flex items-center gap-2"><Clock3 className="size-3.5" />建议复习：明天</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}

type TrainingProps = {
  question: Question; questionIndex: number; totalQuestions: number; trainingMode: TrainingMode; project: string;
  category: string; difficulty: string; techStack: (typeof techStackFilters)[number]; onModeChange: (value: TrainingMode) => void;
  onCategoryChange: (value: string) => void; onDifficultyChange: (value: string) => void;
  onTechStackChange: (value: (typeof techStackFilters)[number]) => void;
  answer: string; setAnswer: (value: string) => void;
  submitted: boolean; showHint: boolean;
  bestAnswer: string; showBestAnswer: boolean; bestAnswerViewed: boolean; onToggleBestAnswer: () => void;
  evaluating: boolean; preparingGroup: boolean; groupPreparationSource: "AI" | "本地规则" | "缓存"; groupPreparationMessage: string;
  currentMastery?: MasteryLevel; currentReviewSource?: "AI" | "本地规则"; currentMasteryReason?: string;
  recording: boolean; seconds: number; speechError?: string; onSubmit: () => void; onNext: () => void;
  onToggleHint: () => void; onToggleRecording: () => void; onReset: () => void;
};

function TrainingCenter(props: TrainingProps) {
  const modes: { name: TrainingMode; description: string; icon: typeof BrainCircuit }[] = [
    { name: "专业专项", description: "按知识领域系统训练", icon: BrainCircuit },
    { name: "项目答辩", description: "围绕真实项目连续追问", icon: FolderKanban },
    { name: "综合模拟", description: "模拟完整面试题目组合", icon: Sparkles },
  ];
  const questionReference = props.question.reference ?? webQuestionSources[props.question.category];
  const questionTechStacks = props.question.techStacks ?? (["通用原理"] as TechStack[]);
  const questionPrinciple = props.question.principle || getQuestionPrinciple(props.question, props.project);
  return (
    <main className="flex-1 p-3 md:p-5">
      <div className="mx-auto max-w-6xl">
        <div className="min-w-0 space-y-4">
          <section className="panel p-4">
            <div className="grid gap-2 md:grid-cols-3">
              {modes.map((mode) => <button key={mode.name} onClick={() => props.onModeChange(mode.name)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${props.trainingMode === mode.name ? "border-blue-300 bg-blue-50 ring-2 ring-blue-500/10" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-md ${props.trainingMode === mode.name ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><mode.icon className="size-4" /></span>
                <span><strong className="block text-sm font-semibold text-slate-900">{mode.name}</strong><span className="mt-0.5 block text-[11px] text-slate-500">{mode.description}</span></span>
              </button>)}
            </div>
            <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-2">
              <div className="flex items-start gap-2 text-slate-600"><Globe2 className="mt-0.5 size-4 shrink-0 text-blue-600" /><span><strong className="font-semibold text-slate-800">专业知识：</strong>AI 联网搜索面试题库，去重、分类并保留原始来源。</span></div>
              <div className="flex items-start gap-2 text-slate-600"><HardDrive className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span><strong className="font-semibold text-slate-800">项目答辩：</strong>只读取本地项目资料和历史回答，不从网络拼接项目经历。</span></div>
            </div>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 w-16 shrink-0 text-xs font-medium text-slate-500">学习类型</span>
                {props.trainingMode === "专业专项" && professionalCategories.map((item) => <button key={item} onClick={() => props.onCategoryChange(item)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs transition ${props.category === item ? "border-blue-200 bg-blue-50 font-medium text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{item}</button>)}
                {props.trainingMode === "项目答辩" && <span className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700">当前项目：{props.project}</span>}
                {props.trainingMode === "综合模拟" && <span className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700">专业知识 + 项目答辩</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 w-16 shrink-0 text-xs font-medium text-slate-500">难度分类</span>
                {difficultyFilters.map((item) => <button key={item} onClick={() => props.onDifficultyChange(item)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs transition ${props.difficulty === item ? "border-blue-200 bg-blue-50 font-medium text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{item}</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 w-16 shrink-0 text-xs font-medium text-slate-500">技术栈</span>
                {props.trainingMode === "项目答辩" ? (
                  <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">跟随当前项目技术栈</span>
                ) : techStackFilters.map((item) => <button key={item} onClick={() => props.onTechStackChange(item)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs transition ${props.techStack === item ? "border-violet-200 bg-violet-50 font-medium text-violet-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{item}</button>)}
              </div>
            </div>
          </section>

          <section className="panel p-5 md:p-6">
            <div className={`mb-4 flex items-start gap-2 rounded-md border p-3 text-xs leading-5 ${props.preparingGroup ? "border-blue-100 bg-blue-50 text-blue-800" : props.groupPreparationSource === "AI" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
              {props.preparingGroup ? <Bot className="mt-0.5 size-4 shrink-0 animate-pulse" /> : <BookOpenCheck className="mt-0.5 size-4 shrink-0" />}
              <span><strong className="font-semibold">{props.preparingGroup ? "正在准备本题组" : `本题组已准备（${props.groupPreparationSource === "AI" ? "AI联网预取" : props.groupPreparationSource === "缓存" ? "本机缓存" : "本地题库"}）`}</strong><span className="ml-1">{props.groupPreparationMessage}</span></span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-md bg-blue-50 text-blue-700 hover:bg-blue-50">{props.question.type} · 第 {props.questionIndex + 1} 题</Badge>
              <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">{props.question.difficulty}</Badge>
              <Badge variant="outline" className="rounded-md border-slate-200 bg-slate-50 text-slate-600">{props.question.category}</Badge>
              {props.question.source === "专业" && questionTechStacks.map((stack) => <Badge key={stack} variant="outline" className="rounded-md border-violet-200 bg-violet-50 text-violet-700">{stack}</Badge>)}
              <Badge variant="outline" className={`rounded-md ${props.question.source === "专业" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{props.question.source === "专业" ? "网络题库" : "本地项目"}</Badge>
              {props.question.source === "专业" && <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-500"><Globe2 className="size-3.5 shrink-0 text-blue-600" /><span className="truncate">来源：{questionReference?.title ?? "机器视觉面试题库"}</span>{questionReference && <a href={questionReference.url} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-blue-700 hover:underline">查看来源 ↗</a>}</span>}
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-slate-400">当前题组 {props.questionIndex + 1}/{props.totalQuestions}</span>
                <Button variant="outline" size="sm" onClick={props.onNext} disabled={props.preparingGroup || props.evaluating} className="h-8 border-slate-200 bg-white text-slate-600">
                  {props.questionIndex >= props.totalQuestions - 1 ? "跳过并查看复盘" : "跳过此题"}<ChevronRight />
                </Button>
              </div>
            </div>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-950 md:text-[26px]">{props.question.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">{props.question.tags.map((tag) => <span key={tag} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{tag}</span>)}</div>
            {props.question.source !== "专业" && (
              <div className="mt-5 flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-5 text-slate-600">
                <HardDrive className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span><strong className="font-medium text-emerald-800">本地提问依据：</strong>{props.question.basis ?? projectQuestionBasis[props.question.title] ?? `来自“${props.project}”项目资料中的技术方案与职责记录`}</span>
              </div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 className="font-semibold text-slate-900">我的回答</h2><p className="mt-0.5 text-xs text-slate-500">先给结论，再结合真实项目数据说明</p></div>
              <Button variant="ghost" size="sm" onClick={props.onReset} className="text-slate-500"><RotateCcw />重置</Button>
            </div>
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center">
              <Button variant={props.recording ? "outline" : "default"} size="icon-lg" onClick={props.onToggleRecording} disabled={props.preparingGroup || props.evaluating || props.submitted}
                className={props.recording ? "border-red-200 text-red-600 hover:bg-red-50" : "bg-red-600 hover:bg-red-700"} aria-label={props.recording ? "暂停录音" : "开始录音"}>
                {props.recording ? <Pause /> : <Mic />}
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-9 flex-1 items-center gap-[3px] overflow-hidden" aria-label="录音波形">
                  {Array.from({ length: 52 }).map((_, i) => <i key={i} className={`wavebar ${props.recording ? "wavebar-active" : ""}`} style={{ height: `${8 + ((i * 13) % 25)}px`, animationDelay: `${i * 28}ms` }} />)}
                </div>
                <span className="font-mono text-sm font-medium tabular-nums text-slate-600">{formatTime(props.seconds)}</span>
              </div>
              <span className="text-xs text-slate-500">{props.recording ? "实时识别中…" : "点击麦克风开始（会清空上次语音）"}</span>
            </div>
            {props.speechError && <div className="border-b border-rose-100 bg-rose-50 px-5 py-2.5 text-xs leading-5 text-rose-700">{props.speechError}</div>}
            <div className="p-5">
              <Textarea value={props.answer} disabled={props.preparingGroup || props.evaluating || props.submitted} onChange={(e) => props.setAnswer(e.target.value)}
                placeholder="在这里输入你的回答。建议包含：选择依据、对比方案、项目数据、局限性……"
                className="min-h-44 resize-y border-slate-200 bg-white p-4 text-[15px] leading-7 shadow-none focus-visible:border-blue-400 focus-visible:ring-blue-100" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">字数：{props.answer.length} · 建议 120–300 字</span>
                <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={props.onToggleHint} disabled={props.preparingGroup}><Lightbulb />查看提示</Button>
                  <Button onClick={props.onSubmit} disabled={props.answer.trim().length === 0 || props.submitted || props.evaluating || props.preparingGroup} className="bg-blue-600 hover:bg-blue-700"><Check />{props.evaluating ? "AI审阅中…" : props.submitted ? "已完成回答" : "回答完成"}</Button>
                  <Button onClick={props.onNext} disabled={!props.submitted || props.evaluating || props.preparingGroup} variant="outline" className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50"><ChevronRight />{props.submitted && props.questionIndex >= props.totalQuestions - 1 ? "完成题组" : "进入下一题"}</Button></div>
              </div>
              {props.evaluating && <div className="mt-4 flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><Bot className="size-4 animate-pulse" />正在调用已配置的 AI 审阅回答，判断掌握程度并提取遗漏点…</div>}
              {props.submitted && props.currentMastery && <div className={`mt-4 rounded-md border p-3 text-sm ${masteryClass(props.currentMastery)}`}><div className="flex flex-wrap items-center gap-2"><strong>本题掌握度：{masteryLabel(props.currentMastery)}</strong><Badge variant="outline" className={`rounded-md ${masteryClass(props.currentMastery)}`}>{props.currentReviewSource === "AI" ? "AI审阅" : "本地规则兜底"}</Badge></div>{props.currentMasteryReason && <p className="mt-1.5 leading-6">{props.currentMasteryReason}</p>}</div>}
              {props.showHint && <div className="mt-4 flex gap-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-800"><Lightbulb className="mt-0.5 size-4 shrink-0" />{props.question.hint}</div>}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <button onClick={props.onToggleBestAnswer} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50" aria-expanded={props.showBestAnswer}>
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-600"><BookOpen className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold text-slate-900">最佳回答</strong>
                <span className="mt-0.5 block text-xs text-slate-500">{props.showBestAnswer ? "参考答案已展开，可与自己的回答逐项对照" : "默认隐藏，建议先独立作答后再查看"}</span>
              </span>
              {props.bestAnswerViewed && <Badge variant="outline" className="hidden rounded-md border-violet-200 bg-violet-50 text-violet-700 sm:inline-flex">已学习</Badge>}
              <span className="flex items-center gap-1.5 text-xs font-medium text-violet-700">{props.showBestAnswer ? <><EyeOff className="size-4" />收起答案</> : <><Eye className="size-4" />查看答案</>}</span>
            </button>
            {props.showBestAnswer && (
              <div className="border-t border-violet-100 bg-violet-50/45 px-5 py-5">
                <div className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-semibold text-white">A</span>
                  <div>
                    <div className="mb-4 rounded-md border border-violet-200 bg-white/70 p-3"><p className="text-xs font-semibold text-violet-700">关键词要点</p><div className="mt-2 flex flex-wrap gap-2">{props.question.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-violet-100 px-2 py-1 text-xs text-violet-800">{keyword}</span>)}</div></div>
                    <p className="text-xs font-semibold text-violet-700">标准回答重点</p><p className="mt-2 whitespace-pre-line text-[15px] leading-8 text-slate-800">{props.bestAnswer}</p>
                    <p className="mt-4 flex items-center gap-2 border-t border-violet-100 pt-3 text-xs text-slate-500">
                      <CircleAlert className="size-3.5 text-amber-500" />
                      {props.question.source === "专业" ? "专业答案根据题库要点整理，面试时应使用自己的语言表达。" : "项目答案只使用本地档案；【待补充】内容必须查阅真实项目记录。"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {questionPrinciple && <section className="panel overflow-hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600"><Lightbulb className="size-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-slate-900">技术原理</strong><span className="mt-0.5 block text-xs text-slate-500">默认隐藏，点击查看本题背后的算法或工程机制</span></span>
                <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-4"><p className="whitespace-pre-line text-sm leading-7 text-slate-700">{questionPrinciple}</p></div>
            </details>
          </section>}

          <section className="panel p-5">
            <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-md bg-blue-50 text-blue-600"><Bot className="size-4" /></span>
              <div><h2 className="font-semibold text-slate-900">面试官追问</h2><p className="text-xs text-slate-500">根据你刚才的回答继续深挖</p></div></div>
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/60 p-4 text-[15px] leading-7 text-slate-800">
              {props.submitted ? props.question.followUp : "完成当前回答后，系统会根据你的内容生成针对性追问。"}
            </div>
            <div className="mt-4 flex gap-2"><Button variant="outline" onClick={props.onToggleHint} disabled={props.preparingGroup}><Lightbulb />回答思路</Button></div>
          </section>
        </div>
      </div>
    </main>
  );
}

function GroupReview({ answers, totalQuestions, mode, onRestart, onRetry }: {
  answers: SessionAnswer[]; totalQuestions: number; mode: TrainingMode;
  onRestart: () => void; onRetry: (index: number) => void;
}) {
  const answeredCount = answers.filter((item) => item.status === "answered").length;
  const skippedCount = answers.filter((item) => item.status === "skipped").length;
  const priorities = Array.from(new Set(answers.flatMap((item) => item.review.suggestions))).slice(0, 4);
  return <main className="flex-1 p-3 md:p-5">
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-slate-200 bg-slate-950 px-5 py-6 text-white md:flex-row md:items-center md:justify-between md:px-7">
          <div>
            <div className="flex items-center gap-2 text-sm text-blue-300"><BookOpenCheck className="size-4" />{mode} · 题组复盘</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">不打分，只审阅回答中真正需要改进的地方</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">系统按照题目关键点、表达结构、项目证据和工程边界逐题检查，建议用于下一轮重新组织答案。</p>
          </div>
          <Button onClick={onRestart} className="shrink-0 bg-white text-slate-900 hover:bg-slate-100"><RotateCcw />进入下一题组</Button>
        </div>
        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          {[
            ["题组题目", `${totalQuestions} 道`],
            ["完成作答", `${answeredCount} 道`],
            ["跳过待补", `${skippedCount} 道`],
          ].map(([label, value]) => <div key={label} className="bg-white px-5 py-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-900">{value}</p></div>)}
        </div>
      </section>

      <section className="panel p-5 md:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-amber-50 text-amber-600"><Target className="size-4" /></span>
          <div><h2 className="font-semibold text-slate-900">下一轮优先改进</h2><p className="mt-0.5 text-xs text-slate-500">先处理最影响面试官判断的内容，而不是追求一个抽象分数</p></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(priorities.length ? priorities : ["本题组回答较完整，下一轮尝试把每题压缩到 1–2 分钟，并保持结论先行。"]).map((item, index) =>
            <div key={item} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-semibold text-white">{index + 1}</span><span>{item}</span>
            </div>)}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">逐题回答审阅</h2><p className="mt-1 text-xs text-slate-500">展开题目，查看回答不足、修改提示和参考回答</p></div>
        <Accordion type="multiple" className="divide-y divide-slate-100">
          {answers.map((item, index) => <AccordionItem key={`${item.question.title}-${index}`} value={`review-${index}`} className="border-0 px-5">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex min-w-0 flex-1 items-center gap-3 pr-3 text-left">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${item.status === "answered" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-slate-900">{item.question.title}</strong><span className="mt-1 block text-xs font-normal text-slate-500">{item.status === "answered" ? `已作答 · ${item.answer.length} 字 · 用时 ${formatTime(item.seconds)}` : "已跳过 · 建议优先补答"}</span></span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={`hidden rounded-md sm:inline-flex ${masteryClass(item.mastery)}`}>掌握度：{masteryLabel(item.mastery)}</Badge>
                  {item.reviewSource && <Badge variant="outline" className="hidden rounded-md border-slate-200 bg-slate-50 text-slate-600 sm:inline-flex">{item.reviewSource === "AI" ? "AI审阅" : "本地规则"}</Badge>}
                  <Badge variant="outline" className={`hidden rounded-md sm:inline-flex ${item.review.issues.length ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{item.review.issues.length ? `${item.review.issues.length} 项待改进` : "表达完整"}</Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">我的回答</p><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{item.answer || "本题未作答"}</p></div>
                  {item.review.strengths.length > 0 && <div><h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CircleCheck className="size-4" />回答中可以保留的部分</h3><ul className="mt-2 space-y-2">{item.review.strengths.map((text) => <li key={text} className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">{text}</li>)}</ul></div>}
                </div>
                <div className="space-y-4">
                  <div><h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800"><CircleAlert className="size-4" />主要不足</h3><ul className="mt-2 space-y-2">{item.review.issues.map((text) => <li key={text} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">{text}</li>)}</ul></div>
                  <div><h3 className="flex items-center gap-2 text-sm font-semibold text-blue-800"><Lightbulb className="size-4" />下一次应该这样补充</h3><ol className="mt-2 space-y-2">{item.review.suggestions.map((text, suggestionIndex) => <li key={text} className="flex gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-950"><span className="font-semibold text-blue-600">{suggestionIndex + 1}.</span><span>{text}</span></li>)}</ol></div>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/60 p-4"><p className="text-xs font-semibold text-violet-700">标准回答重点</p><div className="mt-2 flex flex-wrap gap-2">{item.question.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-violet-100 px-2 py-1 text-xs text-violet-800">{keyword}</span>)}</div><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{item.bestAnswer}</p></div>
              {item.question.principle && <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 group"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-700"><Lightbulb className="size-4 text-slate-500" />技术原理（默认隐藏）<ChevronDown className="ml-auto size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary><p className="mt-3 whitespace-pre-line border-t border-slate-200 pt-3 text-sm leading-7 text-slate-700">{item.question.principle}</p></details>}
              {item.masteryReason && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-600">掌握度判断依据</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.masteryReason}</p></div>}
              <Button variant="outline" size="sm" onClick={() => onRetry(index)} className="mt-4 bg-white"><RotateCcw />重新回答这道题</Button>
            </AccordionContent>
          </AccordionItem>)}
        </Accordion>
      </section>
    </div>
  </main>;
}

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="flex-1 p-4 md:p-6"><div className="mx-auto max-w-6xl"><div className="mb-6"><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</div></main>;
}

type ProjectManagementProps = {
  project: string;
  setProject: (value: string) => void;
  projects: ProjectConfig[];
  onProjectsChange: (projects: ProjectConfig[]) => void;
};

type ProjectDraft = { id?: string; name: string; category: string; progress: number };

function ProjectManagement({ project, setProject, projects: projectItems, onProjectsChange }: ProjectManagementProps) {
  const [projectView, setProjectView] = useState<"card" | "list">("card");
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [projectFormError, setProjectFormError] = useState("");

  useEffect(() => {
    const savedView = localStorage.getItem("vision-interview-project-view");
    if (savedView === "card" || savedView === "list") setProjectView(savedView);
  }, []);


  function changeProjectView(view: "card" | "list") {
    setProjectView(view);
    localStorage.setItem("vision-interview-project-view", view);
  }

  function openCreateProject() {
    setProjectDraft({ name: "", category: "", progress: 0 });
    setProjectFormError("");
  }

  function openEditProject(item: ProjectConfig) {
    setProject(item.name);
    setProjectDraft({ id: item.id, name: item.name, category: item.category, progress: item.progress });
    setProjectFormError("");
  }

  function saveProjectDraft() {
    if (!projectDraft) return;
    const name = projectDraft.name.trim();
    const category = projectDraft.category.trim() || "未分类";
    if (!name) {
      setProjectFormError("请填写项目名称。");
      return;
    }
    const duplicate = projectItems.some((item) => item.name === name && item.id !== projectDraft.id);
    if (duplicate) {
      setProjectFormError("项目名称已存在，请换一个名称。");
      return;
    }
    if (projectDraft.id) {
      const previous = projectItems.find((item) => item.id === projectDraft.id);
      const nextProjects = projectItems.map((item) => item.id === projectDraft.id ? { ...item, name, category, progress: Math.max(0, Math.min(100, Math.round(projectDraft.progress))) } : item);
      onProjectsChange(nextProjects);
      if (previous && previous.name !== name && project === previous.name) setProject(name);
    } else {
      const next: ProjectConfig = { id: `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name, category, progress: Math.max(0, Math.min(100, Math.round(projectDraft.progress))) };
      onProjectsChange([...projectItems, next]);
      setProject(name);
    }
    setProjectDraft(null);
    setProjectFormError("");
  }

  function deleteProject(item: ProjectConfig) {
    if (projectItems.length <= 1) {
      setProjectFormError("至少保留一个项目，无法删除最后一个项目。");
      return;
    }
    if (!window.confirm(`确定从项目管理中删除“${item.name}”吗？这不会删除磁盘中的项目文件。`)) return;
    const nextProjects = projectItems.filter((candidate) => candidate.id !== item.id);
    onProjectsChange(nextProjects);
    if (project === item.name) setProject(nextProjects[0].name);
  }

  return <PageShell title="项目管理" subtitle="集中管理面试项目，开始学习会使用当前选中的项目生成答辩题。">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white"><FolderKanban className="size-4" /></span><div><p className="text-sm font-semibold text-slate-900">我的项目</p><p className="text-xs text-slate-500">{projectItems.length} 个项目 · 仅在当前浏览器保存管理信息</p></div></div></div>
      <Button type="button" onClick={openCreateProject} className="w-fit bg-blue-600 hover:bg-blue-700"><Plus />添加项目</Button>
    </div>
    {projectFormError && !projectDraft && <p className="mb-4 flex items-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700"><CircleAlert className="size-4" />{projectFormError}</p>}
    {projectDraft && <section className="panel mb-5 border-blue-200 bg-blue-50/45 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold text-slate-900">{projectDraft.id ? "编辑项目" : "添加项目"}</h2><p className="mt-1 text-xs leading-5 text-slate-500">项目名称和分类用于组织项目答辩题，档案完整度用于记录准备进度。</p></div><button type="button" onClick={() => { setProjectDraft(null); setProjectFormError(""); }} className="w-fit rounded px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-800">取消</button></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>项目名称</span><Input value={projectDraft.name} onChange={(event) => setProjectDraft((current) => current && { ...current, name: event.target.value })} placeholder="例如：手机玻璃外观检测" className="bg-white" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>项目分类</span><Input value={projectDraft.category} onChange={(event) => setProjectDraft((current) => current && { ...current, category: event.target.value })} placeholder="例如：外观检测、点胶引导" className="bg-white" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>档案完整度（{projectDraft.progress}%）</span><Input type="number" min={0} max={100} value={projectDraft.progress} onChange={(event) => setProjectDraft((current) => current && { ...current, progress: Number(event.target.value) || 0 })} className="bg-white" /></label>
      </div>
      {projectFormError && <p className="mt-3 flex items-center gap-2 text-xs text-rose-600"><CircleAlert className="size-4" />{projectFormError}</p>}
      <div className="mt-4 flex justify-end"><Button type="button" onClick={saveProjectDraft} className="bg-blue-600 hover:bg-blue-700"><Save />保存项目</Button></div>
    </section>}

    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-900">项目列表</h2><p className="mt-1 text-xs text-slate-500">选择项目后会将其设为当前项目，用于后续项目答辩训练。</p></div><div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1"><button type="button" onClick={() => changeProjectView("card")} aria-pressed={projectView === "card"} className={`rounded px-2.5 py-1.5 text-xs ${projectView === "card" ? "bg-white font-medium text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><FolderKanban className="mr-1 inline size-3.5" />卡片</button><button type="button" onClick={() => changeProjectView("list")} aria-pressed={projectView === "list"} className={`rounded px-2.5 py-1.5 text-xs ${projectView === "list" ? "bg-white font-medium text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><ListTree className="mr-1 inline size-3.5" />列表</button></div></div>
      {projectItems.length === 0 ? <div className="grid min-h-40 place-items-center p-8 text-center text-sm text-slate-500">还没有项目，请先添加一个项目。</div> : projectView === "card" ? <div className="grid gap-4 p-5 md:grid-cols-2">
        {projectItems.map((item) => <div key={item.id} className={`rounded-lg border bg-white transition ${project === item.name ? "border-blue-300 ring-2 ring-blue-500/15" : "border-slate-200 hover:border-blue-200"}`}>
          <button type="button" onClick={() => setProject(item.name)} className="w-full p-5 text-left"><div className="flex items-start justify-between gap-3"><span className={`grid size-10 place-items-center rounded-lg ${project === item.name ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}><FolderKanban className="size-5" /></span>{project === item.name && <Badge className="bg-blue-600">当前项目</Badge>}</div><h3 className="mt-5 font-semibold text-slate-900">{item.name}</h3><p className="mt-1 text-sm text-slate-500">{item.category} · 已整理需求、方案、难点与结果</p><div className="mt-4 flex items-center gap-3"><Progress value={item.progress} className="h-1.5 flex-1 bg-slate-100 [&_[data-slot=progress-indicator]]:bg-blue-600" /><span className="text-xs font-medium text-slate-600">{item.progress}%</span></div></button>
          <div className="flex justify-end gap-1 border-t border-slate-100 px-4 py-2"><button type="button" onClick={() => openEditProject(item)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Pencil className="size-3.5" />编辑</button><button type="button" onClick={() => deleteProject(item)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"><Trash2 className="size-3.5" />删除</button></div>
        </div>)}
      </div> : <div className="divide-y divide-slate-100">
        {projectItems.map((item) => <div key={item.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${project === item.name ? "bg-blue-50/45" : "bg-white"}`}><button type="button" onClick={() => setProject(item.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className={`grid size-9 shrink-0 place-items-center rounded-md ${project === item.name ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><FolderKanban className="size-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm font-semibold text-slate-900">{item.name}</strong>{project === item.name && <Badge className="bg-blue-600">当前项目</Badge>}</span><span className="mt-1 block truncate text-xs text-slate-500">{item.category}</span></span><span className="hidden w-32 items-center gap-2 md:flex"><Progress value={item.progress} className="h-1.5 flex-1 bg-slate-100 [&_[data-slot=progress-indicator]]:bg-blue-600" /><span className="text-xs text-slate-500">{item.progress}%</span></span></button><div className="flex shrink-0 justify-end gap-1"><button type="button" onClick={() => openEditProject(item)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Pencil className="size-3.5" />编辑</button><button type="button" onClick={() => deleteProject(item)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"><Trash2 className="size-3.5" />删除</button></div></div>)}
      </div>}
    </section>

  </PageShell>;
}

function QuestionTree() {
  const branches = [
    { title: "项目背景", children: ["为什么需要这个系统？", "检测节拍和精度是多少？"] },
    { title: "方案选择", children: ["为什么选择深度 OCR？", "为什么不用模板匹配？"] },
    { title: "算法原理", children: ["数据增强如何设计？", "误检和漏检如何平衡？"] },
    { title: "现场落地", children: ["PLC 如何握手？", "剔除延迟如何解决？"] },
  ];
  return <PageShell title="问题树" subtitle="沿着面试官的追问路径，找到你开始回答模糊的位置。">
    <div className="panel p-5"><div className="flex items-center gap-3 border-b border-slate-200 pb-5"><span className="grid size-10 place-items-center rounded-lg bg-blue-600 text-white"><FileText className="size-5" /></span><div><h2 className="font-semibold text-slate-900">轮胎字符深度 OCR</h2><p className="text-xs text-slate-500">4 个方向 · 8 个连续追问</p></div></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{branches.map((branch, i) => <section key={branch.title} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded bg-slate-800 text-xs font-semibold text-white">{i + 1}</span><h3 className="font-medium text-slate-900">{branch.title}</h3></div>
        <div className="ml-3 mt-4 space-y-2 border-l border-slate-300 pl-5">{branch.children.map((child, j) => <div key={child} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><span>{child}</span>{j === 0 ? <CircleCheck className="size-4 text-emerald-500" /> : <CircleAlert className="size-4 text-amber-500" />}</div>)}</div>
      </section>)}</div>
    </div>
  </PageShell>;
}

function ReviewCenter({ records, onStart }: { records: TrainingRecord[]; onStart: () => void }) {
  const lowMasteryRecords = normalizeTrainingRecords(records).filter((record) => record.mastery === "低");
  return <PageShell title="温故知新" subtitle="所有掌握度为“低”的题目会自动汇总到这里，完成新回答后会更新掌握程度。">
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]"><div className="space-y-3">
      {lowMasteryRecords.length === 0 ? <section className="panel p-8 text-center"><CircleCheck className="mx-auto size-8 text-emerald-500" /><h2 className="mt-3 font-medium text-slate-900">暂无低掌握度题目</h2><p className="mt-1 text-sm text-slate-500">完成几道题后，系统会根据回答审阅结果自动建立薄弱习题集。</p></section> : lowMasteryRecords.map((record) => <section key={getRecordKey(record)} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"><Target className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium text-slate-900">{record.question}</h2><Badge variant="outline" className="rounded-md border-rose-200 bg-rose-50 text-rose-700">掌握度：低</Badge><Badge variant="outline" className="rounded-md border-slate-200 bg-slate-50 text-slate-600">{record.category ?? "待分类"}</Badge></div><p className="mt-1.5 text-xs leading-5 text-slate-500">改进动作：{record.reviewSuggestions?.[0] ?? "重新组织回答并补充关键知识点"} · 最近学习：{record.date}</p></div><Button variant="outline" size="sm" onClick={onStart}>开始复习</Button></section>)}
    </div>
      <aside className="panel p-5"><Sparkles className="size-6 text-blue-600" /><h2 className="mt-4 font-semibold text-slate-900">掌握程度规则</h2><p className="mt-2 text-sm leading-6 text-slate-600">跳过题目、未覆盖多个关键点或审阅发现三项以上不足，会标记为低掌握度并加入本习题集。</p><Button onClick={onStart} className="mt-5 w-full bg-blue-600 hover:bg-blue-700"><Play />开始学习</Button></aside>
    </div>
  </PageShell>;
}

function TrainingReport({ records }: { records: TrainingRecord[] }) {
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const reportRecords = normalizeTrainingRecords(records);
  const completedAnswers = reportRecords.length;
  const groups = Array.from(reportRecords.reduce((map, record) => {
    const topic = record.source === "项目" ? record.project : (record.category ?? record.project);
    const key = `${record.date}|${record.mode ?? "历史训练"}|${record.source ?? "历史"}|${topic}`;
    const existing = map.get(key);
    if (existing) existing.records.push(record);
    else map.set(key, { key, date: record.date, mode: record.mode ?? "历史训练", topic, source: record.source, records: [record] });
    return map;
  }, new Map<string, { key: string; date: string; mode: string; topic: string; source?: "专业" | "项目"; records: TrainingRecord[] }>()).values());
  const metrics = [
    { label: "学习记录", value: String(completedAnswers), icon: Check },
    { label: "题组归档", value: String(groups.length), icon: Archive },
    { label: "低掌握度题目", value: String(reportRecords.filter((record) => record.mastery === "低").length), icon: Target },
  ];
  return <PageShell title="学习记录" subtitle="学习记录按照日期、训练模式和项目或知识分类自动归档为题组。">
    <div className="grid gap-4 sm:grid-cols-3">{metrics.map((item) => <section key={item.label} className="panel p-5"><item.icon className="size-5 text-blue-600" /><p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p><p className="mt-1 text-sm text-slate-500">{item.label}</p></section>)}</div>
    <section className="panel mt-5 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">学习题组</h2><p className="mt-1 text-xs text-slate-500">默认折叠题组，展开后查看组内单题记录</p></div><Badge variant="outline" className="rounded-md">{groups.length} 个题组</Badge></div>
      {reportRecords.length === 0 ? (
        <div className="grid min-h-48 place-items-center p-8 text-center"><div><BookOpen className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">还没有学习记录</p><p className="mt-1 text-xs text-slate-500">完成一次回答后，这里会自动出现一条题目记录。</p></div></div>
      ) : (
        <Accordion type="multiple" className="divide-y divide-slate-100">{groups.map((group) => {
          const questionCount = new Set(group.records.map((record) => record.question)).size;
          const reviewCount = group.records.filter((record) => record.mastery === "低" || record.reviewIssues?.length).length;
          const latest = group.records[0]?.timestamp ?? group.date;
          return <AccordionItem key={group.key} value={group.key} className="border-0 px-5">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex min-w-0 flex-1 flex-col gap-3 pr-3 text-left lg:flex-row lg:items-center">
                <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${group.source === "项目" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}><Archive className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-semibold text-slate-900">{group.mode} · {group.topic}</strong>
                    <Badge variant="outline" className={`rounded-md ${group.source === "项目" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{group.source === "项目" ? "本地项目" : "专业题库"}</Badge>
                  </span>
                  <span className="mt-1.5 block text-xs font-normal text-slate-500">{latest} · {questionCount} 道题 · 每题 1 条学习记录</span>
                </span>
                <span className="flex shrink-0 items-center gap-5 text-xs font-normal text-slate-500">
                  <span>题目 <strong className="ml-1 text-base text-slate-800">{questionCount}</strong></span>
                  <span>待改进 <strong className="ml-1 text-base text-amber-600">{reviewCount}</strong></span>
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/60">
                {group.records.map((record, i) => {
                  const hasIssues = Boolean(record.mastery === "低" || record.reviewIssues?.length);
                  const recordId = record.id ?? `${group.key}-${i}`;
                  const expanded = expandedRecordId === recordId;
                  const question = questionBank.find((item) => item.title === record.question);
                  const standardAnswer = record.bestAnswer || (question ? getBestAnswer(question, record.project) : "该记录未保存标准答案，请重新回答一次以生成完整对照。");
                  const answerKeywords = record.answerKeywords?.length ? record.answerKeywords : question?.keywords ?? [];
                  const principle = record.principle || (question ? getQuestionPrinciple(question, record.project) : "");
                  return <div key={recordId} className="grid gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 lg:grid-cols-[1fr_240px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-md ${record.action === "跳过题目" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{record.action === "跳过题目" ? "跳过题目" : "完成答题"}</Badge><span className="truncate text-sm font-medium text-slate-800">{record.question}</span></div>
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
    { key: "privacy", title: "隐私与数据", description: "本地存储与密钥安全", icon: ShieldCheck },
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
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">启用的 AI 能力</h2><p className="mt-1 text-xs text-slate-500">这些开关保存为当前设备的训练偏好，不包含任何密钥。</p></div>
          <div className="divide-y divide-slate-100">
            {features.map((feature) => <label key={feature.key} className="flex cursor-pointer items-center gap-4 px-5 py-4">
              <span className="min-w-0 flex-1"><strong className="block text-sm font-medium text-slate-800">{feature.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{feature.description}</span></span>
              <Switch checked={preferences[feature.key]} onCheckedChange={(checked) => { const nextPreferences = { ...preferences, [feature.key]: checked }; setPreferences(nextPreferences); persistActivePreferences(nextPreferences); setSaved(false); }} aria-label={feature.title} />
            </label>)}
          </div>
        </section>}

        {settingsSection === "privacy" && <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">隐私与数据</h2><p className="mt-1 text-xs text-slate-500">了解网页保存什么、AI 能读取什么，以及如何控制本地数据。</p></div>
          <div className="divide-y divide-slate-100">
            <div className="flex gap-4 px-5 py-5"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600"><HardDrive className="size-4" /></span><div><h3 className="text-sm font-semibold text-slate-800">浏览器本地数据</h3><p className="mt-1 text-sm leading-6 text-slate-600">项目配置、学习记录和题组缓存保存在当前浏览器，不会自动上传到网站。</p></div></div>
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
