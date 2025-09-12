#!/bin/bash

# CardAll 测试运行脚本
# 提供便捷的测试运行方式

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 显示帮助信息
show_help() {
    echo "CardAll 测试运行脚本"
    echo ""
    echo "用法: $0 [选项] [测试类型]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -v, --verbose       详细输出"
    echo "  -w, --watch         监视模式运行测试"
    echo "  -c, --coverage      生成覆盖率报告"
    echo "  -u, --update        更新测试快照"
    echo "  -d, --debug         调试模式"
    echo ""
    echo "测试类型:"
    echo "  all                运行所有测试 (默认)"
    echo "  unit               运行单元测试"
    echo "  integration        运行集成测试"
    echo "  e2e                运行端到端测试"
    echo "  accessibility       运行可访问性测试"
    echo "  performance        运行性能测试"
    echo "  security           运行安全测试"
    echo ""
    echo "示例:"
    echo "  $0                 # 运行所有测试"
    echo "  $0 unit -c         # 运行单元测试并生成覆盖率报告"
    echo "  $0 e2e -v          # 运行端到端测试并显示详细输出"
    echo "  $0 integration -w  # 监视模式运行集成测试"
}

# 解析命令行参数
VERBOSE=false
WATCH=false
COVERAGE=false
UPDATE=false
DEBUG=false
TEST_TYPE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -w|--watch)
            WATCH=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -u|--update)
            UPDATE=true
            shift
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        unit|integration|e2e|accessibility|performance|security)
            TEST_TYPE=$1
            shift
            ;;
        all)
            TEST_TYPE="all"
            shift
            ;;
        *)
            print_message $RED "错误: 未知选项 $1"
            show_help
            exit 1
            ;;
    esac
done

# 构建测试命令
build_test_command() {
    local cmd=""
    local test_type=$1
    
    case $test_type in
        unit)
            cmd="npm run test:unit"
            ;;
        integration)
            cmd="npm run test:integration"
            ;;
        e2e)
            cmd="npm run test:e2e"
            ;;
        accessibility)
            cmd="npm run test:accessibility"
            ;;
        performance)
            cmd="npm run test:performance"
            ;;
        security)
            cmd="npm run test:security"
            ;;
        all)
            cmd="npm test"
            ;;
    esac
    
    # 添加选项
    if [ "$VERBOSE" = true ]; then
        cmd="$cmd -- --verbose"
    fi
    
    if [ "$WATCH" = true ]; then
        if [ "$test_type" = "e2e" ]; then
            cmd="npx playwright test --watch"
        else
            cmd="$cmd -- --watch"
        fi
    fi
    
    if [ "$COVERAGE" = true ]; then
        if [ "$test_type" != "e2e" ]; then
            cmd="$cmd -- --coverage"
        fi
    fi
    
    if [ "$UPDATE" = true ]; then
        if [ "$test_type" = "e2e" ]; then
            cmd="$cmd -- --update-snapshots"
        else
            cmd="$cmd -- --updateSnapshot"
        fi
    fi
    
    if [ "$DEBUG" = true ]; then
        if [ "$test_type" = "e2e" ]; then
            cmd="$cmd -- --debug"
        else
            cmd="$cmd -- --runInBand --detectOpenHandles --forceExit"
        fi
    fi
    
    echo "$cmd"
}

# 运行测试前的检查
pre_run_checks() {
    print_message $BLUE "🔍 运行测试前检查..."
    
    # 检查 Node.js 版本
    if ! command -v node &> /dev/null; then
        print_message $RED "错误: Node.js 未安装"
        exit 1
    fi
    
    local node_version=$(node --version)
    print_message $GREEN "✅ Node.js 版本: $node_version"
    
    # 检查 npm 版本
    if ! command -v npm &> /dev/null; then
        print_message $RED "错误: npm 未安装"
        exit 1
    fi
    
    local npm_version=$(npm --version)
    print_message $GREEN "✅ npm 版本: $npm_version"
    
    # 检查依赖是否安装
    if [ ! -d "node_modules" ]; then
        print_message $YELLOW "⚠️  node_modules 目录不存在，正在安装依赖..."
        npm install --legacy-peer-deps
    fi
    
    print_message $GREEN "✅ 依赖检查完成"
}

# 运行特定类型的测试
run_tests() {
    local test_type=$1
    local cmd=$(build_test_command $test_type)
    
    print_message $BLUE "🚀 运行 $test_type 测试..."
    print_message $BLUE "命令: $cmd"
    print_message $BLUE "================================"
    
    # 运行测试
    if eval $cmd; then
        print_message $GREEN "✅ $test_type 测试运行成功"
    else
        print_message $RED "❌ $test_type 测试运行失败"
        exit 1
    fi
}

# 运行所有测试
run_all_tests() {
    print_message $BLUE "🎯 运行完整测试套件..."
    
    # 运行单元测试
    print_message $YELLOW "📝 运行单元测试..."
    run_tests "unit"
    
    # 运行集成测试
    print_message $YELLOW "🔗 运行集成测试..."
    run_tests "integration"
    
    # 运行端到端测试
    print_message $YELLOW "🎭 运行端到端测试..."
    run_tests "e2e"
    
    # 运行可访问性测试
    print_message $YELLOW "♿ 运行可访问性测试..."
    run_tests "accessibility"
    
    # 运行性能测试
    print_message $YELLOW "⚡ 运行性能测试..."
    run_tests "performance"
    
    # 运行安全测试
    print_message $YELLOW "🔒 运行安全测试..."
    run_tests "security"
    
    print_message $GREEN "🎉 所有测试运行完成！"
}

# 生成测试报告
generate_reports() {
    if [ "$COVERAGE" = true ]; then
        print_message $BLUE "📊 生成测试覆盖率报告..."
        npm run test:coverage:report
    fi
    
    if [ "$TEST_TYPE" = "e2e" ]; then
        print_message $BLUE "🎭 生成端到端测试报告..."
        npx playwright show-report
    fi
}

# 主函数
main() {
    print_message $BLUE "🎪 CardAll 测试运行器"
    print_message $BLUE "======================"
    
    # 运行检查
    pre_run_checks
    
    # 根据测试类型运行测试
    case $TEST_TYPE in
        all)
            run_all_tests
            ;;
        *)
            run_tests $TEST_TYPE
            ;;
    esac
    
    # 生成报告
    generate_reports
    
    print_message $GREEN "🎊 测试完成！"
}

# 运行主函数
main "$@"