# CardAll 快速部署命令

## 前置条件
1. 确保已安装 Vercel CLI
2. 已登录到 Vercel 账户
3. 代码已推送到 GitHub

## 命令行部署步骤

### 1. 安装 Vercel CLI (如果未安装)
```bash
npm install -g vercel
```

### 2. 登录 Vercel
```bash
npx vercel login
```

### 3. 链接到团队项目
```bash
npx vercel link --team goldenforests-projects
```

### 4. 设置环境变量
```bash
# 设置生产环境变量
npx vercel env add VITE_APP_NAME production
# 输入: CardAll

npx vercel env add VITE_APP_VERSION production
# 输入: 5.7.6

npx vercel env add VITE_APP_ENVIRONMENT production
# 输入: production

npx vercel env add VITE_ENABLE_DEBUG_MODE production
# 输入: false
```

### 5. 执行部署
```bash
# 预览部署
npx vercel

# 生产部署
npx vercel --prod
```

### 6. 监控部署状态
```bash
# 查看部署列表
npx vercel ls

# 查看部署日志
npx vercel logs [deployment-url]
```

## Git 自动部署

项目已配置 Vercel Git 集成，推送代码即可自动部署：

```bash
# 推送到 main 分支触发生产部署
git push origin main

# 推送到其他分支触发预览部署
git push origin [branch-name]
```

## 环境变量管理

### 查看环境变量
```bash
npx vercel env ls
```

### 删除环境变量
```bash
npx vercel env rm [variable-name] production
```

### 更新环境变量
```bash
npx vercel env add [variable-name] production
# 重新输入新值
```

## 常用部署选项

### 预览部署 (Preview)
```bash
npx vercel
```

### 生产部署 (Production)
```bash
npx vercel --prod
```

### 指定构建目录
```bash
npx vercel --path cardall-prototype
```

## 故障排除

### 清除缓存
```bash
npx vercel --force
```

### 重新构建
```bash
npx vercel --build-env ENV=value
```

### 查看详细日志
```bash
npx vercel --debug
```# Deployment Update - Sat, Oct 25, 2025  1:57:55 PM
