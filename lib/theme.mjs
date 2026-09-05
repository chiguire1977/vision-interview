export const THEME_OPTIONS = [
  { id: "ocean", label: "海洋蓝", source: "原始主题", description: "当前默认主题", swatch: "#2563eb" },
  { id: "midnight", label: "午夜深色", source: "原始主题", description: "适合低光环境", swatch: "#60a5fa" },
  { id: "graphite", label: "石墨灰", source: "原始主题", description: "沉稳的工作台风格", swatch: "#14b8a6" },
  { id: "vscode-light", label: "VS Code Light+", source: "VS Code Light+", referenceUrl: "https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/light_plus.json", description: "明亮的编辑器工作台", swatch: "#0066b8" },
  { id: "vscode-dark", label: "VS Code Dark+", source: "VS Code Dark+", referenceUrl: "https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_plus.json", description: "经典的深色编辑器工作台", swatch: "#007acc" },
  { id: "one-dark", label: "One Dark Pro", source: "One Dark Pro", referenceUrl: "https://github.com/Binaryify/OneDark-Pro/blob/master/themes/OneDark-Pro.json", description: "Atom 系的中性深色主题", swatch: "#61afef" },
  { id: "dracula", label: "Dracula", source: "Dracula", referenceUrl: "https://github.com/dracula/visual-studio-code", description: "高辨识度的深色主题", swatch: "#bd93f9" },
];

// Semantic colors are shared by the app shell and every panel. Keeping these
// pairs together prevents a theme from mixing a light surface with a light
// foreground when utility classes are reused by a component.
export const THEME_PALETTES = {
  ocean: {
    background: "#eef3f8",
    foreground: "#0f172a",
    card: "#ffffff",
    cardForeground: "#0f172a",
    popover: "#ffffff",
    popoverForeground: "#0f172a",
    primary: "#1d4ed8",
    primaryForeground: "#ffffff",
    secondary: "#e8eef6",
    secondaryForeground: "#1e293b",
    muted: "#f4f7fb",
    mutedForeground: "#475569",
    accent: "#dbeafe",
    accentForeground: "#1e3a8a",
    border: "#cbd5e1",
    input: "#cbd5e1",
    ring: "#2563eb",
    sidebar: "#102033",
    sidebarForeground: "#e2e8f0",
    sidebarPrimary: "#60a5fa",
    sidebarPrimaryForeground: "#07111f",
    sidebarAccent: "#1f3b5c",
    sidebarAccentForeground: "#f8fafc",
  },
  midnight: {
    background: "#0b1220",
    foreground: "#f8fafc",
    card: "#111c2e",
    cardForeground: "#f8fafc",
    popover: "#17243a",
    popoverForeground: "#f8fafc",
    primary: "#60a5fa",
    primaryForeground: "#08111f",
    secondary: "#1a2940",
    secondaryForeground: "#e5edf7",
    muted: "#17243a",
    mutedForeground: "#c3d0df",
    accent: "#1e3a5f",
    accentForeground: "#dbeafe",
    border: "#3a4d68",
    input: "#3a4d68",
    ring: "#93c5fd",
    sidebar: "#07111f",
    sidebarForeground: "#e8f0fa",
    sidebarPrimary: "#60a5fa",
    sidebarPrimaryForeground: "#08111f",
    sidebarAccent: "#1a3150",
    sidebarAccentForeground: "#f8fafc",
  },
  graphite: {
    background: "#1f2429",
    foreground: "#f8fafc",
    card: "#2a3138",
    cardForeground: "#f8fafc",
    popover: "#343c45",
    popoverForeground: "#f8fafc",
    primary: "#2dd4bf",
    primaryForeground: "#06201e",
    secondary: "#343c45",
    secondaryForeground: "#f1f5f9",
    muted: "#343c45",
    mutedForeground: "#d0d7de",
    accent: "#164e63",
    accentForeground: "#ccfbf1",
    border: "#596775",
    input: "#596775",
    ring: "#5eead4",
    sidebar: "#171c21",
    sidebarForeground: "#edf2f7",
    sidebarPrimary: "#2dd4bf",
    sidebarPrimaryForeground: "#06201e",
    sidebarAccent: "#303b46",
    sidebarAccentForeground: "#f8fafc",
  },
  "vscode-light": {
    background: "#f3f3f3",
    foreground: "#1f1f1f",
    card: "#ffffff",
    cardForeground: "#1f1f1f",
    popover: "#ffffff",
    popoverForeground: "#1f1f1f",
    primary: "#0066b8",
    primaryForeground: "#ffffff",
    secondary: "#e7e7e7",
    secondaryForeground: "#333333",
    muted: "#f3f3f3",
    mutedForeground: "#616161",
    accent: "#e5f1fb",
    accentForeground: "#004578",
    border: "#c8c8c8",
    input: "#c8c8c8",
    ring: "#0066b8",
    sidebar: "#333333",
    sidebarForeground: "#f3f3f3",
    sidebarPrimary: "#75beff",
    sidebarPrimaryForeground: "#1f1f1f",
    sidebarAccent: "#3e3e42",
    sidebarAccentForeground: "#ffffff",
  },
  "vscode-dark": {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    card: "#252526",
    cardForeground: "#d4d4d4",
    popover: "#2d2d30",
    popoverForeground: "#d4d4d4",
    primary: "#007acc",
    primaryForeground: "#ffffff",
    secondary: "#2d2d30",
    secondaryForeground: "#d4d4d4",
    muted: "#2d2d30",
    mutedForeground: "#b8b8b8",
    accent: "#264f78",
    accentForeground: "#ffffff",
    border: "#3e3e42",
    input: "#3e3e42",
    ring: "#3794ff",
    sidebar: "#252526",
    sidebarForeground: "#d4d4d4",
    sidebarPrimary: "#3794ff",
    sidebarPrimaryForeground: "#1e1e1e",
    sidebarAccent: "#37373d",
    sidebarAccentForeground: "#ffffff",
  },
  "one-dark": {
    background: "#282c34",
    foreground: "#abb2bf",
    card: "#21252b",
    cardForeground: "#abb2bf",
    popover: "#2c323c",
    popoverForeground: "#abb2bf",
    primary: "#61afef",
    primaryForeground: "#1e2127",
    secondary: "#2c323c",
    secondaryForeground: "#abb2bf",
    muted: "#2c323c",
    mutedForeground: "#c4c8d0",
    accent: "#3e4451",
    accentForeground: "#f0f0f0",
    border: "#3e4451",
    input: "#3e4451",
    ring: "#61afef",
    sidebar: "#21252b",
    sidebarForeground: "#abb2bf",
    sidebarPrimary: "#61afef",
    sidebarPrimaryForeground: "#1e2127",
    sidebarAccent: "#2c323c",
    sidebarAccentForeground: "#f0f0f0",
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    card: "#21222c",
    cardForeground: "#f8f8f2",
    popover: "#343746",
    popoverForeground: "#f8f8f2",
    primary: "#bd93f9",
    primaryForeground: "#282a36",
    secondary: "#343746",
    secondaryForeground: "#f8f8f2",
    muted: "#343746",
    mutedForeground: "#c7c9d1",
    accent: "#44475a",
    accentForeground: "#f8f8f2",
    border: "#44475a",
    input: "#44475a",
    ring: "#bd93f9",
    sidebar: "#21222c",
    sidebarForeground: "#f8f8f2",
    sidebarPrimary: "#bd93f9",
    sidebarPrimaryForeground: "#282a36",
    sidebarAccent: "#44475a",
    sidebarAccentForeground: "#f8f8f2",
  },
};

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_PAIRS = [
  ["foreground", "background"],
  ["cardForeground", "card"],
  ["popoverForeground", "popover"],
  ["mutedForeground", "card"],
  ["accentForeground", "accent"],
  ["primaryForeground", "primary"],
  ["sidebarForeground", "sidebar"],
  ["sidebarAccentForeground", "sidebarAccent"],
];

export function getThemeContrastFailures(themeId) {
  const palette = THEME_PALETTES[normalizeThemeId(themeId)];
  return CONTRAST_PAIRS
    .map(([foreground, background]) => ({ foreground, background, ratio: contrastRatio(palette[foreground], palette[background]) }))
    .filter((pair) => pair.ratio < 4.5)
    .map((pair) => `${pair.foreground}/${pair.background}:${pair.ratio.toFixed(2)}`);
}

export function normalizeThemeId(value) {
  return THEME_OPTIONS.some((theme) => theme.id === value) ? value : "ocean";
}

export function themeOptionById(value) {
  return THEME_OPTIONS.find((theme) => theme.id === normalizeThemeId(value));
}
