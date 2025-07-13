FROM python:3.12.7-alpine AS builder
WORKDIR /builder

# 安装构建依赖
RUN apk update && \
    apk add --no-cache \
    build-base \
    linux-headers \
    libffi-dev \
    openssl-dev \
    cargo \
    rust

# 升级 pip 并安装构建工具
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir cython

COPY setup.py setup.py
COPY app ./app

RUN python setup.py

# 清理构建文件，但保留编译后的文件
RUN find app -type f \( -name "*.py" ! -name "main.py" ! -name "__init__.py" -o -name "*.c" \) -delete 

FROM python:3.12.7-alpine

ENV TZ=Asia/Shanghai
VOLUME ["/config", "/logs", "/media"]

# 安装运行时依赖
RUN apk update && \
    apk add --no-cache \
    build-base \
    linux-headers \
    libffi-dev \
    openssl-dev \
    cargo \
    rust \
    && pip install --no-cache-dir --upgrade pip setuptools wheel

# 复制并安装 Python 依赖
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && \
    rm requirements.txt 

# 复制编译后的应用
COPY --from=builder /builder/app /app

# 清理构建依赖，保留运行时必需的库
RUN apk del build-base linux-headers cargo rust && \
    rm -rf /tmp/* /var/cache/apk/* /root/.cache

ENTRYPOINT ["python", "/app/main.py"]

