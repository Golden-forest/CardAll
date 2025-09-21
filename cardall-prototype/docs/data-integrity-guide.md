# 数据完整性检查服务使用指南

## 概述

数据完整性检查服务是一个自动化的后台服务，用于监控和验证 CardAll 应用中的数据完整性。该服务能够自动检测数据损坏、引用关系错误、性能问题等，并提供修复建议。

## 主要功能

### 1. 自动化检查
- **后台检查**: 定期在后台运行，不影响用户正常使用
- **智能调度**: 根据设备性能和网络状态自动调整检查频率
- **空闲时间检查**: 在用户不活跃时进行检查，进一步减少对性能的影响

### 2. 全面的数据验证
- **引用完整性**: 检查孤立图片、无效的文件夹引用、重复ID等
- **数据验证**: 验证数据格式、必填字段、数据类型等
- **同步状态**: 检查同步队列中的过期项目、异常状态等
- **性能监控**: 监控数据库大小、图片数量、存储空间等性能指标
- **存储检查**: 检查存储空间不足、配额超限等问题
- **安全检查**: 验证数据加密状态、访问权限等安全相关项

### 3. 智能修复
- **自动修复**: 对于可自动修复的问题，提供一键修复功能
- **备份保护**: 修复前自动创建数据备份，确保安全
- **修复回滚**: 如果修复失败，可以自动回滚到修复前的状态

### 4. 用户界面
- **状态指示器**: 在应用头部显示数据完整性状态
- **详细面板**: 提供完整的检查结果和历史记录
- **设置界面**: 允许用户自定义检查配置和通知设置

## 使用方法

### 1. 基本使用

#### 查看数据完整性状态
在应用头部的数据完整性指示器会显示当前状态：
- 🟢 **正常**: 所有检查都通过
- 🟡 **警告**: 发现一些非关键问题
- 🔴 **异常**: 发现严重问题，需要立即处理
- ⚪ **未知**: 从未检查或状态未知

#### 运行手动检查
1. 点击头部状态指示器旁边的刷新按钮
2. 或在设置页面中运行完整检查

#### 查看详细结果
1. 点击状态指示器查看快速摘要
2. 进入设置页面查看完整的检查结果和历史记录

### 2. 配置选项

#### 检查配置
系统提供两种预设配置：

**默认配置 (default)**
- 包含所有检查项目
- 适合日常使用
- 平衡了检查全面性和性能

**快速配置 (quick)**
- 只检查关键项目
- 适合快速验证
- 对性能影响最小

#### 自定义配置
您可以根据需要创建自定义配置：
```typescript
const customConfig = {
  id: 'custom',
  name: '自定义配置',
  enabled: true,
  schedule: {
    enabled: true,
    interval: 60 * 60 * 1000, // 1小时
    idleTime: true
  },
  checks: {
    dataValidation: true,
    referenceIntegrity: true,
    syncStatus: false,
    performance: false,
    storage: false,
    security: false
  },
  autoRepair: {
    enabled: true,
    maxRetries: 3,
    allowedTypes: ['missing_field', 'invalid_format']
  },
  backup: {
    enabled: true,
    beforeRepair: true,
    afterRepair: false
  },
  notifications: {
    enabled: true,
    onCritical: true,
    onWarning: false,
    onCompletion: false
  }
}
```

#### 调度设置
- **启用调度**: 定期自动运行检查
- **检查间隔**: 设置检查的时间间隔（建议30分钟到24小时）
- **空闲时间检查**: 在用户不活跃时进行检查

#### 通知设置
- **严重问题通知**: 发现严重问题时立即通知
- **警告通知**: 发现警告问题时通知
- **完成通知**: 检查完成后通知结果

#### 自动修复设置
- **启用自动修复**: 自动修复可修复的问题
- **最大重试次数**: 修复失败时的重试次数
- **允许修复类型**: 指定哪些类型的问题可以自动修复

#### 备份设置
- **启用备份**: 在修复前创建备份
- **修复前备份**: 修复前自动备份
- **修复后备份**: 修复后创建备份用于回滚

## API 参考

### DataIntegrityService 类

#### 构造函数
```typescript
const service = new DataIntegrityService()
```

#### 主要方法

##### 配置管理
```typescript
// 获取配置
const config = service.getConfig(configId: string)

// 更新配置
await service.updateConfig(configId: string, config: IntegrityCheckConfig)

// 添加配置
await service.addConfig(config: IntegrityCheckConfig)

// 删除配置
await service.deleteConfig(configId: string)
```

##### 手动检查
```typescript
// 运行手动检查
const result = await service.runManualCheck(force?: boolean)

// 使用指定配置运行检查
const result = await service.runManualCheckWithConfig(configId: string, force?: boolean)
```

##### 后台控制
```typescript
// 启用后台验证
await service.enableBackgroundValidation()

// 禁用后台验证
await service.disableBackgroundValidation()

// 设置检查间隔
await service.setBackgroundCheckInterval(interval: number)

// 启用空闲检测
await service.enableIdleDetection()

// 禁用空闲检测
await service.disableIdleDetection()
```

##### 状态查询
```typescript
// 获取服务状态
const status = await service.getServiceStatus()

// 获取检查历史
const history = await service.getHistory(limit?: number)

// 获取配置列表
const configs = await service.getConfigs()
```

##### 单项检查
```typescript
// 数据验证检查
const result = await service.checkDataValidation()

// 引用完整性检查
const result = await service.checkReferenceIntegrity()

// 同步状态检查
const result = await service.checkSyncStatus()

// 性能检查
const result = await service.checkPerformance()

// 存储检查
const result = await service.checkStorage()

// 安全检查
const result = await service.checkSecurity()
```

### 类型定义

#### IntegrityCheckResult
```typescript
interface IntegrityCheckResult {
  timestamp: Date
  status: 'passed' | 'warning' | 'failed'
  issues: IntegrityIssue[]
  stats: IntegrityStats
  checks: Record<string, IntegrityCheckItem>
}
```

#### IntegrityIssue
```typescript
interface IntegrityIssue {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  entityType: string
  entityId: string
  description: string
  suggestedAction: string
  autoFixable: boolean
}
```

#### IntegrityCheckConfig
```typescript
interface IntegrityCheckConfig {
  id: string
  name: string
  enabled: boolean
  schedule: {
    enabled: boolean
    interval: number
    idleTime?: boolean
  }
  checks: {
    dataValidation: boolean
    referenceIntegrity: boolean
    syncStatus: boolean
    performance: boolean
    storage: boolean
    security: boolean
  }
  autoRepair: {
    enabled: boolean
    maxRetries: number
    allowedTypes: string[]
  }
  backup: {
    enabled: boolean
    beforeRepair?: boolean
    afterRepair?: boolean
  }
  notifications: {
    enabled: boolean
    onCritical: boolean
    onWarning: boolean
    onCompletion: boolean
  }
}
```

## 最佳实践

### 1. 配置建议

#### 生产环境
- 使用默认配置，包含所有检查项目
- 设置检查间隔为30-60分钟
- 启用后台检查和空闲时间检查
- 启用自动修复，但限制修复类型
- 启用备份功能

#### 开发环境
- 使用快速配置，减少对开发性能的影响
- 设置检查间隔为2-4小时
- 禁用自动修复，避免干扰开发
- 只启用关键通知

#### 大数据量环境
- 减少检查频率，避免性能影响
- 增加超时时间，适应大数据集
- 禁用某些耗时的检查项目
- 监控内存使用情况

### 2. 性能优化

#### 检查策略
- **分批次检查**: 将大数据集分批次处理
- **增量检查**: 只检查新增或修改的数据
- **采样检查**: 对大数据集进行采样检查
- **缓存结果**: 缓存检查结果，避免重复计算

#### 资源管理
- **内存监控**: 监控内存使用，避免内存泄漏
- **并发控制**: 限制并发检查数量
- **优先级调度**: 高优先级问题优先处理
- **资源清理**: 检查完成后及时清理资源

### 3. 错误处理

#### 常见错误类型
1. **数据库错误**: 数据库连接失败、查询超时
2. **权限错误**: 存储权限不足、IndexedDB 访问受限
3. **配额错误**: 存储空间不足、配额超限
4. **网络错误**: 网络连接问题、同步服务不可用
5. **数据错误**: 数据格式错误、引用关系损坏

#### 错误处理策略
- **重试机制**: 对于临时性错误，自动重试
- **降级处理**: 对于严重错误，提供降级方案
- **用户通知**: 及时通知用户错误情况
- **日志记录**: 详细记录错误信息用于排查

### 4. 监控和诊断

#### 关键指标
- **检查成功率**: 检查成功的比例
- **问题发现率**: 发现问题的比例
- **修复成功率**: 修复成功的比例
- **性能影响**: 检查对应用性能的影响
- **用户反馈**: 用户对数据完整性的反馈

#### 诊断工具
- **状态面板**: 查看详细的状态信息
- **历史记录**: 分析检查历史和趋势
- **日志分析**: 查看详细的操作日志
- **性能报告**: 生成性能分析报告

## 故障排除

### 1. 常见问题

#### 检查失败
**问题**: 检查总是失败，返回错误状态

**可能原因**:
- 数据库连接问题
- 存储权限不足
- 数据量过大导致超时

**解决方案**:
1. 检查浏览器控制台错误信息
2. 验证 IndexedDB 权限
3. 增加超时时间或减少检查数据量
4. 尝试清除浏览器数据后重试

#### 性能问题
**问题**: 检查导致应用卡顿

**可能原因**:
- 检查频率过高
- 单次检查数据量过大
- 设备性能不足

**解决方案**:
1. 降低检查频率
2. 使用快速配置
3. 启用空闲时间检查
4. 关闭不必要的检查项目

#### 自动修复失败
**问题**: 自动修复无法解决问题

**可能原因**:
- 问题过于复杂
- 权限不足
- 数据损坏严重

**解决方案**:
1. 手动修复问题
2. 导出数据后重新导入
3. 联系技术支持

### 2. 调试技巧

#### 启用调试日志
```typescript
// 在浏览器控制台中启用调试日志
localStorage.setItem('data-integrity-debug', 'true')

// 刷新页面后查看详细日志
```

#### 手动运行检查
```typescript
// 在浏览器控制台中手动运行检查
const service = new DataIntegrityService()
const result = await service.runManualCheck(true)
console.log('检查结果:', result)
```

#### 检查服务状态
```typescript
// 查看服务状态
const status = await service.getServiceStatus()
console.log('服务状态:', status)
```

### 3. 数据恢复

#### 备份恢复
如果自动修复导致数据丢失，可以尝试从备份恢复：

1. 查找最近的备份文件
2. 使用备份恢复工具恢复数据
3. 验证恢复后的数据完整性

#### 手动恢复
对于严重的数据损坏，可能需要手动恢复：

1. 导出所有可用数据
2. 清理数据库
3. 重新导入数据
4. 运行完整性检查验证

## 版本历史

### v1.0.0 (当前版本)
- 初始版本发布
- 基本的数据完整性检查功能
- 后台自动检查
- 用户界面集成
- 自动修复功能

### 未来计划
- 增量检查支持
- 云端数据完整性验证
- 更智能的修复策略
- 性能优化和bug修复

## 支持

如果您在使用过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查浏览器控制台的错误信息
3. 查看应用的错误日志
4. 联系技术支持团队

---

*本文档最后更新时间: 2025-09-21*