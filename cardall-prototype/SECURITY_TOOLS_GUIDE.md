# CardAll 云端同步重构安全工具指南

## 概述

本套安全工具专为CardAll云端同步重构设计，提供完整的数据备份、系统监控、回滚和安全审计功能，确保重构过程的安全性和可追溯性。

## 🛡️ 安全工具架构

### 1. 数据备份机制 (`backup-tools/`)

#### `create-backup.mjs` - 项目完整备份
创建完整的项目备份，包括源代码、配置文件和环境数据。

**功能特性:**
- 完整的文件系统备份
- 环境配置备份
- IndexedDB数据导出脚本
- 自动校验和验证
- 恢复脚本生成

**使用方法:**
```bash
# 创建完整备份
node backup-tools/create-backup.mjs

# 或使用npm脚本
npm run backup:quick
```

#### `backup-supabase.mjs` - Supabase数据备份
专门备份Supabase云端数据库的结构和数据。

**功能特性:**
- 数据库表结构备份
- 完整数据导出
- 数据完整性报告
- RLS策略记录（需要service_role权限）
- 恢复脚本生成

**使用方法:**
```bash
# 备份Supabase数据
node backup-tools/backup-supabase.mjs

# 或使用npm脚本
npm run backup:supabase
```

### 2. 系统健康检查 (`monitoring-tools/`)

#### `health-check.mjs` - 系统健康检查
全面检查项目结构、依赖、构建系统和代码质量。

**检查项目:**
- 项目结构完整性
- 依赖状态和冲突
- 构建系统可用性
- 测试系统配置
- 代码质量指标
- 安全性检查
- 性能配置分析
- 配置文件完整性

**使用方法:**
```bash
# 执行健康检查
node monitoring-tools/health-check.mjs

# 或使用npm脚本
npm run monitor:health
```

#### `sync-monitor.mjs` - 同步服务监控
实时监控Supabase同步服务的状态和性能。

**监控指标:**
- 连接状态和延迟
- 数据库表可用性
- 数据完整性
- 查询性能分析
- 错误率统计

**使用方法:**
```bash
# 监控同步服务
node monitoring-tools/sync-monitor.mjs

# 或使用npm脚本
npm run monitor:sync
```

#### `refactor-monitor.mjs` - 重构过程监控
专门用于监控重构过程的完整性和安全性。

**功能特性:**
- 重构基线创建
- 文件变更追踪
- 检查点管理
- 里程碑记录
- 完整性验证
- 详细的变更报告

**使用方法:**
```bash
# 开始重构监控
node monitoring-tools/refactor-monitor.mjs monitor

# 创建检查点
node monitoring-tools/refactor-monitor.mjs checkpoint "检查点名称"

# 验证系统完整性
node monitoring-tools/refactor-monitor.mjs validate

# 生成重构报告
node monitoring-tools/refactor-monitor.mjs report
```

### 3. 回滚工具 (`rollback-tools/`)

#### `rollback-manager.mjs` - 综合回滚管理
提供完整的代码、配置和数据回滚功能。

**功能特性:**
- 恢复点创建和管理
- 快速回滚到最近状态
- 完整回滚到指定恢复点
- 紧急回滚程序
- 系统状态验证

**使用方法:**
```bash
# 创建恢复点
node rollback-tools/rollback-manager.mjs create-restore-point "恢复点名称"

# 快速回滚
node rollback-tools/rollback-manager.mjs quick-rollback

# 紧急回滚
node rollback-tools/rollback-manager.mjs emergency-rollback

# 列出恢复点
node rollback-tools/rollback-manager.mjs list-restore-points

# 验证系统状态
node rollback-tools/rollback-manager.mjs verify
```

#### `git-rollback.mjs` - Git专用回滚
专门处理Git相关的回滚操作。

**功能特性:**
- 分支切换和管理
- 提交重置和撤销
- 工作树清理
- Stash管理
- Cherry-pick操作

**使用方法:**
```bash
# 交互模式
node rollback-tools/git-rollback.mjs interactive

# 切换分支
node rollback-tools/git-rollback.mjs switch <branch-name>

# 重置到指定提交
node rollback-tools/git-rollback.mjs reset <commit-hash>

# 撤销提交
node rollback-tools/git-rollback.mjs revert <commit-hash>

# 清理工作树
node rollback-tools/git-rollback.mjs clean [--force]
```

### 4. 安全审计 (`security-audit/`)

#### `security-scan.mjs` - 安全扫描工具
全面的安全扫描，检测敏感数据泄露、依赖漏洞和代码安全问题。

**扫描项目:**
- 敏感数据泄露检测
- 依赖漏洞扫描
- 代码安全问题
- 配置安全检查
- 文件权限验证

**使用方法:**
```bash
# 执行安全扫描
node security-audit/security-scan.mjs

# 或使用npm脚本
npm run audit:security
```

## 🚀 快速开始

### 阶段1: 安全准备和监控建立

在开始重构之前，运行完整的安全准备流程：

```bash
# 执行阶段1完整安全准备
npm run security:phase1
```

这个命令将依次执行：
1. 环境准备和目录创建
2. 创建完整项目备份
3. 备份Supabase数据
4. 系统健康检查
5. 同步服务监控
6. 安全扫描
7. 创建重构基线

### 日常监控命令

```bash
# 创建恢复点
npm run security:restore-point "before-refactor"

# 系统健康检查
npm run security:health

# 同步服务监控
npm run security:monitor

# 创建重构检查点
npm run security:checkpoint "checkpoint-name"

# 验证系统完整性
npm run security:validate

# 安全扫描
npm run security:scan

# 查看当前状态
npm run security:status
```

### 紧急回滚命令

```bash
# 快速回滚到最近状态
npm run security:rollback

# 紧急回滚到安全状态
npm run security:emergency
```

## 📊 工具输出和报告

### 备份文件位置
- 项目备份: `.backups/backup-YYYY-MM-DDTHH-MM-SS-SSSZ/`
- Supabase备份: `.backups/supabase-backup-YYYY-MM-DDTHH-MM-SS-SSSZ/`
- 恢复点: `.backups/restore-points/`
- 重构快照: `.backups/refactor-snapshots/`
- 监控日志: `.backups/refactor-logs/`
- 安全报告: `.backups/security-reports/`

### 报告内容
1. **备份报告**: 包含文件清单、校验和、恢复脚本
2. **健康检查报告**: 系统状态评分、问题列表、改进建议
3. **同步监控报告**: 连接状态、性能指标、警告信息
4. **重构监控报告**: 变更追踪、完整性验证、里程碑记录
5. **安全扫描报告**: 漏洞列表、风险评估、修复建议

## 🔧 配置和自定义

### 监控配置
各工具的配置选项可以在脚本顶部的`config`对象中修改：

```javascript
// 示例：修改敏感数据检测模式
const sensitivePatterns = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  // 添加自定义模式
];
```

### 排除路径配置
```javascript
// 示例：修改扫描排除路径
const excludePatterns = [
  'node_modules/',
  '.git/',
  'dist/',
  // 添加自定义排除路径
];
```

## 📋 最佳实践

### 1. 重构前准备
- 运行 `npm run security:phase1` 建立安全基线
- 创建命名恢复点 `npm run security:restore-point "pre-refactor"`
- 执行完整安全扫描 `npm run audit:security`

### 2. 重构过程中
- 定期创建检查点 `npm run security:checkpoint`
- 频繁运行健康检查 `npm run security:health`
- 监控同步服务状态 `npm run security:monitor`

### 3. 遇到问题时
- 立即创建恢复点 `npm run security:restore-point "before-fix"`
- 运行完整性验证 `npm run security:validate`
- 根据问题严重程度选择回滚策略

### 4. 重构完成后
- 生成最终报告 `node monitoring-tools/refactor-monitor.mjs report`
- 执行最终安全扫描 `npm run audit:security`
- 创建完成恢复点 `npm run security:restore-point "post-refactor"`

## 🚨 紧急情况处理

### 系统完全损坏
```bash
# 立即执行紧急回滚
npm run security:emergency

# 这将：
# 1. 重置Git状态
# 2. 恢复默认配置
# 3. 重新安装依赖
```

### 数据同步问题
```bash
# 检查同步状态
npm run security:monitor

# 恢复到已知良好状态
npm run security:rollback
```

### 安全漏洞发现
```bash
# 立即安全扫描
npm run audit:security

# 查看详细报告
ls .backups/security-reports/
```

## 📞 故障排除

### 常见问题

**Q: 备份失败怎么办？**
A: 检查磁盘空间和文件权限，确保.backups目录可写。

**Q: 监控工具报错？**
A: 确保Node.js版本>=18，检查依赖是否正确安装。

**Q: 回滚不完整？**
A: 检查恢复点是否完整，验证Git状态。

**Q: 安全扫描误报？**
A: 可以在配置中调整敏感数据检测模式。

### 获取帮助
1. 查看工具日志：`.backups/refactor-logs/`
2. 运行状态检查：`npm run security:status`
3. 查看详细错误信息：每个工具都会输出详细的错误日志

## 📈 工具维护

### 更新和升级
- 定期检查依赖漏洞
- 更新安全扫描规则
- 备份工具配置

### 性能优化
- 清理旧的备份文件
- 压缩历史日志
- 优化扫描路径

---

**注意**: 这些工具专门为CardAll项目设计，使用前请仔细阅读文档并确保理解每个工具的功能和使用场景。在执行关键操作前，建议先在测试环境中验证。