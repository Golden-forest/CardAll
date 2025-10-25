# CardAll Vercel 部署指南

## 项目信息
- **项目名称**: CardAll - 知识卡片管理平台
- **GitHub仓库**: https://github.com/Golden-forest/CardAll
- **当前版本**: v5.7.6
- **团队账户**: GoldenForest's projects (goldenforests-projects)

## 部署步骤

### 1. 访问 Vercel 控制台
1. 打开浏览器，访问: https://vercel.com/goldenforests-projects
2. 确认已登录到正确的团队账户

### 2. 创建新项目
1. 点击 "Add New..." 按钮
2. 选择 "Project" 选项
3. 在 "Import Git Repository" 部分，找到并选择 `Golden-forest/CardAll` 仓库
4. 点击 "Import" 按钮

### 3. 配置项目设置
在项目配置页面，设置以下参数：

#### 基本设置
- **Project Name**: `cardall` (或自定义名称)
- **Framework**: `Vite` (应该自动检测)
- **Root Directory**: `cardall-prototype`

#### 构建设置
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

#### 环境变量 (Environment Variables)
点击 "Environment Variables" 部分添加以下变量：

**生产环境配置**:
```
VITE_APP_NAME = CardAll
VITE_APP_VERSION = 5.7.6
VITE_APP_ENVIRONMENT = production
VITE_ENABLE_DEBUG_MODE = false
```

**Supabase 配置** (如果需要):
```
VITE_SUPABASE_URL = [您的 Supabase URL]
VITE_SUPABASE_ANON_KEY = [您的 Supabase 匿名密钥]
VITE_SUPABASE_ACCESS_TOKEN = [您的 Supabase 访问令牌]
```

### 4. 部署配置
项目根目录已包含 `vercel.json` 配置文件，包含：
- 根目录设置
- 构建命令配置
- 静态资源缓存优化
- SPA 路由重写规则

### 5. 启动部署
1. 检查所有配置是否正确
2. 点击 "Deploy" 按钮
3. 等待构建过程完成

## 构建过程监控

### 成功构建标志
- 构建状态显示 "Ready"
- 无红色错误信息
- 构建时间通常在 2-5 分钟内

### 常见问题排查

#### 构建失败
1. 检查 Build Logs 中的错误信息
2. 确认 Node.js 版本兼容性 (推荐 18.x 或更高)
3. 检查依赖项安装是否成功

#### 部署后功能异常
1. 检查环境变量设置是否正确
2. 确认 Supabase 配置有效 (如果使用)
3. 检查浏览器控制台错误信息

## 部署后验证

### 基本功能检查
1. 访问部署后的 URL
2. 验证页面加载正常
3. 测试卡片创建功能
4. 测试卡片翻转功能
5. 测试标签管理功能
6. 测试搜索功能

### 性能检查
1. 检查页面加载速度
2. 测试响应式布局
3. 验证暗色/亮色模式切换

## 高级配置

### 自定义域名
1. 在项目设置中选择 "Domains"
2. 添加自定义域名
3. 配置 DNS 记录

### 边缘函数
如需添加边缘函数，可创建 `api` 目录：
```
cardall-prototype/api/
├── hello.ts
└── ...
```

### 环境特定配置
可在项目设置中为不同环境配置不同变量：
- **Production**: 生产环境
- **Preview**: 预览部署
- **Development**: 开发环境

## 维护和更新

### 自动部署
项目已配置 Git 集成，推送代码到 `main` 分支时会自动触发部署。

### 手动重新部署
1. 在 Vercel 控制台选择项目
2. 点击 "Deployments" 标签
3. 点击 "Redeploy" 按钮

### 回滚部署
1. 在部署历史中找到目标版本
2. 点击 "..." 菜单
3. 选择 "Promote to Production"

## 联系支持

如遇到部署问题，可：
1. 查看 Vercel 官方文档: https://vercel.com/docs
2. 检查项目 GitHub Issues
3. 联系 Vercel 技术支持

---

**部署完成后，请将最终的部署 URL 更新到项目文档中。**