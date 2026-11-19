#!/usr/bin/env bash
# =============================================================================
# 管理后台前端 —— 构建脚本（不使用 Docker）
#
# 后台是纯静态站点（Vite 构建产物），没有 Python/Node 运行时依赖，
# 部署本质就是「构建 → 把 dist 拷到 Nginx 目录」。
# 相当于 PHP 项目的「编译后上传 public/」。
#
# 用法：
#     bash build-admin.sh              # 构建（默认产物到 /var/www/mattress-admin）
#     sudo bash build-admin.sh --deploy  # 构建并直接发布到 Nginx 目录
#
# 说明：构建需要 Node.js 18+（推荐 20 LTS）。只需在构建机装一次，
#       生产服务器只需要 Nginx，不需要 Node。
# =============================================================================
set -euo pipefail

ADMIN_DIR="${ADMIN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/admin}"
WEB_ROOT="${WEB_ROOT:-/var/www/mattress-admin}"
DO_DEPLOY=0
[ "${1:-}" = "--deploy" ] && DO_DEPLOY=1

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "${ADMIN_DIR}/package.json" ] || die "找不到 ${ADMIN_DIR}/package.json"

say "检查 Node.js"
command -v node >/dev/null 2>&1 || die "未安装 Node.js。请先装 Node 20 LTS：
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs"
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
[ "${NODE_MAJOR}" -ge 18 ] || die "Node 版本过低（当前 $(node -v)），需要 18+"
ok "Node $(node -v) / npm $(npm -v)"

cd "${ADMIN_DIR}"

say "安装依赖"
if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
ok "依赖安装完成"

say "构建生产包"
# build 脚本本身是 vue-tsc --noEmit && vite build：
# 类型检查不通过会直接失败，这是有意的 —— 防止带类型错误上线
npm run build
[ -f dist/index.html ] || die "构建产物缺少 dist/index.html"
ok "构建完成，产物大小：$(du -sh dist | cut -f1)"

if [ "${DO_DEPLOY}" -eq 1 ]; then
    say "发布到 ${WEB_ROOT}"
    # 保留上一版以便回滚：备份为 .bak
    if [ -d "${WEB_ROOT}" ]; then
        rm -rf "${WEB_ROOT}.bak"
        cp -a "${WEB_ROOT}" "${WEB_ROOT}.bak"
        ok "旧版本已备份到 ${WEB_ROOT}.bak"
    fi
    mkdir -p "${WEB_ROOT}"
    # 用 rsync --delete 保证删掉旧 hash 文件，避免残留
    rsync -a --delete dist/ "${WEB_ROOT}/"
    chown -R www-data:www-data "${WEB_ROOT}" 2>/dev/null || true
    chmod -R 755 "${WEB_ROOT}"
    ok "已发布到 ${WEB_ROOT}"
    printf '\n\033[1;32m发布完成。\033[0m如未生效请：sudo systemctl reload nginx\n\n'
else
    say "构建完成（未发布）"
    printf '产物位置：%s/dist\n' "${ADMIN_DIR}"
    printf '手动发布：sudo rsync -a --delete %s/dist/ %s/\n\n' "${ADMIN_DIR}" "${WEB_ROOT}"
fi
