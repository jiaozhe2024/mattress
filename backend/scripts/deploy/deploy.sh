#!/usr/bin/env bash
# =============================================================================
# 床垫选品小程序后端 —— 一键部署 / 更新脚本（不使用 Docker）
#
# 前提：已执行过 install.sh
#
# 用法：
#     sudo bash deploy.sh            # 首次部署或更新（会重建虚拟环境）
#     sudo bash deploy.sh --no-deps  # 只更新代码，不重装依赖（更快）
#
# 这个脚本做四件事：
#   1. 建/更新 Python 虚拟环境并安装依赖
#   2. 检查 .env 生产配置是否合规（不合规会明确告诉你改哪一项）
#   3. 注册并重启两个 systemd 服务（API + 队列 worker）
#   4. 自检：健康检查、进程状态、端口监听
# =============================================================================
set -euo pipefail

APP_USER="${APP_USER:-mattress}"
APP_DIR="${APP_DIR:-/opt/mattress-ux}"
VENV="${APP_DIR}/.venv"
PY="python3.12"
NO_DEPS=0
[ "${1:-}" = "--no-deps" ] && NO_DEPS=1

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 root 或 sudo 执行"
[ -d "${APP_DIR}/src" ] || die "${APP_DIR}/src 不存在 —— 请先把代码放到 ${APP_DIR}"
[ -f "${APP_DIR}/.env" ] || die "${APP_DIR}/.env 不存在 —— 请从 .env.example 复制后填写"

# ---- 1. 虚拟环境 + 依赖 ----
if [ "${NO_DEPS}" -eq 0 ]; then
    say "创建 / 更新 Python 虚拟环境"
    if [ ! -x "${VENV}/bin/python" ]; then
        "${PY}" -m venv "${VENV}"
        ok "虚拟环境已创建：${VENV}"
    else
        ok "虚拟环境已存在"
    fi

    say "安装 Python 依赖（首次约 2-5 分钟）"
    # 国内服务器建议保留阿里云镜像；海外服务器可去掉 -i 参数
    "${VENV}/bin/pip" install --no-cache-dir --upgrade pip -q \
        -i https://mirrors.aliyun.com/pypi/simple/ || \
        "${VENV}/bin/pip" install --no-cache-dir --upgrade pip -q
    if ! "${VENV}/bin/pip" install --no-cache-dir -q . -i https://mirrors.aliyun.com/pypi/simple/; then
        warn "镜像源安装失败，改用官方源重试"
        "${VENV}/bin/pip" install --no-cache-dir -q .
    fi
    ok "依赖安装完成"
else
    say "跳过依赖安装（--no-deps）"
fi

# ---- 2. 生产配置校验 ----
say "检查 .env 生产配置"
# 这些是后端 settings 里 _validate_production_config 的硬性要求，
# 任何一项不合规，服务启动会直接失败。这里提前检查并给出中文说明。
check_env() {
    local key="$1" want="$2" desc="$3"
    local got
    got=$(grep -E "^${key}=" "${APP_DIR}/.env" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
    if [ "${got}" != "${want}" ]; then
        printf '\033[1;31m  ✗ %s 应为 %s（当前：%s）—— %s\033[0m\n' "${key}" "${want}" "${got:-空}" "${desc}"
        return 1
    fi
    printf '  ✓ %s = %s\n' "${key}" "${want}"
}
check_nonempty() {
    local key="$1" desc="$2" minlen="${3:-1}"
    local got
    got=$(grep -E "^${key}=" "${APP_DIR}/.env" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
    if [ "${#got}" -lt "${minlen}" ]; then
        printf '\033[1;31m  ✗ %s 未设置或过短（至少 %s 字符）—— %s\033[0m\n' "${key}" "${minlen}" "${desc}"
        return 1
    fi
    printf '  ✓ %s 已设置\n' "${key}"
}

ENV_FAIL=0
check_env DEBUG "False" "生产环境必须关闭调试" || ENV_FAIL=1
check_env DB_ENGINE "mysql" "生产环境必须用 MySQL" || ENV_FAIL=1
check_env WX_CODE2SESSION_MOCK "false" "生产必须关闭微信 mock 登录" || ENV_FAIL=1
check_nonempty SECRET_KEY "后台 JWT 签名密钥，用 openssl rand -hex 32 生成" 32 || ENV_FAIL=1
check_nonempty WX_JWT_SECRET_KEY "小程序 JWT 签名密钥，用 openssl rand -hex 32 生成" 32 || ENV_FAIL=1
check_nonempty WX_APPID "微信小程序 AppID" 6 || ENV_FAIL=1
check_nonempty WX_SECRET "微信小程序 AppSecret" 10 || ENV_FAIL=1
check_nonempty DB_PASSWORD "数据库密码" 1 || ENV_FAIL=1
# 接口文档（/docs）的登录密码。后端 field_validator 强制要求，漏填会启动失败。
check_nonempty SWAGGER_UI_USERNAME "接口文档访问账号" 1 || ENV_FAIL=1
check_nonempty SWAGGER_UI_PASSWORD "接口文档访问密码（至少 8 位）" 8 || ENV_FAIL=1
# 首次建库时创建的超管口令。不强制失败（有开发默认值），但不设就是弱口令上线。
ADMIN_PW=$(grep -E "^ADMIN_INIT_PASSWORD=" "${APP_DIR}/.env" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
if [ "${#ADMIN_PW}" -lt 8 ]; then
    printf '\033[1;33m  ! ADMIN_INIT_PASSWORD 未设置或过短 —— 首次启动会建出 admin/abcd1234 弱口令账号\033[0m\n'
    printf '    建议：在 .env 里加 ADMIN_INIT_PASSWORD=<openssl rand -base64 18 的结果>\n'
else
    printf '  ✓ ADMIN_INIT_PASSWORD 已设置\n'
fi

if grep -qE "^CORS_ORIGINS=.*localhost" "${APP_DIR}/.env"; then
    printf '\033[1;31m  ✗ CORS_ORIGINS 不能包含 localhost —— 改成你的后台域名\033[0m\n'
    ENV_FAIL=1
fi

if [ "${ENV_FAIL}" -ne 0 ]; then
    printf '\n\033[1;31m.env 有 %s 类问题，服务会拒绝启动。请修改 %s/.env 后重跑本脚本。\033[0m\n' "${ENV_FAIL}" "${APP_DIR}"
    printf '生成密钥：openssl rand -hex 32\n\n'
    exit 1
fi
ok ".env 生产配置检查通过"

# ---- 3. 目录权限 ----
say "修正文件权限"
mkdir -p "${APP_DIR}/app/logs" "${APP_DIR}/uploads"
chown -R "${APP_USER}" "${APP_DIR}"
chmod 600 "${APP_DIR}/.env"
ok "权限已修正（.env 仅属主可读）"

# ---- 4. systemd 服务 ----
say "注册 systemd 服务"
# API：uvicorn 单进程；如需多核并发改成 --workers 4（注意内存）
cat > /etc/systemd/system/mattress-api.service <<UNIT
[Unit]
Description=mattress-ux API (FastAPI/uvicorn)
After=network-online.target mysql.service redis-server.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment="PYTHONPATH=${APP_DIR}/src"
Environment="PYTHONUNBUFFERED=1"
Environment="TZ=Asia/Shanghai"
ExecStart=${VENV}/bin/uvicorn src:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips='*'
Restart=always
RestartSec=5
StandardOutput=append:${APP_DIR}/app/logs/api.stdout.log
StandardError=append:${APP_DIR}/app/logs/api.stderr.log

[Install]
WantedBy=multi-user.target
UNIT

# Worker：arq 异步队列。少了它，分享计数/定时清理等后台任务不会执行，
# 但 API 表面仍正常 —— 这是最容易漏掉的部分，必须一起注册。
cat > /etc/systemd/system/mattress-worker.service <<UNIT
[Unit]
Description=mattress-ux arq worker
After=network-online.target mysql.service redis-server.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment="PYTHONPATH=${APP_DIR}/src"
Environment="PYTHONUNBUFFERED=1"
Environment="TZ=Asia/Shanghai"
ExecStart=${VENV}/bin/python -m arq tasks.worker.WorkerSettings
Restart=always
RestartSec=5
StandardOutput=append:${APP_DIR}/app/logs/worker.stdout.log
StandardError=append:${APP_DIR}/app/logs/worker.stderr.log

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
ok "服务文件已写入 /etc/systemd/system/"

say "启动 / 重启服务"
systemctl enable mattress-api mattress-worker >/dev/null 2>&1
systemctl restart mattress-api mattress-worker
sleep 6

# ---- 5. 自检 ----
say "自检"
FAIL=0
for svc in mattress-api mattress-worker; do
    if systemctl is-active --quiet "${svc}"; then
        ok "${svc} 运行中"
    else
        printf '\033[1;31m  ✗ %s 未运行\033[0m\n' "${svc}"
        journalctl -u "${svc}" -n 30 --no-pager || true
        FAIL=1
    fi
done

if curl -fsS -m 5 http://127.0.0.1:8000/api/v1/base/health >/dev/null 2>&1; then
    ok "健康检查通过 http://127.0.0.1:8000/api/v1/base/health"
else
    printf '\033[1;31m  ✗ 健康检查失败，看日志：journalctl -u mattress-api -n 50 --no-pager\033[0m\n'
    FAIL=1
fi

if [ "${FAIL}" -ne 0 ]; then
    printf '\n\033[1;31m部署未完全成功，请按上面提示排查。\033[0m\n\n'
    exit 1
fi

printf '\n\033[1;32m部署成功。\033[0m\n'
cat <<TIP

  目录：${APP_DIR}
  日志：${APP_DIR}/app/logs/    （或 journalctl -u mattress-api -f）
  服务：systemctl status mattress-api mattress-worker

  下一步：配置 Nginx 反向代理（照 nginx.conf.example 改域名），
  然后在微信小程序后台配置该域名的 HTTPS。

TIP
