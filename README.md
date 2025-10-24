# CardAll - 知识卡片管理平台

一个现代化的知识卡片管理系统，专注于图文内容的结构化展示与管理。

## 🎯 项目简介

CardAll 是一个专为知识管理而设计的卡片式平台，支持图文混排、实时编辑、智能分类和灵活的卡片组合。采用现代化的技术栈，提供优雅的用户体验和强大的功能。

## ✨ 核心功能

### 📋 卡片管理
- **智能输入**: 支持粘贴输入图文、手动输入文字
- **双面卡片**: 正面展示标题+图文内容，背面显示标签和补充内容
- **实时编辑**: 所见即所得的编辑体验，文字直接编辑，图片可拖拽位置
- **样式选择**: 支持纯色背景和渐变色背景等多种样式
- **高质量导出**: 一键生成高质量PNG截图

### 🔍 智能搜索与筛选
- **关键词搜索**: 快速定位目标卡片
- **标签筛选**: 通过标签系统精准筛选内容
- **分类管理**: 支持文件夹分类管理
- **组合管理**: 组合卡片支持统一复制和截图


## 🛠 技术栈

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

### 部署与构建
- **PWA支持**: 完整的渐进式Web应用功能
- **构建优化**: Vite构建优化
- **图标系统**: 自动生成多尺寸图标

## 🚀 快速开始

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

## 📁 项目结构

```
cardall-prototype/
├── src/
│   ├── components/          # 组件目录
│   │   ├── card/           # 卡片相关组件
│   │   ├── folder/         # 文件夹管理
│   │   ├── tag/            # 标签系统
│   │   ├── screenshot/     # 截图功能
│   │   └── ui/             # UI基础组件
│   ├── contexts/           # React Context
│   ├── hooks/              # 自定义Hooks
│   ├── services/           # 服务层
│   ├── types/              # TypeScript类型定义
│   └── utils/              # 工具函数
├── docs/                   # 项目文档
└── supabase/              # 数据库迁移文件
```

## 🔧 配置说明

### 环境变量
创建 `.env` 文件并配置以下变量：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 数据库设置
参考 `docs/supabase-setup.md` 进行数据库配置

## 📱 功能演示

### 卡片创建与编辑
- 支持多种输入方式（粘贴、手动输入）
- 实时预览编辑效果
- 图文混排完美支持

### 卡片管理
- 最新卡片优先显示
- 拖拽排序和组合
- 磁力吸附功能
- 文件夹分类管理

### 样式系统
- 多种预设样式可选
- 响应式设计
- 明暗主题切换

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙋‍♂️ 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 [Issues](https://github.com/your-username/cardall-prototype/issues)
- 发送邮件到: your-email@example.com

## 🔄 版本历史

- **v0.1.0** - 初始版本，基础功能实现
- **v0.2.0** - 样式系统优化，PWA支持
- **v0.3.0** - 文件夹系统，组合功能
- **v0.4.0** - 标签系统，搜索优化

---

⭐ 如果这个项目对你有帮助，请给个星标支持一下！