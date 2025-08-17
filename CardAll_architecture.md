# CardAll 技术架构文档

## 1. 架构概述

### 1.1 整体架构
CardAll采用现代化的前后端分离架构，基于React生态系统构建，确保高性能、可扩展性和良好的用户体验。

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用       │    │   后端API       │    │   数据存储       │
│                │    │                │    │                │
│  React + TS    │◄──►│  Node.js       │◄──►│  MongoDB       │
│  Shadcn UI     │    │  Express.js    │    │  Redis         │
│  Tailwind CSS  │    │  TypeScript    │    │  云存储         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 技术选型原则
- **成熟稳定**：选择经过验证的技术栈
- **开发效率**：优先考虑开发体验和效率
- **性能优先**：确保应用响应速度和用户体验
- **可扩展性**：支持未来功能扩展和性能优化
- **社区支持**：选择有活跃社区支持的技术

## 2. 前端架构

### 2.1 技术栈
```json
{
  "核心框架": "React 18.2+",
  "类型系统": "TypeScript 5.0+",
  "构建工具": "Vite 4.0+",
  "UI组件库": "Shadcn/ui",
  "样式方案": "Tailwind CSS 3.3+",
  "状态管理": "Zustand 4.0+",
  "路由管理": "React Router 6.8+",
  "动画库": "Framer Motion 10.0+",
  "图标库": "Lucide React",
  "工具库": "Lodash-es, Date-fns"
}
```

### 2.2 项目结构
```
src/
├── components/           # 可复用组件
│   ├── ui/              # 基础UI组件 (Shadcn)
│   ├── Card/            # 卡片相关组件
│   ├── Layout/          # 布局组件
│   ├── Modal/           # 模态框组件
│   └── Form/            # 表单组件
├── pages/               # 页面组件
│   ├── Dashboard/       # 主面板页面
│   ├── Auth/           # 认证页面
│   └── Settings/       # 设置页面
├── hooks/              # 自定义Hooks
│   ├── useCards.ts     # 卡片管理Hook
│   ├── useAuth.ts      # 认证Hook
│   └── useTheme.ts     # 主题Hook
├── stores/             # Zustand状态管理
│   ├── cardStore.ts    # 卡片状态
│   ├── authStore.ts    # 认证状态
│   └── uiStore.ts      # UI状态
├── services/           # API服务
│   ├── api.ts          # API配置
│   ├── cardService.ts  # 卡片服务
│   └── authService.ts  # 认证服务
├── utils/              # 工具函数
│   ├── helpers.ts      # 通用工具
│   ├── constants.ts    # 常量定义
│   └── validation.ts   # 验证函数
├── types/              # TypeScript类型定义
│   ├── card.ts         # 卡片类型
│   ├── user.ts         # 用户类型
│   └── api.ts          # API类型
└── styles/             # 样式文件
    ├── globals.css     # 全局样式
    └── components.css  # 组件样式
```

### 2.3 状态管理架构
```typescript
// 使用Zustand进行状态管理
interface CardStore {
  cards: Card[];
  selectedCards: string[];
  filters: FilterState;
  searchQuery: string;
  
  // Actions
  addCard: (card: Card) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  setFilters: (filters: FilterState) => void;
  setSearchQuery: (query: string) => void;
}
```

### 2.4 组件设计模式
- **原子设计**：Button, Input, Icon等基础组件
- **复合组件**：Card, Modal, Form等业务组件
- **容器组件**：Dashboard, CardGrid等页面级组件
- **高阶组件**：withAuth, withTheme等功能增强组件

## 3. 后端架构

### 3.1 技术栈
```json
{
  "运行时": "Node.js 18+",
  "框架": "Express.js 4.18+",
  "类型系统": "TypeScript 5.0+",
  "数据库": "MongoDB 6.0+",
  "缓存": "Redis 7.0+",
  "认证": "JWT + bcrypt",
  "文件存储": "Cloudinary/AWS S3",
  "API文档": "Swagger/OpenAPI",
  "测试框架": "Jest + Supertest",
  "代码质量": "ESLint + Prettier"
}
```

### 3.2 项目结构
```
server/
├── src/
│   ├── controllers/     # 控制器
│   │   ├── authController.ts
│   │   ├── cardController.ts
│   │   └── userController.ts
│   ├── models/         # 数据模型
│   │   ├── User.ts
│   │   ├── Card.ts
│   │   └── Tag.ts
│   ├── routes/         # 路由定义
│   │   ├── auth.ts
│   │   ├── cards.ts
│   │   └── users.ts
│   ├── middleware/     # 中间件
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   └── errorHandler.ts
│   ├── services/       # 业务逻辑
│   │   ├── cardService.ts
│   │   ├── authService.ts
│   │   └── uploadService.ts
│   ├── utils/          # 工具函数
│   │   ├── database.ts
│   │   ├── logger.ts
│   │   └── helpers.ts
│   └── types/          # 类型定义
│       ├── card.ts
│       ├── user.ts
│       └── api.ts
├── tests/              # 测试文件
├── docs/               # API文档
└── config/             # 配置文件
```

### 3.3 API设计规范
```typescript
// RESTful API设计
GET    /api/cards              # 获取卡片列表
POST   /api/cards              # 创建新卡片
GET    /api/cards/:id          # 获取单个卡片
PUT    /api/cards/:id          # 更新卡片
DELETE /api/cards/:id          # 删除卡片

GET    /api/cards/search       # 搜索卡片
GET    /api/cards/tags         # 获取标签列表
POST   /api/cards/:id/share    # 生成分享链接

POST   /api/auth/login         # 用户登录
POST   /api/auth/register      # 用户注册
POST   /api/auth/refresh       # 刷新Token
POST   /api/auth/logout        # 用户登出
```

### 3.4 数据库设计
```typescript
// MongoDB Schema设计
interface User {
  _id: ObjectId;
  email: string;
  password: string;
  username: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark';
    defaultCardStyle: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface Card {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  frontContent: {
    text?: string;
    images?: string[];
  };
  backContent: {
    text?: string;
    images?: string[];
  };
  style: {
    background: string;
    textColor: string;
    fontSize: number;
  };
  tags: string[];
  isBookmarked: boolean;
  shareId?: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## 4. 数据流架构

### 4.1 数据流向
```
用户操作 → 前端组件 → Zustand Store → API调用 → 后端处理 → 数据库操作 → 响应返回 → Store更新 → UI重渲染
```

### 4.2 状态同步策略
- **乐观更新**：立即更新UI，后台同步数据
- **错误回滚**：API失败时回滚到之前状态
- **实时同步**：WebSocket实现多端数据同步（可选）
- **离线支持**：Service Worker缓存关键数据

### 4.3 缓存策略
```typescript
// 前端缓存
- React Query: API数据缓存和同步
- LocalStorage: 用户偏好设置
- SessionStorage: 临时数据存储
- IndexedDB: 离线数据存储

// 后端缓存
- Redis: 会话数据和热点数据
- CDN: 静态资源缓存
- 数据库查询缓存: MongoDB缓存
```

## 5. 安全架构

### 5.1 认证授权
```typescript
// JWT Token策略
interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// 双Token机制
- Access Token: 短期有效(15分钟)
- Refresh Token: 长期有效(7天)
```

### 5.2 数据安全
- **输入验证**：前后端双重验证
- **SQL注入防护**：使用ORM/ODM
- **XSS防护**：内容转义和CSP策略
- **CSRF防护**：CSRF Token验证
- **文件上传安全**：类型检查和大小限制

### 5.3 API安全
```typescript
// 请求限制
- 速率限制: 每分钟100次请求
- 文件大小限制: 单文件最大10MB
- 请求体大小限制: 最大1MB
- CORS配置: 限制允许的域名
```

## 6. 性能架构

### 6.1 前端性能优化
```typescript
// 代码分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// 图片优化
- WebP格式优先
- 响应式图片
- 懒加载实现
- 图片压缩处理
```

### 6.2 后端性能优化
```typescript
// 数据库优化
- 索引优化: 为查询字段创建索引
- 聚合查询: 使用MongoDB聚合管道
- 分页查询: 避免一次性加载大量数据
- 连接池: 数据库连接复用
```

### 6.3 网络优化
- **HTTP/2**：多路复用和服务器推送
- **Gzip压缩**：减少传输数据大小
- **CDN加速**：静态资源全球分发
- **预加载**：关键资源预加载

## 7. 监控与日志

### 7.1 前端监控
```typescript
// 错误监控
- Sentry: 错误追踪和性能监控
- Google Analytics: 用户行为分析
- Web Vitals: 核心性能指标监控

// 性能监控
- FCP: 首次内容绘制
- LCP: 最大内容绘制
- FID: 首次输入延迟
- CLS: 累积布局偏移
```

### 7.2 后端监控
```typescript
// 应用监控
- Winston: 日志记录
- Morgan: HTTP请求日志
- PM2: 进程管理和监控
- New Relic: APM性能监控

// 基础设施监控
- 服务器资源监控
- 数据库性能监控
- API响应时间监控
- 错误率监控
```

## 8. 部署架构

### 8.1 部署环境
```yaml
# 开发环境
Development:
  Frontend: Vite Dev Server
  Backend: Node.js + Nodemon
  Database: Local MongoDB
  Storage: Local File System

# 测试环境
Staging:
  Frontend: Vercel Preview
  Backend: Railway Staging
  Database: MongoDB Atlas (Test)
  Storage: Cloudinary (Test)

# 生产环境
Production:
  Frontend: Vercel
  Backend: Railway
  Database: MongoDB Atlas
  Storage: Cloudinary
  CDN: Vercel Edge Network
```

### 8.2 CI/CD流程
```yaml
# GitHub Actions工作流
name: Deploy CardAll
on:
  push:
    branches: [main, develop]

jobs:
  test:
    - 代码质量检查
    - 单元测试执行
    - 集成测试执行
    
  build:
    - 前端构建
    - 后端构建
    - Docker镜像构建
    
  deploy:
    - 部署到测试环境
    - 自动化测试
    - 部署到生产环境
```

## 9. 扩展性设计

### 9.1 水平扩展
- **微服务架构**：按功能拆分服务
- **负载均衡**：多实例部署
- **数据库分片**：按用户ID分片
- **缓存集群**：Redis集群部署

### 9.2 功能扩展
```typescript
// 插件系统设计
interface Plugin {
  name: string;
  version: string;
  install: (app: Application) => void;
  uninstall: (app: Application) => void;
}

// 主题系统扩展
interface ThemePlugin extends Plugin {
  themes: Theme[];
  components: ComponentOverrides;
}
```

## 10. 技术债务管理

### 10.1 代码质量
- **ESLint规则**：严格的代码规范
- **Prettier格式化**：统一代码风格
- **TypeScript严格模式**：类型安全保证
- **代码审查**：Pull Request必须审查

### 10.2 测试策略
```typescript
// 测试金字塔
Unit Tests (70%):
  - 工具函数测试
  - 组件单元测试
  - API接口测试

Integration Tests (20%):
  - 组件集成测试
  - API集成测试
  - 数据库集成测试

E2E Tests (10%):
  - 关键用户流程测试
  - 跨浏览器兼容性测试
```

## 11. 风险评估与应对

### 11.1 技术风险
- **依赖更新风险**：定期更新和测试
- **性能瓶颈风险**：性能监控和优化
- **安全漏洞风险**：安全审计和修复
- **数据丢失风险**：备份和恢复策略

### 11.2 业务风险
- **用户增长风险**：可扩展架构设计
- **功能复杂度风险**：模块化设计
- **维护成本风险**：文档和测试完善

---

*本架构文档将随着项目发展持续更新和优化。*