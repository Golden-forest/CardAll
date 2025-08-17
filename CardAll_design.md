# CardAll 设计文档

## 1. 设计概述

### 1.1 设计理念
CardAll采用"简约而不简单"的设计理念，以Apple官网的设计风格为参考，追求简洁、优雅、一致的用户体验。通过精心设计的视觉层次和交互流程，让用户专注于内容本身。

### 1.2 设计原则
- **简约性**：界面元素精简，避免冗余
- **一致性**：统一的配色、字体、布局和交互模式
- **可用性**：直观的操作流程，降低学习成本
- **美观性**：精美的视觉效果，提升用户体验
- **响应性**：适配不同设备和屏幕尺寸

## 2. 视觉设计系统

### 2.1 色彩系统

#### 2.1.1 主色调
**暗色模式（默认）**
```css
--primary-bg: #1a1a1a          /* 主背景色 */
--secondary-bg: #2d2d2d        /* 次级背景色 */
--card-bg: #3a3a3a             /* 卡片背景色 */
--text-primary: #ffffff        /* 主要文字色 */
--text-secondary: #b3b3b3      /* 次要文字色 */
--accent: #007aff              /* 强调色（蓝色） */
--accent-hover: #0056cc        /* 强调色悬浮态 */
--border: #4a4a4a              /* 边框色 */
--shadow: rgba(0,0,0,0.3)      /* 阴影色 */
```

**亮色模式**
```css
--primary-bg: #ffffff          /* 主背景色 */
--secondary-bg: #f8f9fa        /* 次级背景色 */
--card-bg: #ffffff             /* 卡片背景色 */
--text-primary: #1a1a1a        /* 主要文字色 */
--text-secondary: #6c757d      /* 次要文字色 */
--accent: #007aff              /* 强调色（蓝色） */
--accent-hover: #0056cc        /* 强调色悬浮态 */
--border: #e9ecef              /* 边框色 */
--shadow: rgba(0,0,0,0.1)      /* 阴影色 */
```

#### 2.1.2 卡片样式色彩
**纯色背景样式**
- 经典白：#ffffff
- 优雅灰：#f5f5f7
- 深邃黑：#1d1d1f
- 温暖米：#faf0e6
- 清新蓝：#e3f2fd

**渐变色背景样式**
- 日出渐变：linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)
- 海洋渐变：linear-gradient(135deg, #667eea 0%, #764ba2 100%)
- 森林渐变：linear-gradient(135deg, #f093fb 0%, #f5576c 100%)
- 极光渐变：linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)
- 黄昏渐变：linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)

### 2.2 字体系统

#### 2.2.1 字体族
```css
--font-family-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
--font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
```

#### 2.2.2 字体规格
```css
/* 标题字体 */
--font-size-h1: 2.5rem;        /* 40px */
--font-size-h2: 2rem;          /* 32px */
--font-size-h3: 1.5rem;        /* 24px */
--font-size-h4: 1.25rem;       /* 20px */

/* 正文字体 */
--font-size-body: 1rem;        /* 16px */
--font-size-small: 0.875rem;   /* 14px */
--font-size-xs: 0.75rem;       /* 12px */

/* 字重 */
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### 2.3 间距系统
```css
--spacing-xs: 0.25rem;    /* 4px */
--spacing-sm: 0.5rem;     /* 8px */
--spacing-md: 1rem;       /* 16px */
--spacing-lg: 1.5rem;     /* 24px */
--spacing-xl: 2rem;       /* 32px */
--spacing-2xl: 3rem;      /* 48px */
--spacing-3xl: 4rem;      /* 64px */
```

### 2.4 圆角系统
```css
--radius-sm: 0.375rem;    /* 6px */
--radius-md: 0.5rem;      /* 8px */
--radius-lg: 0.75rem;     /* 12px */
--radius-xl: 1rem;        /* 16px */
--radius-2xl: 1.5rem;     /* 24px - 卡片主要圆角 */
--radius-full: 9999px;    /* 完全圆角 */
```

### 2.5 阴影系统
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-card: 0 8px 32px rgba(0, 0, 0, 0.12);  /* 卡片专用阴影 */
```

## 3. 组件设计规范

### 3.1 卡片组件设计

#### 3.1.1 卡片尺寸规范
```css
/* 卡片最小尺寸 */
--card-min-width: 280px;
--card-min-height: 200px;

/* 卡片最大尺寸 */
--card-max-width: 400px;
--card-max-height: 600px;

/* 卡片间距 */
--card-gap: 24px;

/* 卡片内边距 */
--card-padding: 24px;
```

#### 3.1.2 卡片结构设计
```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐ ⚙️  │  ← 功能按钮
│  │                         │    │
│  │        标题区域          │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │                         │    │
│  │      图片/内容区域       │    │
│  │                         │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │      文字内容区域        │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

#### 3.1.3 卡片状态设计
- **默认状态**：基础样式，微妙阴影
- **悬浮状态**：阴影加深，轻微上浮效果
- **选中状态**：边框高亮，强调色描边
- **编辑状态**：虚线边框，编辑指示器
- **翻转动画**：3D翻转效果，持续时间300ms

### 3.2 功能按钮设计

#### 3.2.1 功能按钮样式
```css
.function-button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.function-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}
```

#### 3.2.2 功能菜单设计
```
┌─────────────────┐
│  📋 复制文本     │
│  📸 截图保存     │
│  🔗 分享链接     │
│  🎨 样式选择     │
└─────────────────┘
```

### 3.3 输入组件设计

#### 3.3.1 文本输入框
- 无边框设计，底部线条指示
- 聚焦时线条颜色变为强调色
- 占位符文字使用次要文字色
- 支持多行文本自动扩展

#### 3.3.2 图片上传区域
- 虚线边框，拖拽提示
- 支持点击上传和拖拽上传
- 上传进度指示器
- 图片预览缩略图

### 3.4 导航组件设计

#### 3.4.1 顶部导航栏
```
┌─────────────────────────────────────────────────────────┐
│  CardAll    🔍 搜索框    🏷️ 标签  🌙 主题  ➕ 新建卡片   │
└─────────────────────────────────────────────────────────┘
```

#### 3.4.2 侧边栏（可选）
- 收起/展开功能
- 分类筛选器
- 标签管理器
- 收藏夹快捷入口

## 4. 交互设计规范

### 4.1 动画效果

#### 4.1.1 过渡动画
```css
/* 基础过渡 */
.transition-base {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 卡片翻转动画 */
.card-flip {
  transform-style: preserve-3d;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-flip.flipped {
  transform: rotateY(180deg);
}

/* 悬浮效果 */
.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
```

#### 4.1.2 加载动画
- 骨架屏加载效果
- 渐进式图片加载
- 微妙的脉冲动画

### 4.2 手势交互

#### 4.2.1 桌面端交互
- 鼠标悬浮：显示交互提示
- 右键菜单：快捷操作菜单
- 拖拽排序：实时位置预览
- 滚轮缩放：卡片大小调整

#### 4.2.2 移动端交互
- 长按：显示操作菜单
- 双击：卡片翻转
- 捏合：缩放操作
- 滑动：卡片切换

### 4.3 反馈机制

#### 4.3.1 视觉反馈
- 按钮点击：轻微缩放效果
- 操作成功：绿色提示条
- 操作失败：红色提示条
- 加载状态：进度指示器

#### 4.3.2 触觉反馈（移动端）
- 重要操作：轻微震动
- 成功操作：短促震动
- 错误操作：双重震动

## 5. 响应式设计

### 5.1 断点设计
```css
/* 移动端 */
@media (max-width: 767px) {
  --card-min-width: 100%;
  --card-gap: 16px;
  --card-padding: 16px;
}

/* 平板端 */
@media (min-width: 768px) and (max-width: 1023px) {
  --card-min-width: calc(50% - 12px);
  --card-gap: 20px;
  --card-padding: 20px;
}

/* 桌面端 */
@media (min-width: 1024px) {
  --card-min-width: 280px;
  --card-gap: 24px;
  --card-padding: 24px;
}
```

### 5.2 布局适配

#### 5.2.1 移动端布局
- 单列卡片布局
- 底部固定操作栏
- 全屏编辑模式
- 手势导航支持

#### 5.2.2 平板端布局
- 双列卡片布局
- 侧边栏可收起
- 分屏编辑模式
- 触控优化

#### 5.2.3 桌面端布局
- 多列瀑布流布局
- 完整功能面板
- 键盘快捷键支持
- 精确鼠标交互

## 6. 可访问性设计

### 6.1 键盘导航
- Tab键顺序合理
- 焦点指示清晰
- 快捷键支持
- 跳过链接功能

### 6.2 屏幕阅读器支持
- 语义化HTML结构
- ARIA标签完整
- 图片alt文本
- 状态变化通知

### 6.3 视觉辅助
- 高对比度模式
- 字体大小调节
- 色盲友好设计
- 动画减弱选项

## 7. 设计资源

### 7.1 图标系统
推荐使用Lucide React图标库，保持图标风格一致性：

**功能图标**：
- 复制：Copy
- 截图：Camera
- 分享：Share2
- 样式：Palette
- 编辑：Edit3
- 删除：Trash2
- 收藏：Heart
- 搜索：Search
- 筛选：Filter
- 设置：Settings
- 主题切换：Sun/Moon

**状态图标**：
- 成功：CheckCircle
- 错误：XCircle
- 警告：AlertTriangle
- 信息：Info
- 加载：Loader2

### 7.2 设计资产
- 图标库：Lucide React
- 插图资源：Unsplash API
- 字体资源：系统字体栈
- 动画库：Framer Motion
- 样式工具：Tailwind CSS

### 7.3 设计工具
- 设计稿：Figma
- 原型工具：Figma/Framer
- 图标编辑：Figma
- 色彩管理：Coolors.co

## 8. 开发规范

### 8.1 CSS命名规范
采用BEM命名方法论：
```css
/* 块（Block） */
.card { }

/* 元素（Element） */
.card__title { }
.card__content { }
.card__actions { }

/* 修饰符（Modifier） */
.card--flipped { }
.card--editing { }
.card--selected { }
```

### 8.2 组件文件结构
```
src/
├── components/
│   ├── Card/
│   │   ├── Card.tsx
│   │   ├── Card.module.css
│   │   ├── Card.test.tsx
│   │   └── index.ts
│   └── ...
├── styles/
│   ├── globals.css
│   ├── variables.css
│   └── themes.css
└── ...
```

### 8.3 设计令牌管理
使用CSS自定义属性管理设计令牌：
```css
:root {
  /* 颜色令牌 */
  --color-primary: #007aff;
  --color-secondary: #6c757d;
  
  /* 间距令牌 */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  
  /* 字体令牌 */
  --font-size-base: 1rem;
  --font-weight-normal: 400;
  
  /* 圆角令牌 */
  --radius-sm: 0.375rem;
  --radius-lg: 0.75rem;
}
```

## 9. 性能优化设计

### 9.1 图片优化
- 响应式图片：使用srcset和sizes属性
- 懒加载：Intersection Observer API
- 格式优化：WebP格式优先，JPEG/PNG降级
- 压缩优化：自动压缩上传图片

### 9.2 动画性能
- 使用transform和opacity进行动画
- 避免触发重排和重绘的属性
- 使用will-change提示浏览器优化
- 合理使用requestAnimationFrame

### 9.3 渲染优化
- 虚拟滚动：大量卡片时使用
- 组件懒加载：React.lazy和Suspense
- 状态优化：避免不必要的重渲染
- 内存管理：及时清理事件监听器

## 10. 设计验收标准

### 10.1 视觉还原度
- 设计稿还原度 ≥ 95%
- 色彩准确度 ≥ 98%
- 字体渲染清晰度 ≥ 95%
- 间距精确度 ≥ 90%

### 10.2 交互体验
- 动画流畅度 ≥ 60fps
- 响应时间 ≤ 100ms
- 加载时间 ≤ 2s
- 操作成功率 ≥ 95%

### 10.3 兼容性测试
- 浏览器兼容性 ≥ 95%
- 设备适配性 ≥ 98%
- 屏幕分辨率支持 ≥ 90%
- 无障碍访问性 AA级标准

### 10.4 用户体验指标
- 任务完成率 ≥ 90%
- 用户满意度 ≥ 4.0/5.0
- 学习成本 ≤ 5分钟
- 错误率 ≤ 5%

## 11. 设计迭代计划

### 11.1 第一阶段：基础设计
- 完成核心组件设计
- 建立设计系统
- 实现基础交互
- 完成响应式适配

### 11.2 第二阶段：体验优化
- 优化动画效果
- 完善微交互
- 提升视觉细节
- 增强可访问性

### 11.3 第三阶段：高级功能
- 实现高级样式系统
- 添加个性化设置
- 优化性能表现
- 完善用户反馈

## 12. 设计交付物
- 🔄 CSS样式文件
- 🔄 组件代码模板
- 🔄 动画效果库
- 🔄 测试用例文档

---

*本设计文档将随着项目进展持续更新和完善。*
