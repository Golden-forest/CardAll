# 测试文档

## 概述

本目录包含了CardAll项目的完整测试套件，覆盖了从单元测试到集成测试的各个层面。

## 测试结构

```
src/__tests__/
├── setup.ts                 # 测试环境配置
├── conflict/                # 冲突系统测试
│   └── conflict-system.test.ts
├── sync/                    # 同步服务测试
│   └── sync-service.test.ts
├── components/              # UI组件测试
│   └── ui-components.test.tsx
├── integration/             # 集成测试
│   └── complete-workflow.test.tsx
└── README.md               # 本文档
```

## 测试覆盖范围

### 1. 冲突系统测试 (`conflict-system.test.ts`)

**测试内容：**
- ConflictPanel组件的渲染和交互
- useConflicts Hook的功能
- 冲突的搜索、过滤、选择功能
- 批量冲突解决
- 冲突详情查看
- 错误处理机制
- 可访问性支持

**关键测试场景：**
- ✅ 冲突面板正确显示冲突列表
- ✅ 搜索和过滤功能正常工作
- ✅ 多选和批量操作
- ✅ 冲突解决流程
- ✅ 性能监控集成
- ✅ 网络错误处理
- ✅ 键盘导航和屏幕阅读器支持

### 2. 同步服务测试 (`sync-service.test.ts`)

**测试内容：**
- UnifiedSyncService的核心功能
- 同步操作管理
- 冲突检测和解决
- 事件系统
- 性能监控集成
- 网络状态处理
- 数据验证

**关键测试场景：**
- ✅ 服务初始化和单例模式
- ✅ 同步操作的添加和执行
- ✅ 冲突检测和解决策略
- ✅ 事件监听和触发
- ✅ 性能监控集成
- ✅ 网络状态处理
- ✅ 数据验证和权限检查
- ✅ 资源清理

### 3. UI组件测试 (`ui-components.test.tsx`)

**测试内容：**
- SyncStatusDisplay组件
- SyncStatusIndicator组件
- PerformanceMonitorPanel组件
- 响应式设计
- 可访问性
- 错误处理

**关键测试场景：**
- ✅ 同步状态显示
- ✅ 性能监控面板
- ✅ 弹出框和详情显示
- ✅ 响应式布局
- ✅ 键盘导航
- ✅ 错误处理和默认状态

### 4. 集成测试 (`complete-workflow.test.tsx`)

**测试内容：**
- 完整的冲突解决工作流
- 实时同步状态监控
- 性能监控集成
- 错误处理和恢复
- 用户体验优化
- 数据一致性

**关键测试场景：**
- ✅ 从检测到解决的完整流程
- ✅ 批量冲突处理
- ✅ 实时状态更新
- ✅ 性能指标收集
- ✅ 错误处理和重试机制
- ✅ 用户体验和交互优化
- ✅ 数据状态一致性

## 测试工具和配置

### 测试框架
- **Jest**: JavaScript测试框架
- **React Testing Library**: React组件测试工具
- **User Event**: 模拟用户交互

### Mock配置
- 同步服务Mock
- 性能监控Mock
- 浏览器API Mock
- 网络请求Mock

### 测试环境
- Node.js环境
- 浏览器API模拟
- DOM环境模拟
- 定时器和异步操作模拟

## 运行测试

### 运行所有测试
```bash
npm test
```

### 运行特定测试文件
```bash
npm test -- conflict-system.test.ts
npm test -- sync-service.test.ts
npm test -- ui-components.test.tsx
npm test -- complete-workflow.test.tsx
```

### 运行测试并生成覆盖率报告
```bash
npm test -- --coverage
```

### 监听模式运行测试
```bash
npm test -- --watch
```

## 测试最佳实践

### 1. 测试命名
- 使用描述性的测试名称
- 遵循`should`或`it`的命名约定
- 清晰表达测试意图

### 2. 测试结构
- 使用`describe`分组相关测试
- 使用`beforeEach`和`afterEach`进行测试清理
- 合理使用`async/await`处理异步操作

### 3. Mock策略
- Mock外部依赖
- 保持Mock的一致性
- 在每个测试前清理Mock状态

### 4. 断言验证
- 验证预期的行为
- 验证错误处理
- 验证边界条件

### 5. 性能测试
- 测试组件渲染性能
- 测试API响应时间
- 测试内存使用情况

## 测试覆盖率目标

- **语句覆盖率**: ≥ 90%
- **分支覆盖率**: ≥ 85%
- **函数覆盖率**: ≥ 95%
- **行覆盖率**: ≥ 90%

## 持续集成

测试配置为在以下情况下自动运行：
- 代码提交时
- 创建Pull Request时
- 合并到主分支时

## 调试测试

### 调试失败测试
```bash
npm test -- --verbose
npm test -- --no-cache
```

### 调试特定测试
```bash
npm test -- --testNamePattern="should resolve conflict"
```

### 生成测试报告
```bash
npm test -- --coverage --coverage-reporters=html
```

## 扩展测试

### 添加新测试
1. 在相应的目录创建测试文件
2. 遵循现有的测试结构和命名约定
3. 使用提供的测试工具和Mock
4. 确保测试覆盖率和质量

### 添加新的Mock
1. 在`setup.ts`中添加新的Mock配置
2. 确保Mock行为符合真实服务
3. 在`beforeEach`中重置Mock状态

### 添加新的测试工具
1. 在`setup.ts`中扩展`testUtils`对象
2. 提供通用的测试辅助函数
3. 确保工具的可靠性和一致性

## 故障排除

### 常见问题
1. **Mock冲突**: 检查Mock配置是否正确
2. **异步问题**: 确保正确使用`async/await`
3. **DOM问题**: 确保正确清理测试环境
4. **依赖问题**: 确保所有依赖正确安装

### 调试技巧
1. 使用`console.log`调试
2. 使用`--verbose`选项查看详细信息
3. 使用`--no-cache`选项避免缓存问题
4. 使用`--detectOpenHandles`检测未关闭的句柄

## 贡献指南

### 提交测试
1. 确保所有测试通过
2. 保持测试覆盖率
3. 遵循测试命名和结构约定
4. 提供清晰的测试描述

### 代码审查
1. 检查测试覆盖率
2. 验证测试质量
3. 确保测试的独立性和可重复性
4. 检查Mock的使用是否合理

---

*本测试文档将根据项目发展持续更新。*