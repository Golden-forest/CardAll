# CardAll - 知识卡片管理平台

## 项目概述

CardAll 是一个现代化的知识卡片管理系统，专注于图文内容的结构化展示与管理。该系统采用 React + TypeScript + Vite 技术栈，结合 Supabase 后端服务，提供完整的卡片创建、编辑、组织和分享功能。

## 核心功能

### 卡片管理系统
- **智能输入**: 支持粘贴输入图文、手动输入文字
- **双面卡片**: 正面显示标题+图文内容，背面显示标签和补充内容
- **实时编辑**: 所见即所得的编辑体验，文字直接编辑，图片可拖拽位置
- **样式系统**: 支持纯色背景、渐变色背景等多种样式
- **高质量导出**: 一键生成高质量PNG截图

### 交互功能
- **标签管理**: 完整的标签系统，支持筛选和重命名

### 云同步功能
- **实时同步**: 基于 Supabase Realtime 的实时数据同步
- **离线优先**: 使用 Dexie 本地数据库，支持离线操作
- **冲突解决**: 智能的数据冲突检测和解决机制
- **批量上传**: 优化的批量上传和同步策略

## 技术栈

### 前端技术
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 3 + Framer Motion
- **状态管理**: React Context + Dexie (本地存储)
- **富文本编辑**: Tiptap 3
- **拖拽交互**: @dnd-kit
- **截图功能**: modern-screenshot
- **UI组件**: Radix UI + shadcn/ui

### 后端技术
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **实时同步**: Supabase Realtime
- **文件存储**: Supabase Storage

### 开发工具
- **测试**: Vitest + Playwright + Jest
- **代码检查**: ESLint + TypeScript
- **构建优化**: Vite PWA 插件
- **图标系统**: 自动生成多尺寸图标

## 项目结构

```
cardall-prototype/
├── src/
│   ├── components/          # 组件目录 (167个文件)
│   │   ├── card/           # 卡片相关组件
│   │   ├── folder/         # 文件夹管理
│   │   ├── auth/           # 认证组件
│   │   ├── dashboard/      # 仪表板组件
│   │   ├── ui/             # UI基础组件 (基于Radix UI)
│   │   ├── styles/         # 样式相关组件
│   │   ├── screenshot/     # 截图功能
│   │   ├── pwa/            # PWA相关组件
│   │   └── conflict/      # 冲突解决组件
│   ├── services/           # 服务层 (199个文件)
│   │   ├── database-*.ts   # 数据库服务
│   │   ├── sync-*.ts       # 同步服务
│   │   ├── auth.ts         # 认证服务
│   │   └── cloud-*.ts      # 云服务
│   ├── contexts/           # React Context (5个文件)
│   │   ├── cardall-context.tsx
│   │   ├── auth-context.tsx
│   │   └── theme-context.tsx
│   ├── hooks/              # 自定义Hooks (20个文件)
│   ├── types/              # TypeScript类型定义 (10个文件)
│   │   ├── card.ts         # 卡片数据类型
│   │   ├── sync.ts         # 同步相关类型
│   │   └── database.ts     # 数据库类型
│   └── utils/              # 工具函数
├── tests/                  # 测试目录 (71个文件)
│   ├── unit/               # 单元测试
│   ├── integration/        # 集成测试
│   ├── e2e/                # 端到端测试
│   └── performance/         # 性能测试
├── docs/                   # 项目文档
├── supabase/               # 数据库迁移文件
└── public/                 # 静态资源
```

## 关键技术特性

### 1. 离线优先架构
- 使用 Dexie 作为本地数据库，支持完全离线操作
- 智能的在线/离线状态检测和切换
- 数据同步冲突解决机制

### 2. 实时数据同步
- 基于 Supabase Realtime 的实时数据同步
- 增量同步算法，优化同步性能
- 网络状态监控和智能重试机制

### 3. PWA 支持
- 完整的渐进式Web应用功能
- 支持离线使用和安装到桌面
- Service Worker 缓存策略

### 4. 性能优化
- 代码分割和懒加载
- 图片优化和懒加载
- 虚拟滚动支持大量数据

### 5. 可访问性
- 遵循 WCAG 2.1 标准
- 完整的键盘导航支持
- 屏幕阅读器兼容

## 开发命令

### 基础命令
```bash
# 开发环境
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
```

### 测试命令
```bash
# 运行所有测试
npm run test

# 监听模式运行测试
npm run test:watch

# 测试覆盖率
npm run test:coverage

# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 端到端测试
npm run test:e2e

# 性能测试
npm run test:performance

# 运行所有测试
npm run test:all
```

## 配置说明

### 环境变量
```env
# Supabase 配置
VITE_SUPABASE_URL=https://elwnpejlwkgdacaugvvd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_ACCESS_TOKEN=sbp_e95c8cedf56ad231cb00db4c2696b029c20cefda

# 应用配置
VITE_APP_NAME=CardAll
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=development
```

### TypeScript 配置
- 严格模式启用
- 路径别名支持 (`@/*`)
- 完整的类型检查

### ESLint 配置
- React 和 TypeScript 规则
- 代码质量检查
- 测试环境支持

## 数据库架构

### 主要数据表
- **cards**: 卡片数据
- **folders**: 文件夹数据
- **tags**: 标签数据
- **images**: 图片数据
- **users**: 用户数据

### 同步机制
- 版本控制和增量同步
- 冲突检测和解决
- 批量操作优化

## 性能特性

### 构建优化
- Vite 构建优化
- 代码分割策略
- 静态资源优化

### 运行时优化
- React.memo 优化
- 虚拟滚动
- 图片懒加载
- 防抖和节流

## 开发指南

### 组件开发
- 使用函数组件和Hooks
- 遵循单一职责原则
- 完整的 TypeScript 类型定义

### 服务层开发
- 统一的错误处理
- 类型安全的数据操作
- 完整的测试覆盖

### 测试策略
- 单元测试覆盖核心逻辑
- 集成测试验证功能完整性
- E2E 测试确保用户体验

## 部署指南

### 生产环境
- 构建优化配置
- 静态资源部署
- 环境变量配置

### 监控和调试
- 性能监控
- 错误追踪
- 用户行为分析

## 版本历史

- **v0.1.0** - 初始版本，基础功能实现
- **v0.2.0** - 样式系统优化，PWA支持
- **v0.3.0** - 文件夹系统，组合功能
- **v0.4.0** - 标签系统，搜索优化
- **v5.6.3** - 云同步功能增强与系统优化

## 开发注意事项

### 代码规范
- 严格遵循 TypeScript 类型检查
- 使用 ESLint 进行代码检查
- 保持组件的单一职责

### 性能考虑
- 避免不必要的重渲染
- 优化大数据量操作
- 合理使用缓存策略

### 安全考虑
- 数据验证和清理
- 用户认证和授权
- 敏感信息保护

## 项目状态

- **开发状态**: 活跃开发
- **测试覆盖**: 高覆盖率
- **文档完善**: 详细文档
- **部署就绪**: 生产环境可用

---

## 快速开始

1. **环境准备**
   ```bash
   node --version  # 确保Node.js 18+
   npm --version   # 确保npm可用
   ```

2. **安装依赖**
   ```bash
   cd cardall-prototype
   npm install
   ```

3. **开发运行**
   ```bash
   npm run dev
   ```

4. **构建部署**
   ```bash
   npm run build
   npm run preview
   ```

项目已配置完整的开发、测试和部署流程，可以直接开始开发工作。

## 重要说明

- **response in chinese**: 使用中文响应
- **Do what has been asked; nothing more, nothing less**: 严格按照要求执行，不多不少
- **NEVER create files unless they're absolutely necessary**: 绝不创建不必要的文件
- **ALWAYS prefer editing an existing file**: 优先编辑现有文件而非创建新文件
- **NEVER proactively create documentation files**: 不主动创建文档文件