# CardAll - 知识卡片管理平台 (iFlow Context)

## 项目概述

CardAll 是一个现代化的知识卡片管理系统，专注于图文内容的结构化展示与管理。该项目采用现代化的技术栈，提供优雅的用户体验和强大的功能，支持离线优先架构。

### 核心特性

- **智能卡片管理**: 支持图文混排、实时编辑、智能分类和灵活的卡片组合
- **双面卡片设计**: 正面展示标题+图文内容，背面显示标签和补充内容
- **拖拽交互**: 支持磁力吸附、组合管理和文件夹系统
- **离线优先架构**: 使用 IndexedDB 本地存储，支持数据同步
- **PWA 支持**: 完整的渐进式Web应用功能，可安装为桌面应用

## 技术栈

### 前端技术
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS + Framer Motion
- **状态管理**: React Context + Dexie (本地存储)
- **富文本编辑**: Tiptap
- **拖拽交互**: @dnd-kit
- **截图功能**: modern-screenshot
- **UI组件**: Radix UI + shadcn/ui

### 后端技术
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **实时同步**: Supabase Realtime
- **文件存储**: Supabase Storage

## 项目结构

```
cardall-prototype/
├── src/
│   ├── components/          # 组件目录
│   │   ├── card/           # 卡片相关组件
│   │   ├── dashboard/      # 仪表板组件
│   │   ├── folder/         # 文件夹管理
│   │   ├── tag/            # 标签系统
│   │   └── ui/             # UI基础组件
│   ├── contexts/           # React Context
│   ├── hooks/              # 自定义Hooks
│   ├── services/           # 服务层
│   ├── types/              # TypeScript类型定义
│   └── utils/              # 工具函数
├── tests/                  # 测试文件
└── docs/                   # 项目文档
```

## 核心架构

### 数据管理
- 使用 Dexie.js (IndexedDB wrapper) 作为本地数据库
- 实现了统一的数据库架构，支持卡片、文件夹、标签等实体
- 包含数据迁移服务，支持从 localStorage 迁移到 IndexedDB
- 实现了同步队列机制，支持离线操作和在线同步

### 状态管理
- 使用 React Context 进行全局状态管理
- CardAllProvider 作为根级状态提供者
- 分离的 Context：卡片、文件夹、标签、样式面板等

### 核心组件
1. **FlipCard**: 双面卡片组件，支持翻转、编辑、截图等功能
2. **Dashboard**: 主仪表板，包含头部、侧边栏和主内容区
3. **MasonryGrid**: 瀑布流布局的卡片网格
4. **RichTextEditor**: 富文本编辑器，基于 Tiptap

### 初始化流程
1. 数据库初始化
2. 数据迁移检查和执行
3. 文件系统访问权限请求
4. 同步服务初始化
5. 用户认证状态检查

## 开发和构建

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装依赖
```bash
cd cardall-prototype
npm install
```

### 开发环境
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

### 代码检查
```bash
npm run lint
```

### 测试
```bash
# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 端到端测试
npm run test:e2e

# 性能测试
npm run test:performance
```

## 配置说明

### 环境变量
创建 `.env` 文件并配置以下变量：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 开发约定

### 代码风格
- 使用 TypeScript 进行类型安全开发
- 遵循 React 最佳实践
- 使用 Tailwind CSS 进行样式开发
- 组件化开发，保持单一职责原则

### 测试策略
- 单元测试：测试独立功能模块
- 集成测试：测试组件和服务间的交互
- 端到端测试：模拟用户行为的完整流程测试
- 性能测试：评估应用性能指标

### 数据模型
- Card: 知识卡片，包含正面和背面内容
- Folder: 文件夹，用于组织卡片
- Tag: 标签，用于分类卡片
- ImageData: 图片数据结构

## 部署和发布

### PWA 支持
项目配置了完整的 PWA 功能，包括：
- 应用清单 (manifest.json)
- 服务工作者 (Service Worker)
- 离线支持
- 安装提示

### 构建优化
- 代码分割：按功能模块分割代码
- 资源压缩：自动压缩 JavaScript、CSS 和图片
- 缓存策略：合理的资源缓存策略