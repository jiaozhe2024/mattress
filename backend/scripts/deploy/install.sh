#!/usr/bin/env bash
# =============================================================================
# 床垫选品小程序后端 —— 一键安装脚本（Ubuntu/Debian，不使用 Docker）
#
# 给不熟悉 Python 的运维同学：这个脚本只做「装环境」，不碰业务代码。
# 你可以把它当成装 php-fpm + php-mysql 扩展的等价物。
#
# 用法（root 或 sudo 执行）：
#     sudo bash install.sh
#
# 做完这一步，再执行 deploy.sh 才是真正部署应用。
# =============================================================================
set -euo pipefail

APP_USER="${APP_USER:-mattress}"
APP_DIR="${APP_DIR:-/opt/mattress-ux}"
PY_VER="3.12"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---- 0. 前置检查 ----
say "检查系统环境"
[ "$(id -u)" -eq 0 ] || die "请用 root 或 sudo 执行"
command -v apt-get >/dev/null 2>&1 || die "本脚本只支持 Ubuntu/Debian（其他系统请手工装 Python ${PY_VER}）"
ok "系统检查通过"

# ---- 1. 系统依赖 ----
say "安装系统依赖（Python ${PY_VER}、编译工具、MySQL 客户端）"
apt-get update -qq
# gcc/g++/python3-dev：asyncmy 等包若无可用的预编译 wheel，需要现场编译
apt-get install -y -qq \
    software-properties-common \
    ca-certificates curl gnupg \
    build-essential gcc g++ python3-dev \
    pkg-config libffi-dev libssl-dev \
    git rsync \
    mysql-client redis-tools \
    nginx \
    >/dev/null
ok "系统依赖安装完成"

# ---- 2. 安装 Python ${PY_VER} ----
say "安装 Python ${PY_VER}"
if command -v "python${PY_VER}" >/dev/null 2>&1; then
    ok "Python ${PY_VER} 已存在：$(python${PY_VER} --version)"
else
    # Ubuntu 22.04 默认只有 3.10，需要 deadsnakes PPA
    add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1 || warn "deadsnakes PPA 添加失败，尝试系统源"
    apt-get update -qq
    apt-get install -y -qq "python${PY_VER}" "python${PY_VER}-venv" "python${PY_VER}-dev" >/dev/null
    command -v "python${PY_VER}" >/dev/null 2>&1 || die "Python ${PY_VER} 安装失败，请手工安装后重跑"
    ok "Python ${PY_VER} 安装完成：$(python${PY_VER} --version)"
fi

# ---- 3. 创建运行用户 ----
say "创建应用用户 ${APP_USER}"
if id "${APP_USER}" >/dev/null 2>&1; then
    ok "用户 ${APP_USER} 已存在"
else
    # --system: 系统用户，无登录 shell（禁止用它登录服务器，安全）
    useradd --system --create-home --home-dir "${APP_DIR%/*}" --shell /usr/sbin/nologin "${APP_USER}" \
        || useradd --system --create-home --shell /sbin/nologin "${APP_USER}"
    ok "用户 ${APP_USER} 创建完成（不可登录）"
fi

# ---- 4. 应用目录 ----
say "准备应用目录 ${APP_DIR}"
mkdir -p "${APP_DIR}" "${APP_DIR}/app/logs" "${APP_DIR}/uploads"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" 2>/dev/null || chown -R "${APP_USER}" "${APP_DIR}"
ok "目录就绪"

# ---- 5. 数据库准备提示 ----
say "数据库 / Redis"
warn "本脚本不自动安装 MySQL 和 Redis（可能已有独立实例）。请确认："
cat <<'TIP'
    1) MySQL 8.0 已就绪，且已建库：
         CREATE DATABASE mattress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
         CREATE USER 'mattress'@'%' IDENTIFIED BY '你的密码';
         GRANT ALL PRIVILEGES ON mattress.* TO 'mattress'@'%';
         FLUSH PRIVILEGES;

    2) Redis 已就绪：redis-cli ping 应返回 PONG

    若尚未安装，可执行：
         apt-get install -y mysql-server redis-server
TIP

printf '\n\033[1;32m安装阶段完成。\033[0m\n'
printf '下一步：把代码放到 %s，然后执行 deploy.sh\n\n' "${APP_DIR}"
