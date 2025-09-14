# 集成测试套件

本测试套件为CardAll应用提供完整的端到端集成测试，覆盖统一同步服务、数据同步、错误处理等核心功能。

## 测试范围

### 1. 核心功能集成测试 (`core-functionality-e2e.test.ts`)
- 统一同步服务初始化和配置
- 数据同步完整流程验证
- 错误处理机制测试
- 网络状态变化响应
- 实时事件处理
- 边界情况和异常处理

### 2. 网络错误处理测试 (`network-error-handling-integration.test.ts`)
- 网络状态变化处理
- 错误恢复机制
- 网络中断和恢复
- 性能优化测试
- 错误处理完整性

### 3. 数据一致性和冲突解决测试 (`data-consistency-conflict-resolution.test.ts`)
- 冲突检测和处理
- 冲突解决策略
- 数据一致性维护
- 冲突历史和统计
- 性能优化

### 4. 完整用户场景测试 (`complete-user-scenarios-e2e.test.ts`)
- 用户登录到首次同步
- 创建和编辑卡片
- 文件夹管理
- 网络状态变化处理
- 错误恢复和重试
- 多设备同步
- 性能和压力测试
- 边界情况和异常处理

## 测试工具和配置

### 测试框架
- **Vitest**: 现代化的测试框架，提供快速的测试执行
- **vi**: 强大的模拟和spy功能
- **TypeScript**: 类型安全的测试编写

### 模拟依赖
- 网络状态检测器
- 错误恢复策略
- 增量同步算法
- 智能冲突解决器
- 数据库操作

### 测试数据生成器
- 自动生成测试卡片、文件夹、标签、用户数据
- 网络状态模拟器
- 实时事件模拟器
- 性能测试工具

## 运行测试

### 运行单个测试文件
```bash
# 核心功能测试
npm test -- tests/integration/core-functionality-e2e.test.ts

# 网络错误处理测试
npm test -- tests/integration/network-error-handling-integration.test.ts

# 数据一致性测试
npm test -- tests/integration/data-consistency-conflict-resolution.test.ts

# 用户场景测试
npm test -- tests/integration/complete-user-scenarios-e2e.test.ts
```

### 运行所有集成测试
```bash
# 使用测试运行器
node tests/integration/run-integration-tests.ts

# 或者使用 Vitest
npm test -- tests/integration/
```

### 运行覆盖率测试
```bash
npm run test:coverage
```

### 运行性能测试
```bash
# 在测试运行器中包含性能测试
node tests/integration/run-integration-tests.ts --performance
```

## 测试报告

测试完成后会自动生成以下报告：

1. **JSON 报告**: `test-reports/integration-test-report.json`
2. **HTML 报告**: `test-reports/integration-test-report.html`
3. **覆盖率报告**: `coverage/`

报告包含：
- 测试统计信息
- 各个测试模块的详细结果
- 性能指标
- 覆盖率数据

## 测试配置

### 性能阈值
- 最大同步时间: 10秒
- 最大内存使用: 100MB
- 最大响应时间: 5秒

### 覆盖率要求
- 语句覆盖率: ≥80%
- 分支覆盖率: ≥75%
- 函数覆盖率: ≥80%
- 行覆盖率: ≥80%

## 测试最佳实践

### 编写新测试
1. 导入必要的测试工具和模拟
2. 使用 `beforeEach` 和 `afterEach` 进行测试清理
3. 使用测试数据生成器创建一致的测试数据
4. 验证预期的行为和错误处理
5. 包含性能测试（如果适用）

### 模拟策略
- 使用 `vi.mock()` 模拟外部依赖
- 使用 `vi.fn()` 创建函数模拟
- 使用 `vi.useFakeTimers()` 控制定时器
- 重置模拟状态以避免测试间污染

### 异步测试
- 使用 `async/await` 处理异步操作
- 使用 `vi.advanceTimersByTime()` 控制定时器
- 使用 `Promise.resolve()` 和 `Promise.reject()` 模拟异步结果

## 故障排除

### 常见问题

1. **测试超时**
   - 检查异步操作是否正确等待
   - 确认定时器被正确推进
   - 检查网络模拟是否合理

2. **模拟不工作**
   - 确认使用正确的模拟路径
   - 检查模拟是否在正确的作用域内
   - 验证模拟函数的调用参数

3. **测试间污染**
   - 使用 `beforeEach` 和 `afterEach` 清理状态
   - 重置所有模拟函数
   - 使用独立的测试数据

### 调试技巧

1. **启用详细输出**
   ```bash
   npm test -- --reporter=verbose
   ```

2. **运行单个测试**
   ```bash
   npm test -- --testNamePattern="specific test name"
   ```

3. **检查模拟调用**
   ```javascript
   console.log(vi.mocked(function).mock.calls)
   ```

## 扩展测试

### 添加新的测试模块
1. 创建新的测试文件，命名为 `*-integration.test.ts`
2. 导入必要的测试工具
3. 编写测试用例
4. 更新测试运行器以包含新测试

### 添加新的测试场景
1. 识别需要测试的用户场景
2. 创建模拟数据和状态
3. 编写端到端测试流程
4. 验证所有预期的行为

## 贡献指南

1. 遵循现有的测试结构和命名约定
2. 确保新测试有充分的覆盖
3. 包含适当的错误处理测试
4. 更新文档和README
5. 运行所有测试确保没有回归

## 性能监控

测试套件包含性能监控功能：

- 执行时间测量
- 内存使用监控
- 响应时间验证
- 性能趋势分析

性能结果会在测试报告中显示，并会标记超出阈值的测试。

## 持续集成

测试套件设计为可以在CI/CD环境中运行：

- 自动化测试执行
- 报告生成
- 性能监控
- 覆盖率检查

确保在提交代码前运行所有测试并验证通过。