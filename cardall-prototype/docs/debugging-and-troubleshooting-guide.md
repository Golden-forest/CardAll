# CardAll 调试诊断和故障排除指南

## 目录

1. [调试体系概述](#调试体系概述)
2. [常见同步错误诊断](#常见同步错误诊断)
3. [网络问题故障排除](#网络问题故障排除)
4. [认证问题解决方案](#认证问题解决方案)
5. [数据问题处理指南](#数据问题处理指南)
6. [性能问题优化建议](#性能问题优化建议)
7. [调试工具使用说明](#调试工具使用说明)
8. [错误预防最佳实践](#错误预防最佳实践)
9. [技术支持流程](#技术支持流程)

## 调试体系概述

### 系统架构

CardAll项目采用了多层调试诊断体系：

```
用户界面层
├── 智能错误处理器 (SmartErrorHandler)
├── 用户友好提示系统
└── 引导式修复向导

服务逻辑层
├── 调试管理器 (DebugManager)
├── 同步诊断分析器 (SyncDiagnosticsAnalyzer)
└── 错误分类和分析系统

数据存储层
├── 错误历史记录
├── 性能指标收集
└── 模式识别系统
```

### 核心组件

1. **DebugManager** - 核心调试管理器
   - 事件记录和分类
   - 错误日志管理
   - 实时监控和告警

2. **SyncDiagnosticsAnalyzer** - 同步诊断分析器
   - 错误模式识别
   - 性能指标分析
   - 预测性维护

3. **SmartErrorHandler** - 智能错误处理器
   - 自动错误恢复
   - 用户引导修复
   - 批量错误处理

### 错误级别定义

| 级别 | 描述 | 处理优先级 | 用户可见性 |
|------|------|------------|------------|
| ERROR | 严重错误，影响核心功能 | 高 | 可见 |
| WARN | 警告，潜在问题 | 中 | 可见 |
| INFO | 信息性消息 | 低 | 可见 |
| DEBUG | 调试信息 | 低 | 开发者可见 |
| TRACE | 详细跟踪信息 | 低 | 开发者可见 |

## 常见同步错误诊断

### 1. 网络超时错误 (NETWORK_TIMEOUT)

**错误特征**
- 错误信息：`Network timeout`、`Request timeout`
- 现象：同步操作长时间无响应
- 影响范围：所有云端同步操作

**诊断步骤**

```bash
# 1. 检查网络连接状态
navigator.onLine

# 2. 测试网络延迟
fetch('https://api.supabase.com', { method: 'HEAD' })
  .then(response => console.log('Network OK'))
  .catch(error => console.error('Network issue:', error))

# 3. 检查DNS解析
// 使用调试工具检查DNS解析时间
```

**解决方案**

1. **即时处理**
   ```javascript
   // 自动重试机制
   const retryWithBackoff = async (operation, maxRetries = 3) => {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await operation()
       } catch (error) {
         if (i === maxRetries - 1) throw error
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
       }
     }
   }
   ```

2. **用户操作**
   - 检查网络连接
   - 切换到更稳定的网络
   - 启用离线模式

### 2. 认证过期错误 (AUTH_EXPIRED)

**错误特征**
- 错误信息：`Token expired`、`Invalid auth token`
- 现象：用户被强制登出
- 影响范围：所有需要认证的操作

**诊断步骤**

```javascript
// 1. 检查令牌状态
const checkTokenStatus = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.log('Auth token invalid:', error.message)
    return false
  }
  return true
}

// 2. 检查会话过期时间
const checkSessionExpiry = () => {
  const session = supabase.auth.getSession()
  const expiresAt = session?.expires_at
  const now = Date.now() / 1000
  return expiresAt && expiresAt > now
}
```

**解决方案**

1. **自动刷新**
   ```javascript
   // 设置令牌自动刷新
   supabase.auth.onAuthStateChange((event, session) => {
     if (event === 'TOKEN_REFRESHED') {
       console.log('Token refreshed automatically')
     }
   })
   ```

2. **用户操作**
   - 重新登录
   - 清除浏览器缓存
   - 检查系统时间

### 3. 数据冲突错误 (SYNC_VERSION_MISMATCH)

**错误特征**
- 错误信息：`Version mismatch`、`Conflict detected`
- 现象：同步失败，数据不一致
- 影响范围：特定数据记录

**诊断步骤**

```javascript
// 1. 检查本地和云端版本
const checkVersionConflict = async (cardId) => {
  const localCard = await db.cards.get(cardId)
  const { data: cloudCard } = await supabase
    .from('cards')
    .select('sync_version, updated_at')
    .eq('id', cardId)
    .single()
  
  return {
    localVersion: localCard.syncVersion,
    cloudVersion: cloudCard.sync_version,
    localTime: new Date(localCard.updatedAt),
    cloudTime: new Date(cloudCard.updated_at)
  }
}
```

**解决方案**

1. **自动解决策略**
   ```javascript
   // 最后写入获胜策略
   const resolveConflict = async (localCard, cloudCard) => {
     const localTime = new Date(localCard.updatedAt).getTime()
     const cloudTime = new Date(cloudCard.updated_at).getTime()
     
     if (cloudTime > localTime) {
       // 使用云端数据
       await db.cards.update(cloudCard.id, {
         ...cloudCard,
         updatedAt: new Date(cloudCard.updated_at)
       })
     } else {
       // 上传本地数据
       await cloudSyncService.queueOperation({
         type: 'update',
         table: 'cards',
         data: localCard,
         localId: localCard.id
       })
     }
   }
   ```

2. **用户选择**
   - 显示冲突解决对话框
   - 提供版本对比
   - 手动合并选项

### 4. 数据损坏错误 (DATA_CORRUPT)

**错误特征**
- 错误信息：`Data corrupt`、`Invalid data format`
- 现象：应用崩溃或功能异常
- 影响范围：可能影响整个应用

**诊断步骤**

```javascript
// 1. 数据完整性检查
const validateDataIntegrity = async () => {
  try {
    const cards = await db.cards.toArray()
    const corruptedCards = cards.filter(card => {
      return !card.frontContent || !card.backContent || !card.style
    })
    
    if (corruptedCards.length > 0) {
      console.warn('Found corrupted cards:', corruptedCards.length)
      return false
    }
    return true
  } catch (error) {
    console.error('Integrity check failed:', error)
    return false
  }
}
```

**解决方案**

1. **数据恢复**
   ```javascript
   // 从备份恢复
   const restoreFromBackup = async (backupData) => {
     await db.cards.clear()
     await db.cards.bulkAdd(backupData.cards)
     await db.folders.clear()
     await db.folders.bulkAdd(backupData.folders)
     console.log('Data restored from backup')
   }
   ```

2. **用户操作**
   - 导入备份数据
   - 重置应用数据
   - 联系技术支持

## 网络问题故障排除

### 网络连接检查清单

1. **基础网络诊断**
   ```javascript
   const networkDiagnostics = {
     // 在线状态
     isOnline: navigator.onLine,
     
     // 连接类型
     connection: navigator.connection || {
       effectiveType: 'unknown',
       downlink: 0,
       rtt: 0
     },
     
     // 网络延迟测试
     testLatency: async () => {
       const start = Date.now()
       try {
         await fetch('https://api.supabase.com/health', { method: 'HEAD' })
         return Date.now() - start
       } catch {
         return -1
       }
     }
   }
   ```

2. **常见网络问题及解决**

| 问题 | 现象 | 解决方案 |
|------|------|----------|
| 网络断开 | 无法访问任何网站 | 检查网络设备，重启路由器 |
| DNS问题 | 特定网站无法访问 | 更换DNS服务器 |
| 代理问题 | 认证失败或超时 | 检查代理设置 |
| 防火墙阻止 | 连接被拒绝 | 检查防火墙配置 |

### 网络优化建议

1. **离线模式优化**
   ```javascript
   // 启用离线模式
   const enableOfflineMode = () => {
     cloudSyncService.pause()
     // 显示离线模式提示
     showNotification('已启用离线模式', 'info')
   }
   ```

2. **数据同步优化**
   ```javascript
   // 批量同步优化
   const batchSync = async (items) => {
     const batchSize = 50
     for (let i = 0; i < items.length; i += batchSize) {
       const batch = items.slice(i, i + batchSize)
       await syncBatch(batch)
       // 添加延迟避免服务器压力
       await new Promise(resolve => setTimeout(resolve, 1000))
     }
   }
   ```

## 认证问题解决方案

### 认证状态检查

```javascript
// 完整认证状态检查
const authHealthCheck = async () => {
  const checks = {
    // 1. 检查会话是否存在
    hasSession: false,
    
    // 2. 检查令牌是否有效
    tokenValid: false,
    
    // 3. 检查用户信息
    userInfo: null,
    
    // 4. 检查权限
    permissions: []
  }
  
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    checks.hasSession = !!session && !sessionError
    
    if (session) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      checks.tokenValid = !!user && !userError
      checks.userInfo = user
    }
  } catch (error) {
    console.error('Auth health check failed:', error)
  }
  
  return checks
}
```

### 常见认证问题

1. **令牌过期自动处理**
   ```javascript
   // 设置自动令牌刷新
   supabase.auth.onAuthStateChange(async (event, session) => {
     if (event === 'TOKEN_REFRESHED') {
       console.log('Token refreshed successfully')
     } else if (event === 'SIGNED_OUT') {
       // 处理意外登出
       await handleUnexpectedSignout()
     }
   })
   ```

2. **跨域认证问题**
   ```javascript
   // 确保认证配置正确
   const authConfig = {
     // 正确的重定向URL
     redirectURL: window.location.origin,
     
     // 存储配置
     storage: localStorage,
     
     // 自动刷新令牌
     autoRefreshToken: true,
     
     // 检测会话类型
     detectSessionInUrl: true
   }
   ```

## 数据问题处理指南

### 数据完整性验证

```javascript
// 数据完整性检查系统
class DataIntegrityChecker {
  async checkAllData() {
    const results = {
      cards: await this.checkCards(),
      folders: await this.checkFolders(),
      tags: await this.checkTags(),
      relationships: await this.checkRelationships()
    }
    
    return {
      overall: Object.values(results).every(r => r.valid),
      details: results
    }
  }
  
  async checkCards() {
    try {
      const cards = await db.cards.toArray()
      const issues = []
      
      cards.forEach(card => {
        // 检查必要字段
        if (!card.frontContent) {
          issues.push({ id: card.id, issue: 'Missing front content' })
        }
        if (!card.backContent) {
          issues.push({ id: card.id, issue: 'Missing back content' })
        }
        if (!card.style) {
          issues.push({ id: card.id, issue: 'Missing style' })
        }
      })
      
      return {
        valid: issues.length === 0,
        issues,
        total: cards.length
      }
    } catch (error) {
      return { valid: false, error: error.message }
    }
  }
}
```

### 数据恢复策略

1. **自动备份恢复**
   ```javascript
   // 自动备份系统
   class AutoBackup {
     async createBackup() {
       const backup = {
         timestamp: new Date().toISOString(),
         version: '1.0',
         data: {
           cards: await db.cards.toArray(),
           folders: await db.folders.toArray(),
           tags: await db.tags.toArray()
         }
       }
       
       // 保存到本地存储
       localStorage.setItem(`backup_${Date.now()}`, JSON.stringify(backup))
       
       // 保留最近5个备份
       this.cleanupOldBackups(5)
       
       return backup
     }
     
     async restoreFromBackup(backupId) {
       const backupData = localStorage.getItem(`backup_${backupId}`)
       if (!backupData) throw new Error('Backup not found')
       
       const backup = JSON.parse(backupData)
       
       // 清空现有数据
       await db.cards.clear()
       await db.folders.clear()
       await db.tags.clear()
       
       // 恢复数据
       await db.cards.bulkAdd(backup.data.cards)
       await db.folders.bulkAdd(backup.data.folders)
       await db.tags.bulkAdd(backup.data.tags)
       
       return backup
     }
   }
   ```

2. **云端数据同步恢复**
   ```javascript
   // 从云端恢复数据
   const restoreFromCloud = async () => {
     const { data: cloudCards } = await supabase
       .from('cards')
       .select('*')
       .eq('user_id', userId)
     
     if (cloudCards) {
       await db.cards.clear()
       await db.cards.bulkAdd(cloudCards.map(card => ({
         id: card.id,
         frontContent: card.front_content,
         backContent: card.back_content,
         style: card.style,
         folderId: card.folder_id,
         syncVersion: card.sync_version,
         pendingSync: false
       })))
     }
   }
   ```

## 性能问题优化建议

### 性能监控指标

```javascript
// 性能监控工具
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      syncTime: [],
      memoryUsage: [],
      networkLatency: [],
      responseTime: []
    }
  }
  
  // 监控同步性能
  monitorSyncPerformance() {
    return async (operation) => {
      const start = performance.now()
      try {
        const result = await operation()
        const duration = performance.now() - start
        
        this.metrics.syncTime.push(duration)
        
        // 检查性能阈值
        if (duration > 5000) { // 5秒阈值
          console.warn('Slow sync operation:', duration + 'ms')
        }
        
        return result
      } catch (error) {
        const duration = performance.now() - start
        this.metrics.syncTime.push(duration)
        throw error
      }
    }
  }
  
  // 监控内存使用
  monitorMemory() {
    if (performance.memory) {
      const memory = performance.memory
      const used = memory.usedJSHeapSize / memory.totalJSHeapSize
      
      this.metrics.memoryUsage.push(used)
      
      // 内存使用率超过80%时警告
      if (used > 0.8) {
        console.warn('High memory usage:', (used * 100).toFixed(1) + '%')
      }
    }
  }
  
  // 获取性能报告
  getPerformanceReport() {
    return {
      averageSyncTime: this.calculateAverage(this.metrics.syncTime),
      averageMemoryUsage: this.calculateAverage(this.metrics.memoryUsage),
      averageNetworkLatency: this.calculateAverage(this.metrics.networkLatency),
      performanceScore: this.calculatePerformanceScore()
    }
  }
}
```

### 性能优化策略

1. **数据库优化**
   ```javascript
   // 索引优化
   const optimizeDatabase = async () => {
     // 创建搜索索引
     await db.cards.where('searchVector').equals('').modify()
     
     // 批量操作优化
     const batchInsert = async (items) => {
       const batchSize = 100
       for (let i = 0; i < items.length; i += batchSize) {
         const batch = items.slice(i, i + batchSize)
         await db.cards.bulkAdd(batch)
       }
     }
   }
   ```

2. **网络请求优化**
   ```javascript
   // 请求缓存
   const requestCache = new Map()
   
   const cachedFetch = async (url, options) => {
     const cacheKey = url + JSON.stringify(options)
     
     if (requestCache.has(cacheKey)) {
       const cached = requestCache.get(cacheKey)
       if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5分钟缓存
         return cached.data
       }
     }
     
     const response = await fetch(url, options)
     const data = await response.json()
     
     requestCache.set(cacheKey, {
       data,
       timestamp: Date.now()
     })
     
     return data
   }
   ```

## 调试工具使用说明

### 浏览器开发者工具

1. **Console 面板**
   - 查看错误日志
   - 执行调试命令
   - 监控应用状态

2. **Network 面板**
   - 检查网络请求
   - 分析请求时间
   - 验证请求参数

3. **Application 面板**
   - 检查本地存储
   - 验证IndexedDB数据
   - 分析缓存使用

### 内置调试工具

```javascript
// 调试控制台命令
const debugCommands = {
  // 查看同步状态
  syncStatus: () => cloudSyncService.getCurrentStatus(),
  
  // 查看错误历史
  errorHistory: () => debugManager.getEvents({ level: DebugLevel.ERROR }),
  
  // 性能诊断
  performance: () => syncDiagnostics.generateDiagnosticReport(),
  
  // 数据完整性检查
  integrity: () => dataIntegrityChecker.checkAllData(),
  
  // 网络诊断
  network: () => networkDiagnostics,
  
  // 强制同步
  forceSync: () => cloudSyncService.performFullSync(),
  
  // 清理缓存
  clearCache: () => {
    localStorage.clear()
    location.reload()
  }
}

// 在控制台中暴露调试命令
window.debug = debugCommands
```

### 日志级别配置

```javascript
// 配置调试级别
const configureDebugging = (config) => {
  debugManager.updateConfig({
    enabled: config.enabled || true,
    level: config.level || DebugLevel.INFO,
    maxLogSize: config.maxLogSize || 1000,
    autoUpload: config.autoUpload || false,
    enableConsoleLog: config.enableConsoleLog !== false
  })
}
```

## 错误预防最佳实践

### 代码层面预防

1. **错误边界处理**
   ```javascript
   // React错误边界
   class ErrorBoundary extends React.Component {
     constructor(props) {
       super(props)
       this.state = { hasError: false }
     }
     
     static getDerivedStateFromError(error) {
       return { hasError: true }
     }
     
     componentDidCatch(error, errorInfo) {
       smartErrorHandler.handleError(error, {
         category: 'react',
         component: this.props.componentName,
         errorInfo
       })
     }
     
     render() {
       if (this.state.hasError) {
         return <FallbackComponent />
       }
       return this.props.children
     }
   }
   ```

2. **异步操作错误处理**
   ```javascript
   // 安全的异步操作包装器
   const safeAsync = async (operation, fallback = null) => {
     try {
       return await operation()
     } catch (error) {
       smartErrorHandler.handleError(error, {
         category: 'async_operation',
         operation: operation.name || 'anonymous'
       })
       return fallback
     }
   }
   
   // 使用示例
   const loadData = async () => {
     const data = await safeAsync(
       () => api.fetchData(),
       [] // fallback值
     )
     return data
   }
   ```

### 用户操作预防

1. **操作确认机制**
   ```javascript
   // 危险操作确认
   const confirmDestructiveAction = async (action, message) => {
     const confirmed = await showDialog({
       title: '确认操作',
       message,
       actions: [
         { label: '取消', handler: () => false },
         { label: '确认', handler: () => true, primary: true, destructive: true }
       ]
     })
     
     if (confirmed) {
       return await action()
     }
     return null
   }
   ```

2. **数据输入验证**
   ```javascript
   // 输入验证系统
   const validateInput = (input, rules) => {
     const errors = []
     
     for (const rule of rules) {
       if (!rule.validator(input)) {
         errors.push(rule.message)
       }
     }
     
     return {
       valid: errors.length === 0,
       errors
     }
   }
   
   // 使用示例
   const cardValidation = validateInput(cardData, [
     {
       validator: data => data.frontContent && data.frontContent.trim().length > 0,
       message: '正面内容不能为空'
     },
     {
       validator: data => data.backContent && data.backContent.trim().length > 0,
       message: '背面内容不能为空'
     }
   ])
   ```

### 系统层面预防

1. **定期健康检查**
   ```javascript
   // 定期系统健康检查
   const startHealthChecks = () => {
     setInterval(async () => {
       const health = await syncDiagnostics.performHealthCheck()
       
       if (health.status === 'critical') {
         // 发送告警
         showNotification('系统状态异常，请检查', 'error')
       }
     }, 5 * 60 * 1000) // 每5分钟检查一次
   }
   ```

2. **自动维护任务**
   ```javascript
   // 自动维护系统
   const maintenanceTasks = {
     // 清理过期日志
     cleanupLogs: async () => {
       await debugManager.clearLogs()
     },
     
     // 清理缓存
     cleanupCache: async () => {
       const cacheKeys = Object.keys(localStorage)
       const oldKeys = cacheKeys.filter(key => 
         key.startsWith('cache_') && 
         Date.now() - parseInt(key.split('_')[1]) > 7 * 24 * 60 * 60 * 1000
       )
       
       oldKeys.forEach(key => localStorage.removeItem(key))
     },
     
     // 数据备份
     backupData: async () => {
       await autoBackup.createBackup()
     }
   }
   ```

## 技术支持流程

### 问题报告标准

1. **问题描述模板**
   ```
   问题描述：
   - 简要描述遇到的问题
   
   复现步骤：
   1. 操作步骤1
   2. 操作步骤2
   3. 预期结果
   4. 实际结果
   
   环境信息：
   - 浏览器版本：
   - 操作系统：
   - 网络环境：
   - 应用版本：
   
   错误信息：
   - 控制台错误：
   - 网络请求状态：
   - 用户反馈：
   ```

2. **日志收集**
   ```javascript
   // 收集诊断信息
   const collectDiagnostics = async () => {
     return {
       timestamp: new Date().toISOString(),
       userAgent: navigator.userAgent,
       syncStatus: cloudSyncService.getCurrentStatus(),
       recentErrors: await debugManager.getEvents({
         level: DebugLevel.ERROR,
         limit: 50
       }),
       performanceReport: await syncDiagnostics.generateDiagnosticReport(),
       healthCheck: await syncDiagnostics.performHealthCheck()
     }
   }
   
   // 导出诊断信息
   const exportDiagnostics = async () => {
     const diagnostics = await collectDiagnostics()
     const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
       type: 'application/json'
     })
     
     const url = URL.createObjectURL(blob)
     const a = document.createElement('a')
     a.href = url
     a.download = `cardall-diagnostics-${Date.now()}.json`
     a.click()
     
     URL.revokeObjectURL(url)
   }
   ```

### 支持流程

1. **自助支持**
   - 查看故障排除指南
   - 运行诊断工具
   - 检查常见问题

2. **社区支持**
   - 提交问题到GitHub Issues
   - 参与社区讨论
   - 查看已解决的问题

3. **技术支持**
   - 联系开发团队
   - 提供详细日志
   - 远程协助

### 常见问题快速参考

| 问题 | 快速解决 | 深入排查 |
|------|----------|----------|
| 同步失败 | 检查网络连接 | 查看网络日志 |
| 登录失败 | 清除浏览器缓存 | 检查认证配置 |
| 数据丢失 | 恢复备份数据 | 检查数据完整性 |
| 应用卡顿 | 刷新页面 | 性能分析 |
| 功能异常 | 重启应用 | 错误日志分析 |

### 联系信息

- **技术支持邮箱**: support@cardall.com
- **GitHub Issues**: https://github.com/cardall/cardall/issues
- **社区论坛**: https://community.cardall.com
- **文档中心**: https://docs.cardall.com

---

## 附录

### 错误代码参考

| 代码 | 错误类型 | 描述 | 解决方案 |
|------|----------|------|----------|
| SYNC_001 | NETWORK_TIMEOUT | 网络超时 | 检查网络连接 |
| SYNC_002 | AUTH_EXPIRED | 认证过期 | 重新登录 |
| SYNC_003 | DATA_CONFLICT | 数据冲突 | 解决冲突 |
| SYNC_004 | DATA_CORRUPT | 数据损坏 | 恢复备份 |
| SYNC_005 | SERVER_ERROR | 服务器错误 | 联系技术支持 |

### 性能基准

- **同步时间**: < 3秒 (正常), < 10秒 (可接受), > 10秒 (需优化)
- **内存使用**: < 100MB (正常), < 200MB (可接受), > 200MB (需优化)
- **网络延迟**: < 200ms (优秀), < 500ms (良好), > 1000ms (需优化)
- **响应时间**: < 100ms (优秀), < 300ms (良好), > 500ms (需优化)

### 监控指标

- **错误率**: < 1% (优秀), < 5% (良好), > 10% (需关注)
- **可用性**: > 99.9% (优秀), > 99% (良好), < 95% (需关注)
- **用户满意度**: > 90% (优秀), > 80% (良好), < 70% (需关注)