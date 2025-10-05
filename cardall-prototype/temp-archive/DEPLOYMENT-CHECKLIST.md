# CardAll 部署清单和回滚程序

## 部署前准备

### 1. 环境验证
- [ ] Node.js 版本 18+ 确认
- [ ] npm 版本确认
- [ ] 构建环境清理
- [ ] 依赖项版本锁定

### 2. 代码验证
- [ ] Git 仓库状态清洁
- [ ] 所有测试通过（单元测试、集成测试、E2E测试）
- [ ] 构建成功验证
- [ ] 代码质量检查通过

### 3. 数据库验证
- [ ] Supabase 连接测试
- [ ] 数据库迁移验证
- [ ] 数据一致性检查
- [ ] 备份验证

### 4. 配置验证
- [ ] 环境变量配置
- [ ] 生产环境配置
- [ ] 安全配置检查
- [ ] 性能配置优化

## 部署步骤

### 阶段 1：预部署检查
```bash
# 1. 验证代码状态
git status
git pull origin main

# 2. 安装依赖
npm ci

# 3. 运行测试
npm run test:ci

# 4. 构建项目
npm run build

# 5. 验证构建结果
ls -la dist/
```

### 阶段 2：数据库部署
```bash
# 1. 应用数据库迁移
cd supabase/migrations
# 按顺序应用迁移文件

# 2. 验证数据库结构
npm run verify:database

# 3. 检查数据一致性
npm run verify:data:consistency
```

### 阶段 3：应用部署
```bash
# 1. 备份当前版本
cp -r dist/ dist-backup-$(date +%Y%m%d-%H%M%S)/

# 2. 部署新版本
cp -r dist/* /path/to/production/

# 3. 重启应用服务
pm2 restart cardall

# 4. 验证服务状态
pm2 status
curl -f https://your-domain.com/health
```

### 阶段 4：部署后验证
```bash
# 1. 健康检查
curl -f https://your-domain.com/health

# 2. 功能验证
npm run test:e2e:production

# 3. 性能验证
npm run test:performance:production

# 4. 监控确认
npm run verify:monitoring
```

## 回滚程序

### 回滚触发条件
- 部署后健康检查失败
- 关键功能测试失败
- 性能指标严重下降
- 错误率超过阈值
- 用户反馈严重问题

### 回滚步骤

### 阶段 1：快速回滚
```bash
# 1. 停止当前服务
pm2 stop cardall

# 2. 恢复备份版本
cp -r dist-backup-$(date +%Y%m%d-%H%M%S)/* /path/to/production/

# 3. 重启服务
pm2 start cardall

# 4. 验证恢复
curl -f https://your-domain.com/health
```

### 阶段 2：数据库回滚（如需要）
```bash
# 1. 恢复数据库备份
supabase db restore < backup-$(date +%Y%m%d-%H%M%S).sql

# 2. 验证数据一致性
npm run verify:data:consistency
```

### 阶段 3：回滚验证
```bash
# 1. 运行回归测试
npm run test:regression

# 2. 验证核心功能
npm run test:core:functionality

# 3. 监控确认
npm run verify:monitoring
```

## 监控和警报

### 部署监控指标
- 构建成功率
- 部署成功率
- 健康检查状态
- 错误率变化
- 性能指标变化

### 回滚监控指标
- 回滚触发次数
- 回滚成功率
- 服务恢复时间
- 用户影响范围

## 部署配置文件

### 生产环境配置
```env
# Supabase 配置
VITE_SUPABASE_URL=https://elwnpejlwkgdacaugvvd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_ACCESS_TOKEN=sbp_e95c8cedf56ad231cb00db4c2696b029c20cefda

# 应用配置
VITE_APP_NAME=CardAll
VITE_APP_VERSION=5.6.5
VITE_APP_ENVIRONMENT=production

# 性能配置
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ERROR_TRACKING=true
VITE_ENABLE_DEBUG_MODE=false
```

### 部署脚本
```bash
#!/bin/bash
# deploy.sh - 部署脚本

set -e

DEPLOY_DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="dist-backup-${DEPLOY_DATE}"

echo "🚀 开始部署 CardAll v5.6.5"

# 预部署检查
echo "📋 执行预部署检查..."
./scripts/pre-deploy-check.sh

# 构建应用
echo "🏗️ 构建应用..."
npm run build

# 备份当前版本
echo "💾 备份当前版本..."
mkdir -p "${BACKUP_DIR}"
cp -r dist/* "${BACKUP_DIR}/"

# 部署新版本
echo "📦 部署新版本..."
cp -r dist/* /path/to/production/

# 重启服务
echo "🔄 重启服务..."
pm2 restart cardall

# 部署后验证
echo "✅ 部署后验证..."
./scripts/post-deploy-verify.sh

echo "🎉 部署完成！"
```

### 回滚脚本
```bash
#!/bin/bash
# rollback.sh - 回滚脚本

set -e

if [ -z "$1" ]; then
    echo "❌ 请指定回滚版本"
    exit 1
fi

ROLLBACK_VERSION=$1
BACKUP_DIR="dist-backup-${ROLLBACK_VERSION}"

echo "🔄 开始回滚到版本 ${ROLLBACK_VERSION}"

# 检查备份是否存在
if [ ! -d "${BACKUP_DIR}" ]; then
    echo "❌ 备份版本 ${ROLLBACK_VERSION} 不存在"
    exit 1
fi

# 停止服务
echo "⏹️ 停止服务..."
pm2 stop cardall

# 恢复备份
echo "📂 恢复备份..."
cp -r "${BACKUP_DIR}"/* /path/to/production/

# 重启服务
echo "🚀 重启服务..."
pm2 start cardall

# 验证恢复
echo "✅ 验证恢复..."
./scripts/rollback-verify.sh

echo "🎉 回滚完成！"
```

## 风险评估

### 高风险项
1. **数据库迁移失败**
   - 影响：数据不一致
   - 缓解：完整备份 + 分步迁移

2. **同步服务中断**
   - 影响：用户数据不同步
   - 缓解：渐进式部署 + 回滚机制

3. **性能下降**
   - 影响：用户体验变差
   - 缓解：性能监控 + 自动回滚

### 中等风险项
1. **UI组件不兼容**
   - 影响：部分功能异常
   - 缓解：功能测试 + 特性开关

2. **依赖项冲突**
   - 影响：构建失败
   - 缓解：依赖锁定 + 测试环境

### 低风险项
1. **配置错误**
   - 影响：服务异常
   - 缓解：配置验证 + 环境测试

2. **网络问题**
   - 影响：部署延迟
   - 缓解：重试机制 + 超时控制

## 联系信息

### 紧急联系
- 技术负责人：[联系方式]
- 运维团队：[联系方式]
- 产品负责人：[联系方式]

### 问题报告
- 部署问题：[报告链接]
- Bug 报告：[报告链接]
- 用户反馈：[反馈链接]

---

**文档版本**: v1.0
**创建日期**: $(date +%Y-%m-%d)
**最后更新**: $(date +%Y-%m-%d)