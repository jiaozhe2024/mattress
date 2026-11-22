# 使用官方 Python 3.12 slim 镜像作为基础镜像
FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    TZ=Asia/Shanghai

# 安装系统依赖（asyncmy 有预编译 wheel，无需 libpq-dev；gcc/g++ 兜底个别源码包）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装 Python 依赖
COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir --upgrade pip -i https://mirrors.aliyun.com/pypi/simple/ && \
    pip install --no-cache-dir . -i https://mirrors.aliyun.com/pypi/simple/

# 复制项目文件
COPY . .

# 复制并设置启动脚本权限
COPY scripts/docker-entrypoint.sh /scripts/docker-entrypoint.sh
RUN chmod +x /scripts/docker-entrypoint.sh

# 创建必要的目录并切换到非 root 用户运行
RUN groupadd -r app && \
    useradd -r -g app -d /app -s /sbin/nologin app && \
    mkdir -p /app/logs /app/static /app/migrations /app/uploads && \
    chown -R app:app /app /scripts

USER app

# 暴露端口
EXPOSE 8000

# 健康检查：使用业务端点（/docs 受 Basic Auth 保护，会导致误判 401）
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/v1/base/health || exit 1

# 启动命令
CMD ["/scripts/docker-entrypoint.sh"]
