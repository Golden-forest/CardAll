# 冲突解决系统

## 概述

CardAll冲突解决系统是一个智能的数据冲突检测和管理工具，专门为多设备同步、离线操作和团队协作场景设计。该系统提供直观的用户界面，帮助用户轻松解决各种数据冲突。

## 核心功能

### 1. 自动冲突检测
- 实时监控数据变更
- 智能识别冲突类型
- 按优先级分类冲突

### 2. 多类型冲突支持
- **卡片内容冲突**：标题、文本、标签的编辑冲突
- **文件夹冲突**：名称、结构、归属关系冲突
- **标签冲突**：重命名、删除、颜色属性冲突

### 3. 智能解决建议
- 基于内容相似度分析
- 时间戳优先级判断
- 使用频率统计
- 名称质量评估

### 4. 多种解决方式
- **保留本地**：选择本地设备版本
- **保留远程**：选择远程版本
- **智能合并**：自动合并最佳内容
- **手动合并**：逐字段精确控制

### 5. 批量处理
- 一次性解决多个相似冲突
- 统一应用解决策略
- 批量操作确认机制

## 组件架构

### 主要组件

#### ConflictBanner (冲突通知横幅)
- **位置**：应用顶部
- **功能**：显示冲突通知和快速操作
- **特性**：优先级显示、快速访问、实时更新

#### ConflictPanel (冲突管理面板)
- **位置**：模态对话框
- **功能**：冲突列表、过滤、批量操作
- **特性**：搜索过滤、状态筛选、选择操作

#### ConflictDetail (冲突详情界面)
- **位置**：模态对话框
- **功能**：详细对比、建议展示、手动合并
- **特性**：并排对比、差异高亮、实时预览

### 数据流

```
数据变更 → 冲突检测 → 通知用户 → 用户决策 → 应用解决 → 数据同步
```

## 使用指南

### 用户操作流程

1. **冲突检测**
   - 系统自动检测数据冲突
   - 在顶部显示通知横幅
   - 导航栏显示冲突计数

2. **查看冲突**
   - 点击通知横幅或导航栏图标
   - 打开冲突管理面板
   - 浏览冲突列表和详情

3. **解决冲突**
   - 选择单个或多个冲突
   - 查看智能建议
   - 选择解决方式
   - 确认应用解决方案

4. **批量处理**
   - 选择多个相似冲突
   - 应用统一解决策略
   - 批量确认和执行

### 最佳实践

#### 对于卡片内容冲突
- 优先查看智能合并建议
- 注意检查标签合并结果
- 保留更完整的内容版本

#### 对于文件夹冲突
- 考虑文件夹的层次结构
- 保持命名一致性
- 注意子文件夹的处理

#### 对于标签冲突
- 优先保留高频使用的标签
- 考虑标签的分类价值
- 统一标签命名规范

## 配置选项

### 冲突检测设置
```typescript
// 检测间隔（毫秒）
const detectionInterval = 30000

// 相似度阈值
const similarityThreshold = 0.8

// 时间窗口（毫秒）
const timeWindow = 5 * 60 * 1000
```

### UI自定义
```typescript
// 主题颜色
const theme = {
  primary: '#3b82f6',
  warning: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444'
}

// 动画时长
const animationDuration = 200
```

## 技术实现

### 状态管理
使用React Hooks管理冲突状态：
```typescript
const {
  conflicts,
  stats,
  resolveConflict,
  batchResolveConflicts,
  getSuggestions
} = useConflicts()
```

### 智能算法
冲突解决引擎基于多种因素：
- 内容相似度计算
- 时间戳分析
- 使用频率统计
- 名称质量评估

### 性能优化
- 虚拟滚动处理大量冲突
- 防抖避免频繁检测
- 缓存优化响应速度

## 集成指南

### 在现有组件中使用

1. **导入组件**
```typescript
import { ConflictBanner } from '@/components/conflict/conflict-banner'
import { ConflictPanel } from '@/components/conflict/conflict-panel'
```

2. **集成到主界面**
```typescript
// 在Dashboard中添加冲突通知
<ConflictBanner onOpenConflictPanel={() => setShowConflictPanel(true)} />

// 添加冲突管理面板
<ConflictPanel 
  isOpen={showConflictPanel}
  onClose={() => setShowConflictPanel(false)}
/>
```

3. **使用冲突管理Hook**
```typescript
import { useConflicts } from '@/hooks/use-conflicts'

const { stats, resolveConflict } = useConflicts()
```

### 自定义冲突处理器

```typescript
// 创建自定义冲突检测器
class CustomConflictDetector implements ConflictDetector {
  async detectConflicts(): Promise<ConflictBase[]> {
    // 实现自定义检测逻辑
  }
  
  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<boolean> {
    // 实现自定义解决逻辑
  }
}
```

## 测试策略

### 单元测试
- 冲突检测算法
- 解决建议生成
- 数据合并逻辑

### 集成测试
- UI组件交互
- 状态管理流程
- 数据同步机制

### 用户测试
- 可用性测试
- 学习曲线评估
- 满意度调查

## 监控和分析

### 关键指标
- 冲突检测准确率
- 解决成功率
- 用户满意度
- 平均解决时间

### 日志记录
```typescript
// 冲突事件日志
{
  event: 'conflict_detected',
  type: 'card_content',
  timestamp: '2024-01-15T10:30:00Z',
  severity: 'medium',
  autoResolved: false
}

// 解决方案日志
{
  event: 'conflict_resolved',
  resolution: 'merge',
  duration: 4500,
  userAction: 'accepted_suggestion'
}
```

## 故障排除

### 常见问题

1. **冲突检测不准确**
   - 检查相似度阈值设置
   - 验证时间戳同步
   - 确认数据完整性

2. **UI响应缓慢**
   - 优化虚拟滚动设置
   - 检查内存使用情况
   - 调整检测频率

3. **解决失败**
   - 验证数据格式
   - 检查权限设置
   - 确认网络连接

### 调试工具
```typescript
// 启用调试模式
const debugMode = true

// 冲突分析工具
const conflictAnalyzer = {
  analyzeSimilarity: (text1: string, text2: string) => {
    // 分析相似度
  },
  
  analyzeTimestamps: (local: Date, remote: Date) => {
    // 分析时间差
  }
}
```

## 未来规划

### 功能扩展
- 冲突预防机制
- 自动解决规则
- 历史版本回滚
- 冲突报告导出

### 性能优化
- 增量冲突检测
- 智能缓存策略
- 分布式处理
- 实时同步优化

### 用户体验
- 更智能的建议算法
- 可视化冲突分析
- 个性化解决偏好
- 协作冲突处理