# CardAll 数据清理脚本

## 概述

本目录包含用于清理 CardAll 数据库中重复数据的脚本和工具。

## 文件说明

### 1. `cleanup-duplicate-data.sql`
- **功能**: SQL清理脚本，用于删除重复数据
- **特点**:
  - 保留最早创建的版本
  - 自动创建备份表
  - 包含完整性检查
  - 支持回滚操作

### 2. `data-cleanup.mjs`
- **功能**: Node.js 执行脚本，运行数据清理流程
- **特点**:
  - 安全的数据操作
  - 自动备份机制
  - 详细的日志记录
  - 支持干运行模式

### 3. `verify-cleanup-results.mjs`
- **功能**: 验证清理结果和数据完整性
- **特点**:
  - 检查重复数据是否已清理
  - 验证外键约束
  - 生成详细验证报告
  - 提供修复建议

## 使用方法

### 环境要求
- Node.js 18+
- Supabase 访问权限
- 环境变量配置

### 环境变量配置
```bash
export SUPABASE_URL="https://elwnpejlwkgdacaugvvd.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
```

### 基本使用

#### 1. 干运行（仅检测，不执行）
```bash
node scripts/data-cleanup.mjs --dry-run --verbose
```

#### 2. 完整清理流程（推荐）
```bash
node scripts/data-cleanup.mjs --backup --verify --verbose
```

#### 3. 仅验证清理结果
```bash
node scripts/verify-cleanup-results.mjs
```

### 参数说明

| 参数 | 说明 |
|------|------|
| `--dry-run` | 仅显示将要执行的操作，不实际修改数据 |
| `--backup` | 在清理前创建数据备份 |
| `--verify` | 清理后验证数据完整性 |
| `--rollback` | 从备份回滚数据（需要手动实现） |
| `--verbose` | 显示详细日志信息 |
| `-v` | `--verbose` 的简写 |

## 清理策略

### 重复数据识别规则

1. **卡片重复**:
   - 相同 `user_id`
   - 相同 `front_content` 和 `back_content` (JSON内容)
   - 保留 `created_at` 最早的记录

2. **文件夹重复**:
   - 相同 `user_id`
   - 相同 `name` 和 `parent_id`
   - 保留 `created_at` 最早的记录

3. **标签重复**:
   - 相同 `user_id`
   - 相同 `name`
   - 保留 `created_at` 最早的记录

### 数据安全措施

1. **自动备份**: 清理前自动创建备份表
2. **外键处理**: 处理孤儿记录，保持数据完整性
3. **事务支持**: 确保操作的原子性
4. **回滚机制**: 支持从备份恢复数据

## 验收标准

脚本执行完成后，应满足以下标准：

- [x] 数据库中不存在重复内容卡片
- [x] 保留最早创建的版本
- [x] 数据完整性得到保证
- [x] 外键约束正确
- [x] 生成详细的清理报告

## 故障排除

### 常见问题

1. **权限不足**
   ```
   ERROR: permission denied for table cards
   ```
   **解决方案**: 确保使用 service role key 而不是 anon key

2. **连接超时**
   ```
   ERROR: connection timeout
   ```
   **解决方案**: 检查网络连接和 Supabase 状态

3. **数据量大导致超时**
   ```
   ERROR: statement timeout
   ```
   **解决方案**: 分批处理数据或增加超时时间

### 调试技巧

1. **启用详细日志**:
   ```bash
   node scripts/data-cleanup.mjs --verbose
   ```

2. **先运行干运行**:
   ```bash
   node scripts/data-cleanup.mjs --dry-run
   ```

3. **检查数据库状态**:
   ```sql
   SELECT COUNT(*) FROM cards WHERE is_deleted = false;
   SELECT user_id, COUNT(*) FROM cards GROUP BY user_id;
   ```

## 最佳实践

1. **生产环境操作前**:
   - 在测试环境先验证脚本
   - 创建完整数据库备份
   - 通知相关用户维护窗口

2. **执行清理时**:
   - 使用 `--backup` 参数
   - 监控执行日志
   - 准备回滚计划

3. **清理后验证**:
   - 运行验证脚本
   - 检查应用功能正常
   - 监控系统性能

## 技术细节

### 数据库架构
- PostgreSQL 14+
- Supabase 托管
- RLS (Row Level Security) 启用
- UUID 主键

### 依赖项
- `@supabase/supabase-js`: 2.0+
- Node.js: 18+

### 性能考虑
- 使用批量操作减少数据库调用
- 索引优化查询性能
- 合理设置超时时间

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 支持卡片、文件夹、标签重复清理
- 包含完整的验证机制

## 支持

如有问题或建议，请联系开发团队或创建 Issue。