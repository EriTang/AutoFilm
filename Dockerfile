# 前端构建阶段
FROM node:20-alpine AS frontend-builder

# 设置工作目录
WORKDIR /app/webui

# 复制前端项目文件
COPY webui/package*.json ./
COPY webui/tsconfig.json ./
COPY webui/vite.config.ts ./
COPY webui/index.html ./

# 安装前端依赖
RUN npm ci --only=production

# 复制前端源代码
COPY webui/src ./src
COPY webui/public ./public

# 构建前端
RUN npm run build

# Python 构建阶段
FROM python:3.12.7-alpine AS python-builder
WORKDIR /builder

RUN apk update && \
    apk add --no-cache \
    build-base \
    linux-headers

# 安装构建依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir cython setuptools

COPY setup.py setup.py
COPY app ./app

RUN python setup.py

RUN apk del build-base linux-headers && \
    find app -type f \( -name "*.py" ! -name "main.py" ! -name "__init__.py" -o -name "*.c" \) -delete 

# 最终运行阶段
FROM python:3.12.7-alpine

ENV TZ=Asia/Shanghai
VOLUME ["/config", "/logs", "/media"]

RUN apk update && \
    apk add --no-cache \
    build-base \
    linux-headers \
    curl

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && \
    rm requirements.txt 

# 复制 Python 应用
COPY --from=python-builder /builder/app /app

# 复制前端构建产物
COPY --from=frontend-builder /app/webui/dist /app/web/static

RUN apk del build-base linux-headers && \
    rm -rf /tmp/* 

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/system/health || exit 1

ENTRYPOINT ["python", "/app/main.py"]

