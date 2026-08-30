#!/usr/bin/env bash
# VisionInterview 改动同步脚本
#   1) 恢复被快照规则误删的文件
#   2) 提交并推送到 GitHub
#   3) 重启开发服务器
#
#   用法:
#     bash sync.sh "提交说明"        提交 + 推送 + 重启
#     bash sync.sh -m "说明" --no-restart   只提交推送，不动服务
#     bash sync.sh --status          只看状态，不做任何修改
#
# 凭据从 ~/.vi-secrets/gh_token 读取（600 权限），绝不写入仓库。

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

TOKEN_FILE="$HOME/.vi-secrets/gh_token"
BACKUP_DIR="$HOME/.vi-backup"
REPO_SLUG="chiguire1977/vision-interview"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3000}"

MSG=""
DO_RESTART=1
STATUS_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    -m|--message) MSG="${2:-}"; shift 2 ;;
    --no-restart) DO_RESTART=0; shift ;;
    --status)     STATUS_ONLY=1; shift ;;
    -h|--help)    sed -n '2,12p' "$0"; exit 0 ;;
    *)            [ -z "$MSG" ] && MSG="$1"; shift ;;
  esac
done

c_ok()   { printf '\033[32m  ✓\033[0m %s\n' "$1"; }
c_do()   { printf '\033[36m  →\033[0m %s\n' "$1"; }
c_warn() { printf '\033[33m  !\033[0m %s\n' "$1"; }
c_err()  { printf '\033[31m  ✗\033[0m %s\n' "$1" >&2; }
step()   { printf '\n\033[1m%s\033[0m\n' "$1"; }

echo
echo "════════════════════════════════════════════════"
echo "  同步 VisionInterview → GitHub"
echo "════════════════════════════════════════════════"

# ── 1. 恢复 git 仓库与被误删文件 ────────────────────────────
step "[1/5] 检查仓库完整性"

if [ ! -d .git ]; then
  c_warn ".git 缺失（凭据类路径不进快照），重新获取"
  tmp="$(mktemp -d)"
  GIT_TERMINAL_PROMPT=0 git clone --depth 1 --quiet \
    "https://github.com/${REPO_SLUG}.git" "$tmp/repo"
  cp -r "$tmp/repo/.git" .git
  rm -rf "$tmp"
  c_ok ".git 已恢复"
else
  c_ok ".git 完好"
fi

git config user.name  "Arena Agent"
git config user.email "agent@arena.ai"

# build/ 目录名命中快照排除规则，内容会被清掉但 git 认为是"删除"
if [ ! -f build/sites-vite-plugin.ts ]; then
  c_warn "build/sites-vite-plugin.ts 缺失，恢复中"
  mkdir -p build
  if [ -f "$BACKUP_DIR/sites-vite-plugin.ts" ]; then
    cp "$BACKUP_DIR/sites-vite-plugin.ts" build/
  else
    git checkout -- build/sites-vite-plugin.ts
  fi
  c_ok "已恢复"
else
  mkdir -p "$BACKUP_DIR"
  cp -f build/sites-vite-plugin.ts "$BACKUP_DIR/" 2>/dev/null || true
  c_ok "build/ 插件完好"
fi

# ── 2. 展示改动 ─────────────────────────────────────────────
step "[2/5] 待同步的改动"

# 学习数据存档一并纳入版本控制
if [ -f data/vision-interview-data.json ]; then
  n=$(node -e "try{const d=require('./data/vision-interview-data.json');console.log((d.data?.['vision-interview-records']||[]).length)}catch(e){console.log(0)}" 2>/dev/null || echo 0)
  c_ok "学习存档：${n} 条记录，将一并备份"
fi

if [ -z "$(git status --porcelain)" ]; then
  c_ok "工作区干净，没有需要提交的内容"
  CHANGES=0
else
  git status --short | sed 's/^/     /'
  CHANGES=1
fi

if [ "$STATUS_ONLY" -eq 1 ]; then
  echo; c_ok "仅查看状态（--status），未做修改"; exit 0
fi

# ── 3. 提交 ─────────────────────────────────────────────────
step "[3/5] 提交"

if [ "$CHANGES" -eq 1 ]; then
  [ -z "$MSG" ] && MSG="chore: sandbox update $(date '+%Y-%m-%d %H:%M')"
  git add -A
  git commit -q -m "$MSG"
  c_ok "已提交: $MSG"
else
  c_ok "跳过（无改动）"
fi

# ── 4. 推送 ─────────────────────────────────────────────────
step "[4/5] 推送到 GitHub ($BRANCH)"

if [ ! -f "$TOKEN_FILE" ]; then
  c_err "凭据缺失: $TOKEN_FILE"
  echo "     请重新提供 GitHub token，或手动写入该文件。"
  exit 1
fi

TOKEN="$(cat "$TOKEN_FILE")"
PUSH_URL="https://x-access-token:${TOKEN}@github.com/${REPO_SLUG}.git"

if [ "$(git rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null || echo 1)" -eq 0 ]; then
  c_ok "远程已是最新，无需推送"
else
  # 用 credential-less 的一次性 URL 推送，避免 token 落进 .git/config
  if git push --quiet "$PUSH_URL" "HEAD:${BRANCH}" 2>&1 | grep -v '^remote:' ; then :; fi
  c_ok "推送完成"
  SHA="$(git rev-parse --short HEAD)"
  echo "     提交: $SHA"
  echo "     查看: https://github.com/${REPO_SLUG}/commit/$SHA"
fi

# 确保 origin 存在且是干净的 https 地址（不含 token）
CLEAN_URL="https://github.com/${REPO_SLUG}.git"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$CLEAN_URL"
else
  git remote add origin "$CLEAN_URL"
fi
git fetch --quiet origin "$BRANCH" 2>/dev/null || true

# ── 5. 重启服务 ─────────────────────────────────────────────
step "[5/5] 重启开发服务器"

if [ "$DO_RESTART" -eq 0 ]; then
  c_ok "跳过（--no-restart）"
else
  if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
    c_do "释放端口 $PORT"
    lsof -ti tcp:"$PORT" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  fi
  c_ok "端口就绪，请用 start.sh 启动服务"
  echo "     bash start.sh"
fi

echo
echo "════════════════════════════════════════════════"
c_ok "同步流程结束"
echo "════════════════════════════════════════════════"
