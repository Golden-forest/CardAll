#!/bin/bash

# CardEverything v5.0.0 部署脚本
# 作者: Project-Manager AI Agent
# 版本: 5.0.0
# 日期: 2025-09-14

set -e

# 配置变量
VERSION="5.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-staging}
DEPLOY_TYPE=${2:-canary}
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOGS_DIR="${PROJECT_ROOT}/logs"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# 检查前置条件
check_prerequisites() {
    log "检查部署前置条件..."

    # 检查Docker
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi

    # 检查环境文件
    if [ ! -f "${PROJECT_ROOT}/.env" ]; then
        error "环境文件 .env 不存在"
        exit 1
    fi

    # 创建必要目录
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOGS_DIR"

    log "前置条件检查通过"
}

# 加载环境变量
load_environment() {
    log "加载环境变量..."

    if [ -f "${PROJECT_ROOT}/.env" ]; then
        export $(grep -v '^#' "${PROJECT_ROOT}/.env" | xargs)
    else
        warn "环境文件不存在，使用默认配置"
    fi

    # 设置默认值
    export DB_PASSWORD=${DB_PASSWORD:-"cardeverything123"}
    export JWT_SECRET=${JWT_SECRET:-"your-jwt-secret-key"}
    export GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-"admin123"}

    log "环境变量加载完成"
}

# 备份数据库
backup_database() {
    log "备份数据库..."

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${BACKUP_DIR}/cardeverything_${ENVIRONMENT}_${TIMESTAMP}.sql"

    # 检查PostgreSQL容器是否运行
    if ! docker ps | grep -q "cardeverything-postgres"; then
        warn "PostgreSQL容器未运行，跳过数据库备份"
        return 0
    fi

    # 执行备份
    docker exec cardeverything-postgres pg_dump -U cardeverything -d cardeverything > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        log "数据库备份成功: $BACKUP_FILE"

        # 压缩备份文件
        gzip "$BACKUP_FILE"
        log "备份文件已压缩: ${BACKUP_FILE}.gz"

        # 清理旧备份（保留最近7天）
        find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
        log "已清理7天前的备份文件"
    else
        error "数据库备份失败"
        exit 1
    fi
}

# 备份应用数据
backup_application() {
    log "备份应用数据..."

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    APP_BACKUP_DIR="${BACKUP_DIR}/app_${TIMESTAMP}"

    mkdir -p "$APP_BACKUP_DIR"

    # 备份上传文件
    if [ -d "${PROJECT_ROOT}/uploads" ]; then
        cp -r "${PROJECT_ROOT}/uploads" "$APP_BACKUP_DIR/"
    fi

    # 备份日志文件
    if [ -d "${PROJECT_ROOT}/logs" ]; then
        cp -r "${PROJECT_ROOT}/logs" "$APP_BACKUP_DIR/"
    fi

    # 备份配置文件
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        cp "${PROJECT_ROOT}/.env" "$APP_BACKUP_DIR/"
    fi

    # 创建压缩包
    tar -czf "${BACKUP_DIR}/app_backup_${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "app_${TIMESTAMP}"

    # 清理临时目录
    rm -rf "$APP_BACKUP_DIR"

    log "应用数据备份成功"
}

# 停止服务
stop_services() {
    log "停止现有服务..."

    cd "$PROJECT_ROOT"

    # 停止所有服务
    docker-compose down --remove-orphans

    # 等待容器完全停止
    sleep 10

    log "服务已停止"
}

# 清理旧容器和镜像
cleanup_old_resources() {
    log "清理旧容器和镜像..."

    # 停止并删除旧容器
    docker ps -a | grep "cardeverything" | awk '{print $1}' | xargs -r docker rm -f

    # 删除未使用的镜像（保留最近3个版本）
    docker images | grep "cardeverything" | awk '{print $1":"$2}' | tail -n +4 | xargs -r docker rmi -f

    # 清理未使用的Docker资源
    docker system prune -f

    log "清理完成"
}

# 拉取最新镜像
pull_images() {
    log "拉取最新镜像..."

    cd "$PROJECT_ROOT"

    # 拉取所有服务镜像
    docker-compose pull

    log "镜像拉取完成"
}

# 启动数据库服务
start_database() {
    log "启动数据库服务..."

    cd "$PROJECT_ROOT"

    # 启动数据库
    docker-compose up -d postgres redis

    # 等待数据库启动
    log "等待数据库启动..."
    sleep 30

    # 验证数据库连接
    if docker exec cardeverything-postgres pg_isready -U cardeverything -d cardeverything; then
        log "数据库连接成功"
    else
        error "数据库连接失败"
        exit 1
    fi

    # 验证Redis连接
    if docker exec cardeverything-redis redis-cli ping | grep -q "PONG"; then
        log "Redis连接成功"
    else
        error "Redis连接失败"
        exit 1
    fi
}

# 执行数据库迁移
run_migrations() {
    log "执行数据库迁移..."

    cd "$PROJECT_ROOT"

    # 运行迁移脚本
    if [ -f "${PROJECT_ROOT}/scripts/migrate.sh" ]; then
        bash "${PROJECT_ROOT}/scripts/migrate.sh"
    else
        warn "迁移脚本不存在，跳过迁移"
    fi

    log "数据库迁移完成"
}

# 启动应用服务
start_application() {
    log "启动应用服务..."

    cd "$PROJECT_ROOT"

    # 启动应用服务
    docker-compose up -d app nginx

    # 等待应用启动
    log "等待应用启动..."
    sleep 30

    log "应用服务启动完成"
}

# 启动监控服务
start_monitoring() {
    log "启动监控服务..."

    cd "$PROJECT_ROOT"

    # 启动监控服务
    docker-compose up -d prometheus grafana postgres-exporter redis-exporter

    # 等待监控服务启动
    sleep 20

    log "监控服务启动完成"
}

# 健康检查
health_check() {
    log "执行健康检查..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        info "健康检查第 $attempt 次尝试..."

        # 检查应用健康状态
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log "应用健康检查通过"
        else
            warn "应用健康检查失败"
        fi

        # 检查数据库连接
        if docker exec cardeverything-postgres pg_isready -U cardeverything -d cardeverything > /dev/null 2>&1; then
            log "数据库健康检查通过"
        else
            warn "数据库健康检查失败"
        fi

        # 检查Redis连接
        if docker exec cardeverything-redis redis-cli ping > /dev/null 2>&1; then
            log "Redis健康检查通过"
        else
            warn "Redis健康检查失败"
        fi

        # 如果所有检查都通过，退出循环
        if curl -f http://localhost:3000/health > /dev/null 2>&1 && \
           docker exec cardeverything-postgres pg_isready -U cardeverything -d cardeverything > /dev/null 2>&1 && \
           docker exec cardeverything-redis redis-cli ping > /dev/null 2>&1; then
            log "所有服务健康检查通过"
            return 0
        fi

        info "等待服务启动... (${attempt}/${max_attempts})"
        sleep 10
        ((attempt++))
    done

    error "健康检查失败，请检查服务状态"
    return 1
}

# 验证部署
verify_deployment() {
    log "验证部署..."

    cd "$PROJECT_ROOT"

    # 检查服务状态
    info "检查服务状态..."
    docker-compose ps

    # 检查容器日志
    info "检查应用日志..."
    docker-compose logs --tail=50 app

    # 运行基础测试
    info "运行基础测试..."
    if [ -f "${PROJECT_ROOT}/scripts/test-deployment.sh" ]; then
        bash "${PROJECT_ROOT}/scripts/test-deployment.sh"
    else
        warn "测试脚本不存在，跳过部署测试"
    fi

    log "部署验证完成"
}

# 生成部署报告
generate_deployment_report() {
    log "生成部署报告..."

    local report_file="${LOGS_DIR}/deployment_report_$(date +%Y%m%d_%H%M%S).log"

    cat > "$report_file" << EOF
CardEverything v${VERSION} 部署报告
===================================

部署时间: $(date)
部署环境: ${ENVIRONMENT}
部署类型: ${DEPLOY_TYPE}
部署版本: ${VERSION}

服务状态:
--------
$(docker-compose ps)

系统信息:
--------
$(docker system info)

磁盘使用:
--------
$(df -h)

内存使用:
--------
$(free -h)

网络连接:
--------
$(netstat -tuln | grep -E ':3000|:5432|:6379')

部署日志:
--------
$(docker-compose logs --tail=100 app)
EOF

    log "部署报告已生成: $report_file"
}

# 显示部署结果
show_deployment_result() {
    log "部署结果:"

    echo -e "${GREEN}===================================${NC}"
    echo -e "${GREEN}CardEverything v${VERSION} 部署完成！${NC}"
    echo -e "${GREEN}===================================${NC}"
    echo -e "${BLUE}访问地址:${NC}"
    echo -e "  应用地址: http://localhost:3000"
    echo -e "  监控面板: http://localhost:3001 (admin/admin123)"
    echo -e "  Prometheus: http://localhost:9090"
    echo -e "${BLUE}服务状态:${NC}"
    docker-compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
    echo -e "${YELLOW}如有问题，请查看日志: docker-compose logs [service]${NC}"
    echo -e "${GREEN}===================================${NC}"
}

# 错误处理
handle_error() {
    error "部署过程中发生错误"
    error "请检查错误日志: docker-compose logs [service]"

    # 记录错误信息
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] 部署失败" >> "${LOGS_DIR}/deployment_errors.log"

    exit 1
}

# 设置错误处理
trap handle_error ERR

# 主函数
main() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "    CardEverything v${VERSION} 部署脚本"
    echo "=========================================="
    echo "部署环境: ${ENVIRONMENT}"
    echo "部署类型: ${DEPLOY_TYPE}"
    echo "=========================================="
    echo -e "${NC}"

    # 执行部署步骤
    check_prerequisites
    load_environment
    backup_database
    backup_application
    stop_services
    cleanup_old_resources
    pull_images
    start_database
    run_migrations
    start_application
    start_monitoring
    health_check
    verify_deployment
    generate_deployment_report
    show_deployment_result

    log "部署成功完成！"
}

# 检查是否直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi