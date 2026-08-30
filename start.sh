#!/usr/bin/env bash
# VisionInterview 一键启动脚本
# 幂等设计：重复运行安全，缺什么补什么，已就绪的步骤自动跳过。
#
#   用法:
#     ./start.sh              启动开发服务器（默认端口 3000）
#     PORT=4000 ./start.sh    换端口启动
#     ./start.sh --check      只做环境自检，不启动
#     ./start.sh --reinstall  强制重装依赖后启动

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

NODE_MAJOR_REQUIRED=22
NODE_VERSION="22.20.0"
NODE_HOME="$HOME/.local/node22"
BACKUP_DIR="$HOME/.vi-backup"
REPO_URL="https://github.com/chiguire1977/vision-interview.git"
PORT="${PORT:-3000}"

CHECK_ONLY=0
FORCE_REINSTALL=0
for arg in "$@"; do
  case "$arg" in
    --check)     CHECK_ONLY=1 ;;
    --reinstall) FORCE_REINSTALL=1 ;;
    -h|--help)   sed -n '2,11p' "$0"; exit 0 ;;
  esac
done

c_ok()   { printf '\033[32m  ✓\033[0m %s\n' "$1"; }
c_do()   { printf '\033[36m  →\033[0m %s\n' "$1"; }
c_warn() { printf '\033[33m  !\033[0m %s\n' "$1"; }
c_err()  { printf '\033[31m  ✗\033[0m %s\n' "$1" >&2; }
step()   { printf '\n\033[1m[%s/%s] %s\033[0m\n' "$1" 5 "$2"; }

echo
echo "════════════════════════════════════════════════"
echo "  VisionInterview 机器视觉面试训练台"
echo "  $PROJECT_DIR"
echo "════════════════════════════════════════════════"

# ── 1. Node 版本 ────────────────────────────────────────────
# 项目 engines 要求 >=22.13.0；沙盒默认常是 Node 20，需自备一份。
step 1 "检查 Node.js (需要 >= ${NODE_MAJOR_REQUIRED})"

use_node_from() { export PATH="$1/bin:$PATH"; }

if [ -x "$NODE_HOME/bin/node" ]; then
  use_node_from "$NODE_HOME"
  c_ok "使用本地 Node $("$NODE_HOME/bin/node" -v)"
elif command -v node >/dev/null 2>&1 && \
     [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -ge "$NODE_MAJOR_REQUIRED" ]; then
  c_ok "使用系统 Node $(node -v)"
else
  current="$(command -v node >/dev/null 2>&1 && node -v || echo '未安装')"
  c_warn "当前 Node: ${current}，版本不满足要求"
  c_do "下载 Node ${NODE_VERSION} 到 ${NODE_HOME} ..."
  arch="$(uname -m)"
  case "$arch" in
    x86_64)  narch="x64" ;;
    aarch64|arm64) narch="arm64" ;;
    *) c_err "不支持的架构: $arch，请手动安装 Node >= ${NODE_MAJOR_REQUIRED}"; exit 1 ;;
  esac
  tarball="node-v${NODE_VERSION}-linux-${narch}.tar.xz"
  tmp="$(mktemp -d)"
  if ! curl -fsSL -o "$tmp/$tarball" "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"; then
    c_err "Node 下载失败，请检查网络"; exit 1
  fi
  mkdir -p "$HOME/.local"
  tar -xJf "$tmp/$tarball" -C "$HOME/.local"
  rm -rf "$NODE_HOME"
  mv "$HOME/.local/node-v${NODE_VERSION}-linux-${narch}" "$NODE_HOME"
  rm -rf "$tmp"
  use_node_from "$NODE_HOME"
  c_ok "Node $(node -v) 安装完成"
fi

# ── 2. build/ 目录 ──────────────────────────────────────────
# 坑点：Vite 插件源码放在 build/ 下，而 "build" 常被快照/清理规则排除，
# 丢失后 vite.config.ts 会因 UNRESOLVED_IMPORT 直接启动失败。
step 2 "检查 build/sites-vite-plugin.ts"

PLUGIN="build/sites-vite-plugin.ts"
if [ -f "$PLUGIN" ]; then
  c_ok "插件文件完好"
else
  c_warn "插件文件缺失（build/ 常被清理规则误删）"
  mkdir -p build
  if [ -f "$BACKUP_DIR/sites-vite-plugin.ts" ]; then
    cp "$BACKUP_DIR/sites-vite-plugin.ts" "$PLUGIN"
    c_ok "已从本地备份恢复"
  elif [ -d .git ] && git cat-file -e HEAD:"$PLUGIN" 2>/dev/null; then
    git checkout -- "$PLUGIN"
    c_ok "已从 git 恢复"
  else
    c_do "从远程仓库拉取 ..."
    tmp="$(mktemp -d)"
    if GIT_TERMINAL_PROMPT=0 git clone --depth 1 --quiet "$REPO_URL" "$tmp/repo" 2>/dev/null \
       && [ -f "$tmp/repo/$PLUGIN" ]; then
      cp "$tmp/repo/$PLUGIN" "$PLUGIN"
      [ -d .git ] || cp -r "$tmp/repo/.git" .git
      c_ok "已从远程恢复"
    else
      c_err "无法恢复 $PLUGIN（仓库不可访问？）"; rm -rf "$tmp"; exit 1
    fi
    rm -rf "$tmp"
  fi
fi

# 顺手留一份备份，供下次快速恢复
mkdir -p "$BACKUP_DIR"
cp -f "$PLUGIN" "$BACKUP_DIR/" 2>/dev/null || true

# ── 3. 依赖 ─────────────────────────────────────────────────
step 3 "检查依赖 (node_modules)"

need_install=0
if [ "$FORCE_REINSTALL" -eq 1 ]; then
  c_do "--reinstall 指定，清除 node_modules"
  rm -rf node_modules
  need_install=1
elif [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  c_warn "node_modules 缺失（依赖目录不进快照）"
  need_install=1
elif [ ! -x node_modules/.bin/vite ]; then
  c_warn "node_modules 不完整，缺少 vite"
  need_install=1
else
  c_ok "依赖已就绪 ($(ls node_modules | wc -l) 个包)"
fi

if [ "$need_install" -eq 1 ]; then
  c_do "npm ci 安装中（约 15-30 秒）..."
  if npm ci --no-audit --no-fund --loglevel=error; then
    c_ok "依赖安装完成"
  else
    c_err "npm ci 失败，回退到 npm install"
    npm install --no-audit --no-fund --loglevel=error
  fi
fi

# ── 4. 预览环境适配 ─────────────────────────────────────────
# 原始 vite.config.ts 的 allowedHosts 只放行 terminal.local，
# 在沙盒/远程预览下会被 Vite 拦截导致白屏。
step 4 "检查 vite.config.ts 预览适配"

if grep -q "allowedHosts: true" vite.config.ts; then
  c_ok "allowedHosts 已放行（远程预览可访问）"
else
  c_warn "allowedHosts 未放行，远程预览可能白屏"
  c_do "如需修复：将 vite.config.ts 中 allowedHosts 改为 true"
fi

# ── 5. 可选 AI 配置 ─────────────────────────────────────────
step 5 "检查 AI 配置（可选）"

if [ -f .env ] || [ -f .env.local ]; then
  c_ok "检测到 .env 文件"
else
  c_warn "未配置 API key —— AI 评分/最佳答案/智能追问 将降级为本地规则"
  echo "     出题、答题、计时、掌握度统计等主流程不受影响。"
  echo "     如需启用，在项目根目录创建 .env："
  echo "       DEEPSEEK_API_KEY=sk-xxx   # 或 OPENAI_API_KEY=sk-xxx"
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo
  c_ok "环境自检通过，未启动服务（--check）"
  exit 0
fi

# ── 启动 ────────────────────────────────────────────────────
# 端口占用则先清理，避免 strictPort 直接报错退出
if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  c_warn "端口 $PORT 被占用，正在释放"
  lsof -ti tcp:"$PORT" | xargs -r kill -9 2>/dev/null || true
  sleep 1
fi

BACKUP_PORT="${BACKUP_PORT:-8787}"
if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$BACKUP_PORT" >/dev/null 2>&1; then
  lsof -ti tcp:"$BACKUP_PORT" | xargs -r kill -9 2>/dev/null || true
  sleep 1
fi

# 存档服务：Workers 运行时禁止写文件，落盘交给这个旁路 Node 进程
mkdir -p data .sites-runtime
BACKUP_PORT="$BACKUP_PORT" node scripts/backup-server.mjs \
  >.sites-runtime/backup.log 2>&1 &
BACKUP_PID=$!
sleep 1
if kill -0 "$BACKUP_PID" 2>/dev/null; then
  c_ok "存档服务已启动 (pid $BACKUP_PID, 端口 $BACKUP_PORT)"
  if [ -f data/vision-interview-data.json ]; then
    n=$(node -e "try{const d=require('./data/vision-interview-data.json');console.log((d.data?.['vision-interview-records']||[]).length)}catch(e){console.log(0)}" 2>/dev/null || echo 0)
    c_ok "已有存档：${n} 条学习记录，启动后自动加载"
  else
    c_ok "尚无存档，首次使用后自动创建"
  fi
else
  c_warn "存档服务启动失败，学习记录将只存在浏览器本地"
  cat .sites-runtime/backup.log 2>/dev/null | tail -3
fi

# 主服务退出时一并收走存档服务
trap 'kill "$BACKUP_PID" 2>/dev/null || true' EXIT INT TERM

echo
echo "════════════════════════════════════════════════"
echo "  启动开发服务器 → http://localhost:${PORT}/"
echo "  按 Ctrl+C 停止"
echo "════════════════════════════════════════════════"
echo

export WRANGLER_LOG_PATH=.wrangler/wrangler.log
export BACKUP_PORT
npm run dev -- --port "$PORT"
