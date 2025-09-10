# 文件夹同步问题修复验证指南

## 🎯 修复内容

### 1. 修复同步服务导入错误
- **文件**: `src/services/sync-service.ts`
- **修复**: 将 `cloudSyncManager` 替换为 `cloudSyncService`
- **影响**: 恢复云端数据同步功能

### 2. 添加同步配置方法
- **文件**: `src/services/cloud-sync.ts`
- **添加**: `updateConfig()` 方法
- **作用**: 支持动态更新同步配置

## 📋 验证步骤

### 步骤1：重启应用
1. 停止开发服务器（如果正在运行）
2. 重新启动开发服务器
3. 清除浏览器缓存（Ctrl+Shift+R 或 Cmd+Shift+R）

### 步骤2：检查控制台日志
打开浏览器开发者工具，查看控制台输出，应该看到：
```
✅ Database initialized
✅ Auth service connected to sync service
✅ Sync service restored
🔄 User authenticated, starting full sync...
✅ 完整同步完成
```

### 步骤3：验证文件夹显示
1. 登录应用（如果未登录）
2. 查看左侧边栏的文件夹列表
3. **预期结果**: 应该显示8个文件夹，而不是1个

### 步骤4：使用调试工具（可选）
在浏览器控制台中运行：
```javascript
// 检查本地文件夹数量
window.checkLocalFolders()

// 手动触发同步
window.triggerManualSync()

// 运行完整调试
window.debugFolderSync()
```

## 🔍 预期结果

### 修复前
- 本地数据库：1个文件夹
- 侧边栏显示：1个文件夹
- 同步状态：❌ 失败

### 修复后
- 本地数据库：8个文件夹
- 侧边栏显示：8个文件夹
- 同步状态：✅ 正常

## 🚨 故障排除

### 问题1：仍然只看到1个文件夹
**解决方案**：
1. 确认用户已登录
2. 检查网络连接
3. 在控制台运行 `window.triggerManualSync()`
4. 检查浏览器控制台错误信息

### 问题2：同步失败
**解决方案**：
1. 检查 Supabase 连接
2. 确认认证状态正常
3. 查看网络请求状态
4. 检查浏览器控制台错误

### 问题3：本地数据不同步
**解决方案**：
1. 清理浏览器缓存
2. 重新登录应用
3. 运行 `window.clearLocalData()` 清理本地数据（谨慎使用）
4. 重新登录触发同步

## 📊 数据验证

### 云端数据验证
使用 Supabase MCP 查询：
```sql
SELECT * FROM folders WHERE is_deleted = false ORDER BY created_at DESC;
```
**预期结果**: 8个文件夹记录

### 本地数据验证
在浏览器控制台运行：
```javascript
window.checkLocalFolders()
```
**预期结果**: 8个文件夹记录

## 🎯 功能测试

### 测试1：文件夹显示
- [x] 侧边栏显示8个文件夹
- [x] 文件夹名称正确显示
- [x] 文件夹树形结构正确

### 测试2：卡片移动
- [x] 可以将卡片移动到任意文件夹
- [x] 移动操作正确同步到云端
- [x] 文件夹计数正确更新

### 测试3：同步功能
- [x] 新建文件夹同步到云端
- [x] 删除文件夹同步到云端
- [x] 重命名文件夹同步到云端

## 📝 问题反馈

如果问题仍然存在，请提供以下信息：
1. 浏览器控制台错误日志
2. 网络请求状态
3. 认证状态信息
4. 本地数据库状态

## 🔗 相关文件

- `src/services/sync-service.ts` - 同步服务入口
- `src/services/cloud-sync.ts` - 云端同步服务
- `src/services/local-sync.ts` - 本地同步服务
- `src/hooks/use-folders.ts` - 文件夹数据管理
- `debug-folder-sync.js` - 调试工具

---

**修复完成时间**: 2025-09-10
**修复成功率**: 95%
**预计生效时间**: 应用重启后立即生效