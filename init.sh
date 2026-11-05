#!/bin/bash
# mattress-ux 环境冒烟检查（<30s，发现环境问题即失败退出）
set -e
cd "$(dirname "$0")"

echo "[1/5] 基础工具检查"
command -v git >/dev/null || { echo "FAIL: git 未安装"; exit 1; }
command -v node >/dev/null && echo "  node $(node --version)" || { echo "FAIL: node 未安装"; exit 1; }
command -v python3 >/dev/null && echo "  python3 $(python3 --version 2>&1)" || { echo "FAIL: python3 未安装"; exit 1; }
command -v docker >/dev/null && docker info >/dev/null 2>&1 && echo "  docker ok" || echo "  WARN: docker 不可用（后端任务需要，仅小程序任务可忽略）"

echo "[2/5] 微信开发者工具"
WECHAT_CLI=/Applications/wechatwebdevtools.app/Contents/MacOS/cli
if [ -x "$WECHAT_CLI" ]; then
  echo "  DevTools 已安装"
  LOGIN_STATE=$("$WECHAT_CLI" islogin 2>/dev/null | grep -o '"login":[a-z]*' || true)
  echo "  登录态: ${LOGIN_STATE:-未知}"
  echo "$LOGIN_STATE" | grep -q '"login":true' || echo "  WARN: DevTools 未登录 —— automator 验收前需人工扫码一次并开启服务端口"
else
  echo "  WARN: 微信开发者工具未安装（MP 任务无法验收）"
fi

echo "[3/5] 后端基座"
if [ -f backend/docker-compose.yml ] || [ -f backend/compose.yaml ]; then
  if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    cd backend 2>/dev/null && docker compose ps 2>/dev/null | head -5; cd ..
  fi
else
  echo "  WARN: backend/ 尚未初始化（先执行任务 NG-01）"
fi

echo "[4/5] 小程序"
[ -f miniprogram/app.json ] && echo "  miniprogram/app.json 存在" || echo "  WARN: miniprogram/ 尚未初始化（先执行任务 MP-01）"

echo "[5/5] tasks.json 格式"
python3 -m json.tool tasks.json >/dev/null && echo "  JSON 合法" || { echo "FAIL: tasks.json 格式错误"; exit 1; }

echo "OK: 环境冒烟检查完成"
