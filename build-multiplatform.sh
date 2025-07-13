#!/bin/bash

set -e

# 配置
REGISTRY="ghcr.io"
GITHUB_USERNAME="eritang"
IMAGE_NAME="autofilm"
VERSION="v1.3.3-2-bdmv"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装"
    exit 1
fi

# 检查 Docker Buildx
if ! docker buildx version &> /dev/null; then
    print_error "Docker Buildx 未安装或不可用"
    print_info "请升级到 Docker 19.03+ 或安装 buildx 插件"
    exit 1
fi

# 检查登录状态
print_info "检查 GitHub Container Registry 登录状态..."
if ! docker info | grep -q "ghcr.io"; then
    print_warning "未登录 GHCR，请先登录"
    echo "使用以下命令登录："
    echo "echo \$GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin"
    echo "或者："
    echo "docker login ghcr.io"
    exit 1
fi

# 创建构建器
print_info "创建多平台构建器..."
docker buildx create --name multiplatform --use --bootstrap 2>/dev/null || {
    print_info "构建器已存在，使用现有构建器"
    docker buildx use multiplatform
}

# 显示构建器信息
print_info "构建器信息："
docker buildx inspect

# 构建并推送
print_info "开始构建多平台镜像..."
print_info "支持平台: linux/amd64, linux/arm64, linux/arm/v7"
print_info "推送到: ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}"

docker buildx build \
    --platform linux/amd64,linux/arm64,linux/arm/v7 \
    --tag ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:latest \
    --tag ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:${VERSION} \
    --tag ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:bdmv-enhanced \
    --push \
    .

print_success "多平台镜像构建完成！"
print_info "镜像标签："
echo "  - ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:latest"
echo "  - ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo "  - ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:bdmv-enhanced"

# 验证镜像
print_info "验证镜像..."
docker buildx imagetools inspect ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:latest

print_success "构建完成！您可以使用以下命令拉取镜像："
echo "docker pull ${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:latest"

