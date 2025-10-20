# CardAll 应用配置文档

## 概述

CardAll 是一个本地优先的知识卡片管理系统，专注于离线使用和数据安全。应用配置系统提供了对核心功能的控制，确保应用的稳定性和性能。

## 配置文件结构

```
src/config/
├── app-config.ts          # 主配置文件
└── README.md             # 本文档

src/types/
└── env.d.ts              # TypeScript 类型声明
```

## 配置项说明

### 核心功能配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enableDebugMode` | boolean | false | 是否启用调试模式 |

### 存储配置

| 配置项 | 类型 | 默认值 | 可选值 | 说明 |
|--------|------|--------|--------|------|
| `defaultStorageMode` | string | 'indexeddb' | 'indexeddb', 'localstorage', 'memory' | 默认存储模式 |

### 应用信息

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `version` | string | '5.6.5' | 应用版本 |
| `appName` | string | 'CardAll' | 应用名称 |

## 环境变量配置

### .env 文件配置

```bash
# 调试模式开关
VITE_ENABLE_DEBUG_MODE=false

# 应用信息
VITE_APP_VERSION=5.6.5
VITE_APP_NAME=CardAll
```

### 环境变量说明

- **VITE_ENABLE_DEBUG_MODE**: 控制调试模式，开发时可用于额外日志输出
- **VITE_APP_VERSION**: 应用版本号
- **VITE_APP_NAME**: 应用名称

## 使用方法

### 1. 导入配置

```typescript
import { AppConfig } from '@/config/app-config';

// 检查调试模式是否启用
if (AppConfig.enableDebugMode) {
  console.log('调试模式已启用');
}
```

### 2. 获取配置摘要

```typescript
import { getConfigSummary } from '@/config/app-config';

// 获取当前配置摘要
console.log(getConfigSummary());
// 输出: CardAll 5.6.5 - 本地模式 (存储: indexeddb)
```

## 存储模式说明

### IndexedDB (推荐)
- **优势**: 支持大量数据、结构化存储、高性能
- **适用场景**: 长期使用、数据量大的用户
- **特点**: 异步操作、事务支持、索引查询

### localStorage
- **优势**: 简单易用、同步操作
- **适用场景**: 数据量较小、简单存储需求
- **限制**: 存储容量有限（通常5-10MB）

### memory
- **优势**: 最快访问速度
- **适用场景**: 临时使用、测试环境
- **限制**: 刷新页面后数据丢失

## 开发指南

### 1. 添加新配置项

在 `app-config.ts` 中添加新的配置项：

```typescript
export const AppConfig = {
  // 现有配置...
  enableNewFeature: import.meta.env.VITE_ENABLE_NEW_FEATURE === 'true' || false,
};
```

同时在 `env.d.ts` 中添加类型声明：

```typescript
interface ImportMetaEnv {
  // 现有类型...
  readonly VITE_ENABLE_NEW_FEATURE: string;
}
```

### 2. 验证配置

使用配置验证函数确保新配置的正确性：

```typescript
import { validateAppConfig } from '@/config/app-config';

const validatedConfig = validateAppConfig({
  enableDebugMode: true,
  defaultStorageMode: 'indexeddb',
  version: '5.6.6'
});
```

## 配置示例

### 开发环境配置

```bash
VITE_ENABLE_DEBUG_MODE=true
VITE_APP_VERSION=5.6.5-dev
VITE_APP_NAME=CardAll Dev
```

### 生产环境配置

```bash
VITE_ENABLE_DEBUG_MODE=false
VITE_APP_VERSION=5.6.5
VITE_APP_NAME=CardAll
```

## 故障排除

### 1. 配置不生效

- 检查环境变量名是否正确
- 确认 `.env` 文件在项目根目录
- 重启开发服务器

### 2. 存储模式问题

- 检查浏览器是否支持 IndexedDB
- 查看浏览器控制台的错误信息
- 尝试切换到 localStorage 模式

### 3. TypeScript 错误

- 检查 `env.d.ts` 文件中的类型声明
- 确认环境变量值的类型正确

## 数据安全

### 1. 本地存储

- 所有数据默认存储在用户本地浏览器中
- 不会自动上传到任何服务器
- 用户完全控制自己的数据

### 2. 隐私保护

- 无用户追踪
- 无数据收集
- 无网络请求用于数据同步

### 3. 数据导出

- 支持数据导出功能
- 用户可以备份和迁移自己的数据

## 版本历史

- **v1.0.0**: 初始配置系统
- **v5.6.5**: 简化为本地优先配置

## 相关文件

- `src/config/app-config.ts` - 主配置文件
- `src/types/env.d.ts` - TypeScript 类型声明
- `vite.config.ts` - Vite 构建配置
- `.env` - 环境变量文件