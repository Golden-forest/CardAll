# Supabase 客户端配置使用指南

## 概述

新的 Supabase 客户端配置提供了增强的连接管理、错误处理和多环境支持。本指南将帮助您了解如何使用这些新功能。

## 主要特性

### 🔧 增强功能
- **连接状态监控**: 实时监控 Supabase 连接状态
- **自动重连**: 连接断开时自动尝试重连
- **查询重试**: 失败的查询自动重试，支持指数退避
- **错误处理**: 增强的错误识别和处理机制
- **安全凭据管理**: 环境变量管理和安全存储
- **多环境支持**: 支持 development、staging、production 环境

### 🛡️ 向后兼容
保持现有代码的向后兼容性，所有现有的 `import { supabase }` 语句继续有效。

## 使用方法

### 1. 基础使用（向后兼容）

```typescript
import { supabase } from './src/services/supabase'

// 现有代码无需更改
const { data, error } = await supabase
  .from('cards')
  .select('*')
```

### 2. 增强功能使用

```typescript
import { getSupabaseClient, isSupabaseError, getSupabaseErrorMessage } from './src/services/supabase-client'

// 获取增强的客户端
const client = getSupabaseClient()

// 监听连接状态变化
client.addConnectionListener((status) => {
  console.log('连接状态:', status.isConnected ? '已连接' : '断开连接')
  if (status.error) {
    console.error('连接错误:', status.error)
  }
})

// 使用重试机制执行查询
const { data, error } = await client.queryWithRetry(async () => {
  return await supabase.from('cards').select('*')
})

// 错误处理
if (error) {
  if (isSupabaseError(error)) {
    console.error('Supabase 错误:', getSupabaseErrorMessage(error))
  } else {
    console.error('其他错误:', error.message)
  }
}

// 手动重连
await client.reconnect()
```

### 3. 调试工具

```typescript
import { debugTools } from './src/services/supabase-client'

// 获取连接状态
const status = debugTools.getConnectionStatus()
console.log('连接状态:', status)

// 手动重连
await debugTools.reconnect()

// 记录配置信息
debugTools.logConfig()
```

## 配置

### 环境变量

在 `.env` 文件中配置以下环境变量：

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_ACCESS_TOKEN=your-access-token-here

# 应用配置
VITE_APP_NAME=CardAll
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=development
```

### 多环境配置

```bash
# .env.development
VITE_APP_ENVIRONMENT=development
VITE_SUPABASE_URL=https://dev-project.supabase.co

# .env.staging
VITE_APP_ENVIRONMENT=staging
VITE_SUPABASE_URL=https://staging-project.supabase.co

# .env.production
VITE_APP_ENVIRONMENT=production
VITE_SUPABASE_URL=https://prod-project.supabase.co
```

## 高级功能

### 1. 连接状态监控

```typescript
import { getSupabaseClient } from './src/services/supabase-client'

const client = getSupabaseClient()

// 添加连接监听器
const statusListener = (status) => {
  console.log(`连接状态: ${status.isConnected ? '在线' : '离线'}`)
  console.log(`最后检查: ${new Date(status.lastChecked).toLocaleString()}`)
  if (status.error) {
    console.log(`错误: ${status.error}`)
  }
  console.log(`重试次数: ${status.retryCount}/${status.maxRetries}`)
}

client.addConnectionListener(statusListener)

// 移除监听器
// client.removeConnectionListener(statusListener)
```

### 2. 查询重试机制

```typescript
import { getSupabaseClient } from './src/services/supabase-client'

const client = getSupabaseClient()

// 自定义重试配置
const result = await client.queryWithRetry(
  async () => {
    return await supabase.from('cards').select('*')
  },
  5, // 最大重试次数
)

if (result.error) {
  console.error('查询失败:', result.error)
} else {
  console.log('查询成功:', result.data)
}
```

### 3. 错误处理

```typescript
import { isSupabaseError, getSupabaseErrorMessage } from './src/services/supabase-client'

async function handleSupabaseOperation(operation: () => Promise<any>) {
  try {
    const result = await operation()

    if (result.error) {
      if (isSupabaseError(result.error)) {
        const message = getSupabaseErrorMessage(result.error)
        console.error('Supabase 操作失败:', message)

        // 根据错误类型处理
        if (result.error.__isAuthError) {
          // 处理认证错误
          console.error('认证错误，请重新登录')
        } else if (result.error.__isPostgrestError) {
          // 处理数据库错误
          console.error('数据库错误')
        }
      } else {
        console.error('未知错误:', result.error)
      }

      return null
    }

    return result.data
  } catch (error) {
    console.error('操作异常:', error)
    return null
  }
}
```

## 测试

### 1. 单元测试

项目包含完整的单元测试套件：

```bash
# 运行 Supabase 客户端测试
npm test tests/unit/services/supabase-client.test.ts
```

### 2. 集成测试

使用提供的测试页面进行完整的功能测试：

```bash
# 打开测试页面
open test-supabase-config.html
```

### 3. 验证脚本

运行验证脚本检查配置：

```bash
# 运行验证脚本
node verify-supabase-config.cjs
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查环境变量配置
   - 验证网络连接
   - 查看 Supabase 项目状态

2. **认证错误**
   - 验证匿名密钥是否正确
   - 检查 Supabase 项目认证设置

3. **构建错误**
   - 确保所有依赖已安装
   - 检查 TypeScript 类型定义

### 调试技巧

1. **启用详细日志**
   ```typescript
   // 在开发环境中，日志会自动记录详细信息
   ```

2. **检查连接状态**
   ```typescript
   const status = getSupabaseClient().getConnectionStatus()
   console.log('连接状态:', status)
   ```

3. **使用调试工具**
   ```typescript
   import { debugTools } from './src/services/supabase-client'
   debugTools.logConfig()
   ```

## 最佳实践

### 1. 错误处理
- 始终检查查询结果中的错误
- 使用 `isSupabaseError` 识别 Supabase 特定错误
- 提供用户友好的错误消息

### 2. 连接管理
- 监听连接状态变化
- 在离线时提供适当的用户反馈
- 使用重试机制处理临时网络问题

### 3. 性能优化
- 使用查询重试机制减少临时故障的影响
- 合理设置重试次数和延迟
- 避免频繁的连接状态检查

## 迁移指南

### 从旧版本迁移

现有代码无需修改，但建议逐步采用新功能：

1. **立即迁移**: 继续使用现有的 `import { supabase }` 语句
2. **逐步增强**: 在新代码中使用 `getSupabaseClient()` 获得增强功能
3. **完全迁移**: 逐步更新所有代码以使用新的增强功能

### 示例迁移

**旧代码**:
```typescript
import { supabase } from './src/services/supabase'

const { data, error } = await supabase.from('cards').select('*')
if (error) {
  console.error('Error:', error.message)
}
```

**新代码**:
```typescript
import { getSupabaseClient, isSupabaseError, getSupabaseErrorMessage } from './src/services/supabase-client'

const client = getSupabaseClient()
const result = await client.queryWithRetry(async () => {
  return await supabase.from('cards').select('*')
})

if (result.error) {
  if (isSupabaseError(result.error)) {
    console.error('Supabase Error:', getSupabaseErrorMessage(result.error))
  } else {
    console.error('Error:', result.error.message)
  }
}
```

## API 参考

### EnhancedSupabaseClient

#### 方法
- `getClient(): SupabaseClient` - 获取原始 Supabase 客户端
- `getConnectionStatus(): ConnectionStatus` - 获取连接状态
- `addConnectionListener(listener: Function)` - 添加连接状态监听器
- `removeConnectionListener(listener: Function)` - 移除连接状态监听器
- `reconnect(): Promise<void>` - 手动重连
- `queryWithRetry(operation: Function, maxRetries?: number): Promise<{data: any, error: any}>` - 带重试的查询
- `cleanup(): void` - 清理资源

### 工具函数
- `isSupabaseError(error: any): boolean` - 检查是否为 Supabase 错误
- `getSupabaseErrorMessage(error: any): string` - 获取错误消息
- `getSupabaseClient(): EnhancedSupabaseClient` - 获取增强客户端实例

### 类型定义
- `ConnectionStatus` - 连接状态接口
- `SupabaseConfig` - 配置接口
- `Database` - 数据库类型定义

## 总结

新的 Supabase 客户端配置提供了强大的连接管理、错误处理和多环境支持，同时保持向后兼容性。建议新项目直接使用新功能，现有项目可以逐步迁移以获得更好的可靠性和用户体验。