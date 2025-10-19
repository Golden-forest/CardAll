# CardAll 应用配置文档

## 概述

CardAll 应用配置系统提供了对云端功能的完整控制，允许通过环境变量动态启用或禁用各项功能。这种设计确保了应用的安全性和灵活性。

## 配置文件结构

```
src/config/
├── app-config.ts          # 主配置文件
└── README.md             # 本文档

src/types/
└── env.d.ts              # TypeScript 类型声明

src/utils/
└── config-validator.ts   # 配置验证工具
```

## 配置项说明

### 云端功能开关

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enableCloudSync` | boolean | false | 是否启用云端同步功能 |
| `enableAuth` | boolean | false | 是否启用用户认证功能 |
| `enableRealtime` | boolean | false | 是否启用实时同步功能 |
| `enableDebugMode` | boolean | false | 是否启用调试模式 |

### 存储配置

| 配置项 | 类型 | 默认值 | 可选值 | 说明 |
|--------|------|--------|--------|------|
| `defaultStorageMode` | string | 'indexeddb' | 'indexeddb', 'localstorage', 'memory' | 默认存储模式 |

## 环境变量配置

### .env 文件配置

```bash
# 云端功能开关 (默认禁用)
VITE_ENABLE_CLOUD_SYNC=false
VITE_ENABLE_AUTH=false
VITE_ENABLE_REALTIME=false
VITE_ENABLE_DEBUG_MODE=false
```

### 环境变量说明

所有云端功能的环境变量都以 `VITE_ENABLE_` 开头，值必须为 `true` 或 `false`。

- **VITE_ENABLE_CLOUD_SYNC**: 控制云端同步功能
- **VITE_ENABLE_AUTH**: 控制用户认证功能
- **VITE_ENABLE_REALTIME**: 控制实时同步功能
- **VITE_ENABLE_DEBUG_MODE**: 控制调试模式

## 使用方法

### 1. 导入配置

```typescript
import { AppConfig } from '@/config/app-config';

// 检查云端同步是否启用
if (AppConfig.enableCloudSync) {
  // 启用云端同步相关功能
}
```

### 2. 使用工具函数

```typescript
import { validateConfig, logConfigInfo } from '@/utils/config-validator';

// 验证配置
const validation = validateConfig();
if (!validation.isValid) {
  console.error('配置错误:', validation.errors);
}

// 打印配置信息
logConfigInfo(AppConfig, true);
```

### 3. 检查功能状态

```typescript
import { isCloudFeatureEnabled, getConfigSummary } from '@/config/app-config';

// 检查是否启用任何云端功能
if (isCloudFeatureEnabled()) {
  console.log('云端功能已启用');
} else {
  console.log('使用本地模式');
}

// 获取配置摘要
console.log(getConfigSummary());
```

## 安全考虑

### 1. 默认禁用原则

- 所有云端功能默认禁用，确保本地模式的完整功能
- 只有明确设置环境变量为 `true` 时才启用相应功能

### 2. 功能依赖关系

- `enableRealtime` 依赖 `enableCloudSync`
- `enableAuth` 依赖 `enableCloudSync`
- 违反依赖关系会产生警告，但不会阻止应用启动

### 3. 环境隔离

- 开发环境可以启用调试模式
- 生产环境建议禁用所有云端功能，除非确实需要

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

### 2. 修改 Vite 配置

在 `vite.config.ts` 中添加新的环境变量处理：

```typescript
define: {
  // 现有配置...
  __ENABLE_NEW_FEATURE__: env.VITE_ENABLE_NEW_FEATURE === 'true',
}
```

### 3. 验证配置

使用配置验证工具确保新配置的正确性：

```typescript
const validation = validateConfig();
console.log(validation.summary);
```

## 配置示例

### 本地模式配置 (推荐)

```bash
VITE_ENABLE_CLOUD_SYNC=false
VITE_ENABLE_AUTH=false
VITE_ENABLE_REALTIME=false
VITE_ENABLE_DEBUG_MODE=false
```

### 开发环境配置

```bash
VITE_ENABLE_CLOUD_SYNC=true
VITE_ENABLE_AUTH=true
VITE_ENABLE_REALTIME=true
VITE_ENABLE_DEBUG_MODE=true
```

### 生产环境配置

```bash
VITE_ENABLE_CLOUD_SYNC=true
VITE_ENABLE_AUTH=true
VITE_ENABLE_REALTIME=true
VITE_ENABLE_DEBUG_MODE=false
```

## 故障排除

### 1. 配置不生效

- 检查环境变量名是否正确
- 确认 `.env` 文件在项目根目录
- 重启开发服务器

### 2. TypeScript 错误

- 检查 `env.d.ts` 文件中的类型声明
- 确认 Vite 配置中的 `define` 部分

### 3. 功能异常

- 使用配置验证工具检查配置正确性
- 查看控制台的配置警告信息
- 检查环境兼容性问题

## 版本历史

- **v1.0.0**: 初始配置系统
- **v5.6.6**: 添加云端功能开关支持

## 相关文件

- `src/config/app-config.ts` - 主配置文件
- `src/utils/config-validator.ts` - 配置验证工具
- `src/types/env.d.ts` - TypeScript 类型声明
- `vite.config.ts` - Vite 构建配置
- `.env` - 环境变量文件