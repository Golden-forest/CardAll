#!/bin/bash

# CardEverything v5.0.0 回滚脚本
# 作者: Project-Manager AI Agent
# 版本: 5.0.0
# 日期: 2025-09-14

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOGS_DIR="${PROJECT_ROOT}/logs"
TARGET_VERSION=${1:-"4.9.0"}
ENVIRONMENT=${2:-"staging"}

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

# 确认回滚操作
confirm_rollback() {
    echo -e "${RED}"
    echo "=========================================="
    echo "         警告：即将执行回滚操作"
    echo "=========================================="
    echo "目标版本: ${TARGET_VERSION}"
    echo "环境: ${ENVIRONMENT}"
    echo "=========================================="
    echo -e "${NC}"

    read -p "确认要执行回滚操作吗？(输入 'YES' 继续): " confirm
    if [ "$confirm" != "YES" ]; then
        error "回滚操作已取消"
        exit 1
    fi

    log "开始执行回滚操作"
}

# 检查前置条件
check_prerequisites() {
    log "检查回滚前置条件..."

    # 检查Docker
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装"
        exit 1
    fi

    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose 未安装"
        exit 1
    fi

    # 检查项目目录
    if [ ! -d "$PROJECT_ROOT" ]; then
        error "项目目录不存在: $PROJECT_ROOT"
        exit 1
    fi

    # 检查备份目录
    if [ ! -d "$BACKUP_DIR" ]; then
        error "备份目录不存在: $BACKUP_DIR"
        exit 1
    fi

    log "前置条件检查通过"
}

# 记录回滚开始
log_rollback_start() {
    local log_file="${LOGS_DIR}/rollback_$(date +%Y%m%d_%H%M%S).log"

    cat > "$log_file" << EOF
CardEverything 回滚操作日志
=======================
开始时间: $(date)
目标版本: ${TARGET_VERSION}
环境: ${ENVIRONMENT}
操作用户: $(whoami)

EOF

    echo "$log_file"
}

# 检查服务状态
check_service_status() {
    log "检查当前服务状态..."

    cd "$PROJECT_ROOT"

    # 检查Docker Compose服务
    if docker-compose ps | grep -q "Up"; then
        warn "检测到运行中的服务，准备停止..."
        return 0
    else
        info "未检测到运行中的服务"
        return 1
    fi
}

# 停止所有服务
stop_all_services() {
    log "停止所有服务..."

    cd "$PROJECT_ROOT"

    # 停止所有服务
    docker-compose down --remove-orphans

    # 强制停止所有相关容器
    docker ps -a | grep "cardeverything" | awk '{print $1}' | xargs -r docker rm -f

    # 等待容器完全停止
    sleep 10

    log "所有服务已停止"
}

# 选择数据库备份
select_database_backup() {
    log "选择数据库备份..."

    local latest_backup=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -n 1)

    if [ -z "$latest_backup" ]; then
        error "未找到数据库备份文件"
        exit 1
    fi

    log "找到最新备份: $latest_backup"

    # 确认使用此备份
    read -p "是否使用此备份文件？(Y/n): " use_backup
    if [ "$use_backup" = "n" ] || [ "$use_backup" = "N" ]; then
        # 显示所有可用备份
        echo "可用备份文件:"
        ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | nl -n ln

        read -p "请选择备份文件编号: " backup_num
        latest_backup=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | sed -n "${backup_num}p")
    fi

    echo "$latest_backup"
}

# 恢复数据库
restore_database() {
    local backup_file=$1
    log "恢复数据库: $backup_file"

    cd "$PROJECT_ROOT"

    # 启动数据库服务
    docker-compose up -d postgres

    # 等待数据库启动
    log "等待数据库启动..."
    sleep 30

    # 解压备份文件
    local temp_backup="/tmp/restore_backup.sql"
    gzip -c -d "$backup_file" > "$temp_backup"

    # 恢复数据库
    docker exec -i cardeverything-postgres psql -U cardeverything -d cardeverything < "$temp_backup"

    # 清理临时文件
    rm -f "$temp_backup"

    log "数据库恢复完成"
}

# 恢复应用数据
restore_application_data() {
    log "恢复应用数据..."

    local latest_app_backup=$(ls -t "${BACKUP_DIR}"/app_backup_*.tar.gz 2>/dev/null | head -n 1)

    if [ -z "$latest_app_backup" ]; then
        warn "未找到应用数据备份，跳过应用数据恢复"
        return 0
    fi

    log "找到应用数据备份: $latest_app_backup"

    # 创建临时目录
    local temp_dir="/tmp/app_restore"
    mkdir -p "$temp_dir"

    # 解压备份
    tar -xzf "$latest_app_backup" -C "$temp_dir"

    # 恢复上传文件
    if [ -d "$temp_dir/uploads" ]; then
        cp -r "$temp_dir/uploads"/* "${PROJECT_ROOT}/uploads/" 2>/dev/null || true
    fi

    # 恢复配置文件
    if [ -f "$temp_dir/.env" ]; then
        cp "$temp_dir/.env" "${PROJECT_ROOT}/.env"
    fi

    # 清理临时目录
    rm -rf "$temp_dir"

    log "应用数据恢复完成"
}

# 切换到目标版本
switch_to_target_version() {
    log "切换到目标版本: ${TARGET_VERSION}"

    cd "$PROJECT_ROOT"

    # 检查Git仓库
    if [ ! -d ".git" ]; then
        error "不是Git仓库，无法切换版本"
        exit 1
    fi

    # 获取当前版本
    local current_version=$(git rev-parse --abbrev-ref HEAD)
    info "当前版本: $current_version"

    # 切换到目标版本
    if git checkout "$TARGET_VERSION"; then
        log "成功切换到版本: $TARGET_VERSION"
    else
        error "切换版本失败"
        exit 1
    fi

    # 恢复环境文件（如果被覆盖）
    if [ ! -f ".env" ]; then
        warn "环境文件被覆盖，从备份恢复"
        restore_application_data
    fi
}

# 更新Docker Compose配置
update_docker_compose() {
    log "更新Docker Compose配置..."

    cd "$PROJECT_ROOT"

    # 如果存在目标版本的docker-compose文件，使用它
    if [ -f "docker-compose.yml.${TARGET_VERSION}" ]; then
        cp "docker-compose.yml.${TARGET_VERSION}" "docker-compose.yml"
        log "使用版本特定的Docker Compose配置"
    fi

    # 更新镜像版本
    if [ -f "docker-compose.yml" ]; then
        sed -i.bak "s/cardeverything\/sync-service:.*/cardeverything\/sync-service:${TARGET_VERSION}/g" docker-compose.yml
        rm -f docker-compose.yml.bak
        log "已更新Docker镜像版本"
    fi
}

# 启动服务
start_services() {
    log "启动服务..."

    cd "$PROJECT_ROOT"

    # 启动数据库
    docker-compose up -d postgres redis

    # 等待数据库启动
    log "等待数据库启动..."
    sleep 30

    # 启动应用服务
    docker-compose up -d app nginx

    # 等待应用启动
    log "等待应用启动..."
    sleep 30

    # 启动监控服务
    docker-compose up -d prometheus grafana postgres-exporter redis-exporter

    log "服务启动完成"
}

# 验证回滚
verify_rollback() {
    log "验证回滚结果..."

    cd "$PROJECT_ROOT"

    # 检查服务状态
    info "检查服务状态..."
    docker-compose ps

    # 检查应用健康状态
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log "应用健康检查通过"
    else
        error "应用健康检查失败"
        return 1
    fi

    # 检查数据库连接
    if docker exec cardeverything-postgres pg_isready -U cardeverything -d cardeverything > /dev/null 2>&1; then
        log "数据库连接正常"
    else
        error "数据库连接失败"
        return 1
    fi

    # 检查Redis连接
    if docker exec cardeverything-redis redis-cli ping > /dev/null 2>&1; then
        log "Redis连接正常"
    else
        error "Redis连接失败"
        return 1
    fi

    log "回滚验证成功"
}

# 生成回滚报告
generate_rollback_report() {
    local log_file=$1
    local report_file="${LOGS_DIR}/rollback_report_$(date +%Y%m%d_%H%M%S).log"

    cat >> "$log_file" << EOF

回滚完成时间: $(date)
回滚结果: 成功

服务状态:
--------
$(docker-compose ps)

系统信息:
--------
$(docker system info)

EOF

    cat > "$report_file" << EOF
CardEverything 回滚报告
=====================
回滚时间: $(date)
目标版本: ${TARGET_VERSION}
环境: ${ENVIRONMENT}

回滚操作日志:
$(cat "$log_file")

当前服务状态:
$(docker-compose ps)

系统资源使用:
$(df -h)

$(free -h)

EOF

    log "回滚报告已生成: $report_file"
}

# 显示回滚结果
show_rollback_result() {
    echo -e "${GREEN}"
    echo "=========================================="
    echo "      CardEverything 回滚完成"
    echo "=========================================="
    echo "目标版本: ${TARGET_VERSION}"
    echo "环境: ${ENVIRONMENT}"
    echo "=========================================="
    echo -e "${NC}"

    echo -e "${BLUE}服务状态:${NC}"
    docker-compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"

    echo -e "${BLUE}访问地址:${NC}"
    echo -e "  应用地址: http://localhost:3000"
    echo -e "  监控面板: http://localhost:3001"
    echo -e "  Prometheus: http://localhost:9090"

    echo -e "${YELLOW}注意事项:${NC}"
    echo "  1. 请验证所有功能是否正常"
    echo "  2. 检查数据完整性"
    echo "  3. 监控系统性能"
    echo "  4. 如有问题，请查看日志: docker-compose logs [service]"

    echo -e "${GREEN}==========================================${NC}"
}

# 错误处理
handle_error() {
    error "回滚过程中发生错误"
    error "请检查错误日志: docker-compose logs [service]"

    # 记录错误信息
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] 回滚失败" >> "${LOGS_DIR}/rollback_errors.log"

    exit 1
}

# 设置错误处理
trap handle_error ERR

# 主函数
main() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "    CardEverything 回滚脚本"
    echo "=========================================="
    echo "目标版本: ${TARGET_VERSION}"
    echo "环境: ${ENVIRONMENT}"
    echo "=========================================="
    echo -e "${NC}"

    # 确认回滚操作
    confirm_rollback

    # 执行回滚步骤
    check_prerequisites
    local log_file=$(log_rollback_start)
    check_service_status
    stop_all_services
    local backup_file=$(select_database_backup)
    restore_database "$backup_file"
    restore_application_data
    switch_to_target_version
    update_docker_compose
    start_services
    verify_rollback
    generate_rollback_report "$log_file"
    show_rollback_result

    log "回滚操作成功完成！"
}

# 检查是否直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi