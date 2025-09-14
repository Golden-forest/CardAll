# 统一冲突解决引擎测试文档 (W3-T003)

## 概述

统一冲突解决引擎测试套件提供了comprehensive的测试覆盖，确保冲突检测、解决和UI组件的功能正确性和性能表现。

## 测试结构

```
conflict-resolution-engine/
├── unified-conflict-resolution-engine.test.ts  # 核心引擎测试
├── ui-components.test.tsx                      # UI组件测试
├── integration.test.ts                         # 集成测试
├── performance.test.ts                         # 性能测试
├── vitest.config.ts                            # Vitest配置
├── test-setup.ts                               # 测试设置
└── package.json                                # 包配置
```

## 测试分类

### 1. 核心引擎测试 (unified-conflict-resolution-engine.test.ts)

**测试内容：**
- ConflictDetector 类的所有功能
- ConflictResolver 类的所有功能
- 数据生成器功能
- 配置和兼容性测试

**关键测试用例：**
- 版本冲突检测
- 内容冲突检测
- 删除冲突检测
- 解决建议生成
- 自动解决执行
- 策略选择算法
- 性能和可靠性测试

### 2. UI组件测试 (ui-components.test.tsx)

**测试内容：**
- ConflictManagementPanel 组件
- ConflictNotification 组件
- ConflictResolutionDialog 组件
- 交互功能测试
- 筛选和排序功能

**关键测试用例：**
- 基本渲染功能
- 用户交互测试
- 筛选和排序
- 批量操作
- 性能测试

### 3. 集成测试 (integration.test.ts)

**测试内容：**
- 与 UnifiedSyncService 的集成
- 事件处理集成
- 向后兼容性
- 错误处理和恢复
- 端到端测试

**关键测试用例：**
- 完整冲突处理流程
- 事件监听和处理
- 配置更新
- 错误恢复机制
- 性能监控

### 4. 性能测试 (performance.test.ts)

**测试内容：**
- 检测器性能
- 解决器性能
- 内存使用
- 并发处理
- 长时间运行稳定性

**关键测试指标：**
- 单个检测时间 < 100ms
- 批量检测平均时间 < 20ms
- 内存使用 < 50MB
- 缓存命中率 > 75%
- 并发处理能力

## 运行测试

### 基本运行

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- unified-conflict-resolution-engine.test.ts

# 运行带覆盖率的测试
npm run test:coverage
```

### 性能测试

```bash
# 运行性能测试
npm run test:performance

# 运行集成测试
npm run test:integration
```

### 开发模式

```bash
# 监听模式
npm run test:watch

# UI模式
npm run test:ui
```

## 测试数据生成

### TestDataGenerator

提供各种测试数据的生成功能：

```typescript
// 生成基础冲突
const conflict = TestDataGenerator.createMockConflict({
  conflictType: 'version',
  severity: 'high'
})

// 生成配置
const config = TestDataGenerator.createMockConfig({
  autoResolveConfidenceThreshold: 0.9
})

// 生成解决建议
const suggestion = TestDataGenerator.createMockSuggestion({
  type: 'timestamp-priority',
  confidence: 0.85
})
```

### UITestDataGenerator

专门用于UI组件测试的数据生成：

```typescript
// 生成UI测试用的冲突
const conflict = UITestDataGenerator.createMockConflict({
  suggestions: [UITestDataGenerator.createMockSuggestion()]
})
```

### IntegrationTestDataGenerator

用于集成测试的数据生成：

```typescript
// 生成集成测试配置
const config = IntegrationTestDataGenerator.createMockSyncConfig({
  conflictEngine: { enabled: true }
})

// 生成模拟冲突数据
const conflictData = IntegrationTestDataGenerator.createMockConflictData()
```

## 性能测试工具

### PerformanceTestUtils

提供性能测量和分析工具：

```typescript
// 测量执行时间
const { time } = await PerformanceTestUtils.measureExecutionTime(async () => {
  await someAsyncOperation()
})

// 测量内存使用
const { memory } = await PerformanceTestUtils.measureMemoryUsage(async () => {
  await someMemoryIntensiveOperation()
})

// 生成压力测试数据
const testData = PerformanceTestUtils.generateStressTestData(1000)

// 创建性能分析器
const profiler = PerformanceTestUtils.createPerformanceProfiler()
await profiler.measure('label', async () => {
  await someOperation()
})
const stats = profiler.getStats()
```

## 测试覆盖率

当前测试覆盖率目标：
- **总体覆盖率**: ≥ 90%
- **核心功能**: ≥ 95%
- **UI组件**: ≥ 85%
- **集成测试**: ≥ 80%
- **性能测试**: ≥ 75%

## 性能基准

### 检测器性能
- 单个版本冲突检测: < 100ms
- 单个内容冲突检测: < 50ms
- 单个删除冲突检测: < 10ms
- 批量检测平均: < 20ms/个

### 解决器性能
- 解决建议生成: < 200ms
- 自动解决执行: < 100ms
- 策略选择: < 50ms
- 批量解决平均: < 30ms/个

### 资源使用
- 内存使用: < 50MB (批量检测)
- 缓存命中率: > 75%
- 并发处理: 支持20+并发
- 长时间运行: 内存稳定

## 错误处理

测试覆盖了各种错误情况：
- 网络错误
- 存储错误
- 配置错误
- 数据格式错误
- 超时错误
- 并发冲突

## 向后兼容性

测试确保与现有系统的兼容性：
- 旧版本冲突格式支持
- 传统API兼容性
- 配置迁移
- 事件格式兼容

## 持续集成

测试套件设计用于CI/CD环境：
- 快速执行 (< 5分钟)
- 稳定的测试数据
- 隔离的测试环境
- 自动化覆盖率报告

## 调试和开发

### 启用详细日志

```typescript
// 在测试中启用控制台输出
console.log = originalConsoleLog
console.warn = originalConsoleWarn
console.error = originalConsoleError
```

### 调试特定测试

```bash
# 运行特定测试用例
npm test -- --run "should detect version conflicts"

# 运行特定文件中的测试
npm test -- unified-conflict-resolution-engine.test.ts
```

### 性能分析

```bash
# 生成性能报告
npm run test:performance

# 查看覆盖率详情
npm run test:coverage
```

## 故障排除

### 常见问题

1. **测试超时**
   - 检查测试超时设置
   - 优化异步操作
   - 减少测试数据量

2. **内存泄漏**
   - 检查清理函数
   - 监控内存使用
   - 优化数据生成

3. **并发问题**
   - 使用适当的锁机制
   - 避免共享状态
   - 模拟并发条件

4. **依赖问题**
   - 检查模拟设置
   - 验证依赖版本
   - 更新测试依赖

## 贡献指南

1. 添加新测试时遵循现有模式
2. 确保测试覆盖率
3. 添加性能基准测试
4. 更新文档
5. 运行完整测试套件

## 版本历史

- **v1.0.0**: 初始测试套件
  - 核心功能测试
  - UI组件测试
  - 集成测试
  - 性能测试

## 许可证

MIT License