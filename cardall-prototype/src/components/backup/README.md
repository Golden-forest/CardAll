# 备份功能组件 (Backup Components)

这个目录包含了 CardAll 应用的完整备份和数据管理功能组件。

## 功能概述

### 🛡️ 数据保护
- **自动备份**: 每24小时自动创建数据备份
- **手动备份**: 支持即时创建备份
- **备份管理**: 查看、删除、恢复和导出备份
- **智能清理**: 自动清理过期备份，节省存储空间

### 📁 数据导入导出
- **JSON导出**: 将数据导出为标准JSON格式
- **选择性导出**: 可选择导出的数据类型（卡片、文件夹、标签、图片、设置）
- **数据导入**: 从JSON文件导入数据
- **导入策略**: 支持替换、合并、跳过等导入策略
- **数据验证**: 导入前自动验证数据完整性

### 🔍 数据完整性检查
- **定期检查**: 每12小时自动检查数据完整性
- **手动检查**: 支持立即运行完整性检查
- **问题检测**: 检测数据不一致、引用缺失等问题
- **自动修复**: 支持自动修复可修复的问题
- **详细报告**: 生成详细的检查报告和修复建议

## 组件说明

### BackupManager
主要的备份管理界面，提供完整的备份功能。

```tsx
import { BackupManager } from '@/components/backup'

function App() {
  return <BackupManager />
}
```

**功能特性:**
- 📊 备份统计信息展示
- 🗂️ 备份列表管理
- 📤 数据导出功能
- 📥 数据导入功能
- 🔍 完整性检查
- ⚙️ 配置管理

### BackupProgress
显示备份操作的实时进度。

```tsx
import { BackupProgress } from '@/components/backup'

function BackupOperation() {
  const [progress, setProgress] = useState(null)
  const [isActive, setIsActive] = useState(false)

  return (
    <BackupProgress 
      progress={progress} 
      isActive={isActive}
      onComplete={() => console.log('Backup completed')}
    />
  )
}
```

**功能特性:**
- 📈 实时进度显示
- 📋 阶段指示器
- ⏱️ 时间估算
- ✅ 完成状态提示
- ❌ 错误信息显示

### BackupStatusIndicator
简洁的备份状态指示器，可集成到应用的任何位置。

```tsx
import { BackupStatusIndicator } from '@/components/backup'

function Header() {
  return (
    <header>
      <div className="flex items-center gap-2">
        <span>数据状态:</span>
        <BackupStatusIndicator />
      </div>
    </header>
  )
}
```

**功能特性:**
- 🟢 健康状态指示
- 📊 快速统计信息
- 🔄 刷新功能
- 💡 详细状态提示

## 服务集成

### 初始化备份服务

```tsx
import { initializeEnhancedBackup } from '@/services/enhanced-local-backup-service'

// 在应用启动时初始化
async function initializeApp() {
  await initializeEnhancedBackup({
    autoBackupEnabled: true,
    autoBackupInterval: 24 * 60 * 60 * 1000, // 24小时
    maxAutoBackups: 7,
    integrityCheckEnabled: true,
    integrityCheckInterval: 12 * 60 * 60 * 1000, // 12小时
    autoFixIntegrityIssues: false,
    cleanupOldBackups: true,
    backupRetentionDays: 30
  })
}
```

### 快速备份操作

```tsx
import { enhancedLocalBackupService } from '@/services/enhanced-local-backup-service'

// 创建手动备份
const backupId = await enhancedLocalBackupService.createManualBackup({
  name: 'MyBackup',
  description: '手动创建的备份',
  tags: ['manual']
})

// 运行完整性检查
const result = await enhancedLocalBackupService.runIntegrityCheck()

// 导出数据
await enhancedLocalBackupService.exportDataAsJSON({
  includeCards: true,
  includeFolders: true,
  includeTags: true,
  includeImages: true,
  filename: 'MyExport'
})

// 导入数据
const file = document.querySelector('input[type="file"]').files[0]
const importResult = await enhancedLocalBackupService.importDataFromJSON(file, {
  strategy: 'merge',
  importImages: true,
  importSettings: true,
  preserveIds: false,
  validateData: true,
  createBackup: true
})
```

## 配置选项

### EnhancedBackupConfig

```typescript
interface EnhancedBackupConfig {
  // 自动备份配置
  autoBackupEnabled: boolean
  autoBackupInterval: number // 毫秒
  maxAutoBackups: number
  autoBackupName: string
  
  // 数据完整性检查配置
  integrityCheckEnabled: boolean
  integrityCheckInterval: number
  autoFixIntegrityIssues: boolean
  
  // 导入导出配置
  exportFormat: 'json' | 'csv'
  includeImagesInExport: boolean
  compressionEnabled: boolean
  
  // 存储配置
  maxBackupStorageSize: number // 字节
  cleanupOldBackups: boolean
  backupRetentionDays: number
}
```

## 使用示例

### 1. 在主应用中集成

```tsx
import React, { useEffect } from 'react'
import { BackupManager, BackupStatusIndicator } from '@/components/backup'
import { initializeEnhancedBackup } from '@/services/enhanced-local-backup-service'

export default function App() {
  useEffect(() => {
    initializeEnhancedBackup()
  }, [])

  return (
    <div className="app">
      <header>
        <h1>CardAll</h1>
        <BackupStatusIndicator />
      </header>
      
      <main>
        <BackupManager />
      </main>
    </div>
  )
}
```

### 2. 在设置页面集成

```tsx
import { BackupStatusIndicator, BackupManager } from '@/components/backup'

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h2>设置</h2>
      
      <section>
        <h3>数据备份</h3>
        <BackupStatusIndicator showDetails={true} />
      </section>
      
      <section>
        <h3>备份管理</h3>
        <BackupManager />
      </section>
    </div>
  )
}
```

### 3. 自定义备份操作

```tsx
import { enhancedLocalBackupService } from '@/services/enhanced-local-backup-service'

export function CustomBackupButton() {
  const handleBackup = async () => {
    try {
      const backupId = await enhancedLocalBackupService.createManualBackup({
        name: `CustomBackup_${new Date().toISOString()}`,
        description: '自定义备份'
      })
      alert(`备份创建成功: ${backupId}`)
    } catch (error) {
      alert('备份失败: ' + error.message)
    }
  }

  return (
    <button onClick={handleBackup}>
      创建自定义备份
    </button>
  )
}
```

## 最佳实践

### 1. 初始化时机
- 在应用启动时尽早初始化备份服务
- 确保在用户数据操作之前完成初始化

### 2. 错误处理
- 始终使用 try-catch 包装备份操作
- 为用户提供友好的错误提示

### 3. 用户体验
- 对于耗时操作提供进度指示
- 在关键操作前确认用户意图
- 提供操作结果的反馈

### 4. 性能优化
- 避免频繁的备份操作
- 合理设置备份间隔
- 定期清理过期备份

### 5. 数据安全
- 在重要操作前自动创建备份
- 提供数据恢复功能
- 定期检查数据完整性

## 故障排除

### 常见问题

**Q: 备份创建失败**
A: 检查存储空间是否充足，确保 IndexedDB 可用，查看控制台错误信息

**Q: 导入数据失败**
A: 检查文件格式是否正确，确保数据结构完整，验证文件大小限制

**Q: 完整性检查发现问题**
A: 查看详细检查报告，根据建议进行修复，或联系技术支持

**Q: 自动备份不工作**
A: 检查备份配置，确保自动备份已启用，查看浏览器权限设置

### 调试技巧

1. 打开浏览器开发者工具查看控制台日志
2. 检查 IndexedDB 中的数据
3. 验证备份配置是否正确
4. 测试手动备份功能

## 技术细节

### 数据存储
- 使用 IndexedDB 存储备份数据
- 支持大文件存储和数据压缩
- 自动管理存储空间

### 数据格式
- 备份数据使用标准 JSON 格式
- 支持数据版本控制和迁移
- 包含完整的元数据信息

### 性能优化
- 使用事务确保数据一致性
- 批量操作减少数据库访问
- 智能缓存提高响应速度

## 版本历史

- **v1.0.0**: 初始版本，包含基本的备份和导入导出功能
- **v1.1.0**: 添加数据完整性检查功能
- **v1.2.0**: 增强UI组件和用户体验
- **v1.3.0**: 添加自动备份和智能清理功能

## 贡献指南

如需改进备份功能，请遵循以下原则：

1. 保持向后兼容性
2. 添加适当的错误处理
3. 更新相关文档
4. 进行充分测试
5. 遵循代码规范

## 许可证

本项目采用 MIT 许可证。