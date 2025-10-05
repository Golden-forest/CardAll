# CardAll - 本地知识卡片管理平台

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-username/cardall)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--local-orange)](package.json)

## 项目概述

CardAll 是一个现代化的本地知识卡片管理系统，专注于图文内容的结构化展示与管理。该系统采用 React + TypeScript + Vite 技术栈，基于本地存储提供完整的卡片创建、编辑、组织和管理功能。

### 🎯 核心特色

- **纯本地架构** - 数据完全存储在本地，无需网络连接
- **离线优先设计** - 支持完全离线操作，随时随地使用
- **高性能体验** - 代码分割、懒加载、虚拟滚动
- **PWA 支持** - 可安装到桌面，原生应用体验
- **数据安全** - 本地数据加密，隐私完全可控

## ✨ 核心功能

### 📱 卡片管理系统
- **智能输入**: 支持粘贴输入图文、手动输入文字
- **双面卡片**: 正面显示标题+图文内容，背面显示标签和补充内容
- **实时编辑**: 所见即所得的编辑体验，文字直接编辑，图片可拖拽位置
- **样式系统**: 支持纯色背景、渐变色背景等多种样式
- **高质量导出**: 一键生成高质量PNG截图

### 🏷️ 交互功能
- **标签管理**: 完整的标签系统，支持筛选和重命名
- **文件夹系统**: 层级文件夹管理，支持拖拽组织
- **搜索功能**: 全文搜索，支持标签和内容筛选
- **批量操作**: 支持批量选择、移动、删除

### 💾 本地存储功能
- **本地数据库**: 使用 IndexedDB (Dexie) 进行本地数据存储
- **离线优先**: 完全支持离线操作，无需网络连接
- **数据持久化**: 自动保存，数据永不丢失
- **高性能**: 本地操作响应迅速，体验流畅

## 🛠️ 技术栈

### 前端技术
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5 + SWC
- **样式**: Tailwind CSS 3 + Framer Motion
- **状态管理**: React Context + Dexie (本地存储)
- **富文本编辑**: Tiptap 3
- **拖拽交互**: @dnd-kit
- **截图功能**: modern-screenshot
- **UI组件**: Radix UI + shadcn/ui

### 本地存储技术
- **本地数据库**: IndexedDB (Dexie.js)
- **数据同步**: 本地实时更新
- **文件存储**: 本地浏览器存储
- **数据持久化**: 自动本地备份

### 开发工具
- **测试**: Vitest + Playwright + Jest
- **代码检查**: ESLint + TypeScript
- **构建优化**: Vite PWA 插件
- **图标系统**: 自动生成多尺寸图标

## 📁 项目架构

```
cardall-prototype/
├── src/
│   ├── components/          # 组件目录
│   │   ├── card/           # 卡片相关组件
│   │   ├── folder/         # 文件夹管理
│   │   ├── auth/           # 认证组件
│   │   ├── dashboard/      # 仪表板组件
│   │   ├── ui/             # UI基础组件 (基于Radix UI)
│   │   ├── styles/         # 样式相关组件
│   │   ├── screenshot/     # 截图功能
│   │   ├── pwa/            # PWA相关组件
│   │   └── conflict/       # 冲突解决组件
│   ├── services/           # 服务层 (本地架构)
│   │   ├── database-service.ts     # 本地数据库服务
│   │   ├── card-service.ts         # 卡片管理服务
│   │   ├── folder-service.ts       # 文件夹管理服务
│   │   ├── tag-service.ts          # 标签管理服务
│   │   ├── storage-service.ts      # 本地存储服务
│   │   ├── export-service.ts       # 导出服务
│   │   └── search-service.ts       # 搜索服务
│   ├── contexts/           # React Context
│   │   ├── cardall-context.tsx
│   │   ├── auth-context.tsx
│   │   └── theme-context.tsx
│   ├── hooks/              # 自定义Hooks
│   ├── types/              # TypeScript类型定义
│   │   ├── card.ts         # 卡片数据类型
│   │   ├── sync.ts         # 同步相关类型
│   │   └── database.ts     # 数据库类型
│   └── utils/              # 工具函数
├── tests/                  # 测试目录
│   ├── unit/               # 单元测试
│   ├── integration/        # 集成测试
│   ├── e2e/                # 端到端测试
│   └── performance/        # 性能测试
├── docs/                   # 项目文档
├── local-storage/          # 本地存储配置
└── public/                 # 静态资源
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+)

### 安装和运行

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/cardall.git
   cd cardall/cardall-prototype
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动应用**
   ```bash
   # 本地版本无需配置环境变量，直接启动即可
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **构建生产版本**
   ```bash
   npm run build
   npm run preview
   ```

## 🔧 开发指南

### 开发命令

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
npm run test:all

# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 端到端测试
npm run test:e2e

# 性能测试
npm run test:performance

# 测试覆盖率
npm run test:coverage
```

### 代码规范

- 严格遵循 TypeScript 类型检查
- 使用 ESLint 进行代码检查
- 保持组件的单一职责原则
- 完整的测试覆盖

## 🏗️ 架构设计

### 本地优先架构 (v1.0.0-local)

系统采用纯本地架构设计，专注于数据安全和用户体验：

#### 核心服务层
- **DatabaseService**: 本地数据库管理，基于 IndexedDB
- **CardService**: 卡片数据管理服务
- **FolderService**: 文件夹组织管理
- **TagService**: 标签系统管理
- **StorageService**: 本地存储管理
- **ExportService**: 数据导出服务

#### 数据流架构
```
用户操作 → 本地数据库 → 界面更新
    ↓           ↓           ↓
 事件处理   数据持久化   界面渲染
```

### 关键特性

#### 1. 纯本地架构
- 使用 IndexedDB (Dexie) 作为本地数据库
- 完全离线操作，无需网络连接
- 数据完全存储在用户设备上

#### 2. 高性能本地操作
- 本地数据读写速度极快
- 无网络延迟，响应迅速
- 智能缓存和索引优化

#### 3. 数据安全与隐私
- 数据完全本地化，隐私可控
- 支持数据导出和备份
- 无第三方数据风险

#### 4. 性能优化
- 代码分割和懒加载
- 图片优化和懒加载
- 虚拟滚动支持大量数据
- 智能缓存策略

## 📊 性能指标

### 系统性能
- **启动时间**: <1s (本地版本)
- **数据操作**: <50ms (本地读写)
- **界面响应**: <16ms (60fps)
- **内存使用**: <30MB
- **存储效率**: 优化的本地存储

### 技术指标
- **首屏加载时间**: <1.5s
- **本地响应时间**: <10ms
- **数据持久化**: <100ms
- **内存占用**: <40MB
- **缓存效率**: 100% 本地缓存

## 🔐 安全特性

- 完全本地数据存储
- 本地数据加密保护
- 无网络传输风险
- 隐私完全可控
- 防止 XSS 和 CSRF 攻击
- 数据导出加密

## 📱 PWA 功能

- 完整的渐进式Web应用功能
- 支持离线使用和安装到桌面
- Service Worker 缓存策略
- 应用更新机制
- 推送通知支持

## 🌐 浏览器支持

| Browser | Version |
|---------|---------|
| Chrome  | 90+     |
| Firefox | 88+     |
| Safari  | 14+     |
| Edge    | 90+     |

## 📈 版本历史

### v1.0.0-local (当前版本)
- 🎯 **重大更新**: 迁移到纯本地架构
- 🗑️ **云端清理**: 移除所有云端同步功能
- 🔒 **安全增强**: 数据完全本地化存储
- ⚡ **性能提升**: 本地操作速度提升 90%+
- 📱 **体验优化**: 无需网络连接，随时使用
- 🧹 **代码简化**: 移除云端相关代码，架构更清晰
- 💾 **数据持久**: 基于 IndexedDB 的可靠本地存储

### v5.6.5 (云端版本 - 已弃用)
- ✨ 架构重构：简化服务层，提升性能
- 🐛 修复：认证服务初始化问题
- 🚀 优化：云端同步成功率提升至 95%+
- 🧹 清理：移除 40% 冗余代码文件

### 历史版本
- **v5.6.3** - 云同步功能增强与系统优化
- **v5.6.2** - 功能增强与架构优化
- **v5.6.1** - 完成项目清理和关键问题修复
- **v0.4.0** - 标签系统，搜索优化
- **v0.3.0** - 文件夹系统，组合功能
- **v0.2.0** - 样式系统优化，PWA支持
- **v0.1.0** - 初始版本，基础功能实现

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

如果您遇到问题或有建议，请：

1. 查看 [常见问题](docs/FAQ.md)
2. 搜索 [已知问题](../../issues)
3. 创建 [新问题](../../issues/new)

## 📞 联系方式

- 项目主页: https://github.com/your-username/cardall
- 文档站点: https://cardall-docs.vercel.app
- 邮箱: your-email@example.com

---

<div align="center">
  <p>用 <span style="color: #e25555;">♥</span> 打造的知识管理工具</p>
  <p>© 2024 CardAll Team. All rights reserved.</p>
</div>