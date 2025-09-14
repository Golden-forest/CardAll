#!/bin/bash

# CardEverything v5.0.0 健康检查脚本
# 作者: Project-Manager AI Agent
# 版本: 5.0.0
# 日期: 2025-09-14

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="${PROJECT_ROOT}/logs"
HEALTH_CHECK_FILE="${LOGS_DIR}/health_check_$(date +%Y%m%d).json"

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

# 初始化健康检查结果
init_health_check() {
    mkdir -p "$LOGS_DIR"

    cat > "$HEALTH_CHECK_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "checks": {
    "application": {
      "status": "unknown",
      "response_time": 0,
      "error_rate": 0,
      "memory_usage": 0,
      "cpu_usage": 0
    },
    "database": {
      "status": "unknown",
      "connection_count": 0,
      "query_time": 0,
      "disk_usage": 0,
      "size": 0
    },
    "redis": {
      "status": "unknown",
      "memory_usage": 0,
      "connection_count": 0,
      "hit_rate": 0
    },
    "system": {
      "status": "unknown",
      "disk_usage": 0,
      "memory_usage": 0,
      "cpu_usage": 0,
      "load_average": 0
    }
  },
  "overall_status": "unknown"
}
EOF
}

# 更新健康检查结果
update_health_check() {
    local component=$1
    local status=$2
    shift 2

    # 使用jq更新JSON文件
    if command -v jq &> /dev/null; then
        jq --arg status "$status" \
           --arg component "$component" \
           '.checks[$component].status = $status' \
           "$HEALTH_CHECK_FILE" > "$HEALTH_CHECK_FILE.tmp" && mv "$HEALTH_CHECK_FILE.tmp" "$HEALTH_CHECK_FILE"
    else
        warn "jq 未安装，跳过JSON更新"
    fi
}

# 检查应用健康状态
check_application_health() {
    info "检查应用健康状态..."

    local app_healthy=true
    local response_time=0
    local error_rate=0

    # 检查应用容器状态
    if ! docker ps | grep -q "cardeverything-app.*Up"; then
        error "应用容器未运行"
        app_healthy=false
    fi

    # 检查应用健康端点
    if [ "$app_healthy" = true ]; then
        local start_time=$(date +%s%3N)
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            local end_time=$(date +%s%3N)
            response_time=$((end_time - start_time))
            info "应用响应时间: ${response_time}ms"
        else
            error "应用健康检查失败"
            app_healthy=false
        fi
    fi

    # 检查应用错误率
    if [ "$app_healthy" = true ]; then
        local container_logs=$(docker logs cardeverything-app --tail 100 2>/dev/null || echo "")
        local error_count=$(echo "$container_logs" | grep -i "error\|exception" | wc -l)
        local total_lines=$(echo "$container_logs" | wc -l)

        if [ "$total_lines" -gt 0 ]; then
            error_rate=$((error_count * 100 / total_lines))
        fi

        if [ "$error_rate" -gt 5 ]; then
            warn "应用错误率较高: ${error_rate}%"
        fi
    fi

    # 检查应用资源使用
    if [ "$app_healthy" = true ]; then
        local container_stats=$(docker stats cardeverything-app --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" 2>/dev/null | tail -n 1)
        info "应用资源使用: $container_stats"
    fi

    # 更新状态
    if [ "$app_healthy" = true ] && [ "$response_time" -lt 1000 ] && [ "$error_rate" -lt 10 ]; then
        update_health_check "application" "healthy"
        log "应用健康状态: 正常"
    else
        update_health_check "application" "unhealthy"
        error "应用健康状态: 异常"
    fi
}

# 检查数据库健康状态
check_database_health() {
    info "检查数据库健康状态..."

    local db_healthy=true

    # 检查数据库容器状态
    if ! docker ps | grep -q "cardeverything-postgres.*Up"; then
        error "数据库容器未运行"
        db_healthy=false
    fi

    # 检查数据库连接
    if [ "$db_healthy" = true ]; then
        if docker exec cardeverything-postgres pg_isready -U cardeverything -d cardeverything > /dev/null 2>&1; then
            info "数据库连接正常"
        else
            error "数据库连接失败"
            db_healthy=false
        fi
    fi

    # 检查数据库性能
    if [ "$db_healthy" = true ]; then
        local query_result=$(docker exec cardeverything-postgres psql -U cardeverything -d cardeverything -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" -t 2>/dev/null | tr -d ' ')
        info "数据库表数量: $query_result"

        # 检查数据库大小
        local db_size=$(docker exec cardeverything-postgres psql -U cardeverything -d cardeverything -c "SELECT pg_size_pretty(pg_database_size('cardeverything'));" -t 2>/dev/null | tr -d ' ')
        info "数据库大小: $db_size"

        # 检查连接数
        local connection_count=$(docker exec cardeverything-postgres psql -U cardeverything -d cardeverything -c "SELECT count(*) FROM pg_stat_activity;" -t 2>/dev/null | tr -d ' ')
        info "数据库连接数: $connection_count"
    fi

    # 更新状态
    if [ "$db_healthy" = true ]; then
        update_health_check "database" "healthy"
        log "数据库健康状态: 正常"
    else
        update_health_check "database" "unhealthy"
        error "数据库健康状态: 异常"
    fi
}

# 检查Redis健康状态
check_redis_health() {
    info "检查Redis健康状态..."

    local redis_healthy=true

    # 检查Redis容器状态
    if ! docker ps | grep -q "cardeverything-redis.*Up"; then
        error "Redis容器未运行"
        redis_healthy=false
    fi

    # 检查Redis连接
    if [ "$redis_healthy" = true ]; then
        if docker exec cardeverything-redis redis-cli ping > /dev/null 2>&1; then
            info "Redis连接正常"
        else
            error "Redis连接失败"
            redis_healthy=false
        fi
    fi

    # 检查Redis性能
    if [ "$redis_healthy" = true ]; then
        local redis_info=$(docker exec cardeverything-redis redis-cli info memory 2>/dev/null || echo "")
        local used_memory=$(echo "$redis_info" | grep "used_memory:" | cut -d: -f2 | tr -d '\r')
        local max_memory=$(echo "$redis_info" | grep "maxmemory:" | cut -d: -f2 | tr -d '\r')

        info "Redis内存使用: $used_memory"
        if [ -n "$max_memory" ] && [ "$max_memory" != "0" ]; then
            info "Redis最大内存: $max_memory"
        fi

        # 检查命中率
        local stats_info=$(docker exec cardeverything-redis redis-cli info stats 2>/dev/null || echo "")
        local keyspace_hits=$(echo "$stats_info" | grep "keyspace_hits:" | cut -d: -f2 | tr -d '\r')
        local keyspace_misses=$(echo "$stats_info" | grep "keyspace_misses:" | cut -d: -f2 | tr -d '\r')

        if [ -n "$keyspace_hits" ] && [ -n "$keyspace_misses" ]; then
            local total=$((keyspace_hits + keyspace_misses))
            if [ "$total" -gt 0 ]; then
                local hit_rate=$((keyspace_hits * 100 / total))
                info "Redis命中率: ${hit_rate}%"
            fi
        fi
    fi

    # 更新状态
    if [ "$redis_healthy" = true ]; then
        update_health_check "redis" "healthy"
        log "Redis健康状态: 正常"
    else
        update_health_check "redis" "unhealthy"
        error "Redis健康状态: 异常"
    fi
}

# 检查系统健康状态
check_system_health() {
    info "检查系统健康状态..."

    local system_healthy=true

    # 检查磁盘使用
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    info "磁盘使用率: ${disk_usage}%"

    if [ "$disk_usage" -gt 90 ]; then
        warn "磁盘使用率过高: ${disk_usage}%"
        system_healthy=false
    fi

    # 检查内存使用
    local memory_usage=$(free | awk 'NR==2{printf "%.2f", $3/$2*100}')
    info "内存使用率: ${memory_usage}%"

    if [ "$(echo "$memory_usage > 90" | bc -l)" = "1" ]; then
        warn "内存使用率过高: ${memory_usage}%"
        system_healthy=false
    fi

    # 检查CPU负载
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_percentage=$(echo "$load_avg $cpu_cores" | awk '{printf "%.2f", $1/$2*100}')
    info "CPU负载: $load_avg (使用率: ${load_percentage}%)"

    if [ "$(echo "$load_percentage > 80" | bc -l)" = "1" ]; then
        warn "CPU负载过高: ${load_percentage}%"
        system_healthy=false
    fi

    # 检查网络连接
    if netstat -tuln | grep -q ":3000 "; then
        info "端口3000监听正常"
    else
        warn "端口3000未监听"
        system_healthy=false
    fi

    if netstat -tuln | grep -q ":5432 "; then
        info "端口5432监听正常"
    else
        warn "端口5432未监听"
        system_healthy=false
    fi

    if netstat -tuln | grep -q ":6379 "; then
        info "端口6379监听正常"
    else
        warn "端口6379未监听"
        system_healthy=false
    fi

    # 更新状态
    if [ "$system_healthy" = true ]; then
        update_health_check "system" "healthy"
        log "系统健康状态: 正常"
    else
        update_health_check "system" "unhealthy"
        error "系统健康状态: 异常"
    fi
}

# 检查监控服务
check_monitoring_services() {
    info "检查监控服务..."

    local monitoring_healthy=true

    # 检查Prometheus
    if docker ps | grep -q "cardeverything-prometheus.*Up"; then
        if curl -f http://localhost:9090/api/v1/targets > /dev/null 2>&1; then
            info "Prometheus监控正常"
        else
            warn "Prometheus监控异常"
            monitoring_healthy=false
        fi
    else
        warn "Prometheus容器未运行"
        monitoring_healthy=false
    fi

    # 检查Grafana
    if docker ps | grep -q "cardeverything-grafana.*Up"; then
        if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
            info "Grafana监控正常"
        else
            warn "Grafana监控异常"
            monitoring_healthy=false
        fi
    else
        warn "Grafana容器未运行"
        monitoring_healthy=false
    fi

    # 更新状态
    if [ "$monitoring_healthy" = true ]; then
        log "监控服务状态: 正常"
    else
        warn "监控服务状态: 异常"
    fi
}

# 计算整体健康状态
calculate_overall_health() {
    info "计算整体健康状态..."

    local unhealthy_components=0
    local total_components=4

    # 检查各组件状态
    if command -v jq &> /dev/null; then
        for component in application database redis system; do
            local status=$(jq -r ".checks.$component.status" "$HEALTH_CHECK_FILE")
            if [ "$status" = "unhealthy" ]; then
                unhealthy_components=$((unhealthy_components + 1))
            fi
        done

        # 更新整体状态
        if [ "$unhealthy_components" -eq 0 ]; then
            jq '.overall_status = "healthy"' "$HEALTH_CHECK_FILE" > "$HEALTH_CHECK_FILE.tmp" && mv "$HEALTH_CHECK_FILE.tmp" "$HEALTH_CHECK_FILE"
        elif [ "$unhealthy_components" -eq 1 ]; then
            jq '.overall_status = "warning"' "$HEALTH_CHECK_FILE" > "$HEALTH_CHECK_FILE.tmp" && mv "$HEALTH_CHECK_FILE.tmp" "$HEALTH_CHECK_FILE"
        else
            jq '.overall_status = "critical"' "$HEALTH_CHECK_FILE" > "$HEALTH_CHECK_FILE.tmp" && mv "$HEALTH_CHECK_FILE.tmp" "$HEALTH_CHECK_FILE"
        fi

        local overall_status=$(jq -r '.overall_status' "$HEALTH_CHECK_FILE")
        info "整体健康状态: $overall_status ($((total_components - unhealthy_components))/$total_components 组件正常)"
    else
        warn "jq 未安装，跳过整体状态计算"
    fi
}

# 生成健康检查报告
generate_health_report() {
    local report_file="${LOGS_DIR}/health_report_$(date +%Y%m%d_%H%M%S).log"

    cat > "$report_file" << EOF
CardEverything 健康检查报告
=======================
检查时间: $(date)

检查详情:
--------
$(cat "$HEALTH_CHECK_FILE")

服务状态:
--------
$(docker ps)

系统资源:
--------
$(df -h)
$(free -h)

网络连接:
--------
$(netstat -tuln | grep -E ':3000|:5432|:6379|:9090|:3001')

EOF

    info "健康检查报告已生成: $report_file"
}

# 显示健康检查结果
show_health_check_result() {
    if command -v jq &> /dev/null; then
        local overall_status=$(jq -r '.overall_status' "$HEALTH_CHECK_FILE")

        case $overall_status in
            "healthy")
                echo -e "${GREEN}"
                echo "=========================================="
                echo "      系统健康状态: 正常 ✅"
                echo "=========================================="
                echo -e "${NC}"
                ;;
            "warning")
                echo -e "${YELLOW}"
                echo "=========================================="
                echo "      系统健康状态: 警告 ⚠️"
                echo "=========================================="
                echo -e "${NC}"
                ;;
            "critical")
                echo -e "${RED}"
                echo "=========================================="
                echo "      系统健康状态: 严重 ❌"
                echo "=========================================="
                echo -e "${NC}"
                ;;
            *)
                echo -e "${BLUE}"
                echo "=========================================="
                echo "      系统健康状态: 未知 ❓"
                echo "=========================================="
                echo -e "${NC}"
                ;;
        esac

        # 显示详细状态
        echo -e "${BLUE}组件状态:${NC}"
        for component in application database redis system; do
            local status=$(jq -r ".checks.$component.status" "$HEALTH_CHECK_FILE")
            case $status in
                "healthy") echo "  $component: ✅ 正常" ;;
                "unhealthy") echo "  $component: ❌ 异常" ;;
                *) echo "  $component: ❓ 未知" ;;
            esac
        done

        echo -e "${BLUE}==========================================${NC}"
    else
        echo -e "${BLUE}"
        echo "=========================================="
        echo "      健康检查完成"
        echo "=========================================="
        echo "请查看日志文件获取详细信息: $HEALTH_CHECK_FILE"
        echo -e "${NC}"
    fi
}

# 主函数
main() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "    CardEverything 健康检查"
    echo "=========================================="
    echo -e "${NC}"

    # 执行健康检查
    init_health_check
    check_application_health
    check_database_health
    check_redis_health
    check_system_health
    check_monitoring_services
    calculate_overall_health
    generate_health_report
    show_health_check_result
}

# 检查是否直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi