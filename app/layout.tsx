import type { Metadata } from "next";
import "./globals.css";
import { BackupSync } from "@/components/backup-sync";

export const metadata: Metadata = {
  title: "VisionInterview 机器视觉面试训练台",
  description: "通过项目连续追问、题组回答审阅和薄弱点复习，提高机器视觉工程师面试表达能力。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <BackupSync />
      </body>
    </html>
  );
}
