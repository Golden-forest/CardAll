# CardAll 降级重构 - 快速开始指南

**版本**: 1.0.0 (降级重构版)
**日期**: 2025-01-19
**目标**: 将现有的功能完整的CardAll网站降级为稳定的本地离线版本

## 🎯 项目背景

**为什么需要降级？**
- 云端同步功能存在持续bug，无法稳定工作
- 多次开发尝试后，同步问题依然存在
- 需要先建立稳定的基础版本，再重新设计云端功能

**降级策略**：
- 保留所有现有的UI功能和交互
- 移除有问题的云端同步代码
- 建立纯本地化的数据存储
- 增强本地备份和恢复功能

## 📋 系统要求

### 浏览器支持
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

### 功能要求
- IndexedDB 支持
- File API 支持
- Web Workers 支持
- Service Workers 支持（用于PWA功能）

## 🚀 快速开始

### 第一步：数据备份 (重要！)

**在开始清理之前，请务必备份现有数据**

```bash
# 进入项目目录
cd cardall-prototype

# 启动开发服务器
npm run dev

# 在浏览器中访问应用
# http://localhost:5173

# 导出所有数据
# 使用应用内的导出功能
# 或者使用开发者工具 → Application → Storage → IndexedDB → 导出数据
```

### 第二步：降级实施

```bash
# 1. 切换到降级分支
git checkout 006-

# 2. 执行清理任务
npm run cleanup:cloud

# 3. 重新安装依赖
npm install

# 4. 启动本地版本
npm run dev
```

### 第三步：功能验证

```bash
# 运行功能测试
npm run test:local

# 启动开发服务器
npm run dev

# 验证核心功能：
# ✅ 卡片创建和编辑
# ✅ 文件夹管理
# ✅ 标签系统
# ✅ 图片上传
# ✅ 搜索功能
# ✅ 数据导入导出
```

## 🔧 手动清理清单

如果自动清理失败，可以手动执行以下步骤：

### 1. 删除云端相关文件

```bash
# 删除同步组件
rm -rf src/components/sync/
rm -rf src/components/auth/
rm -rf src/components/monitor/

# 删除云端服务
rm src/services/supabase.ts
rm src/services/auth.ts
rm src/services/sync-*.ts
rm src/services/cloud-*.ts

# 删除云端上下文
rm src/contexts/sync-context.tsx
rm src/contexts/auth-context.tsx
```

### 2. 清理依赖

```bash
# 移除Supabase相关依赖
npm uninstall @supabase/supabase-js
npm uninstall @supabase/realtime-js

# 保留的依赖：
# - dexie (本地数据库)
# - react (核心框架)
# - vite (构建工具)
# - @tiptap/react (富文本)
# - @dnd-kit/core (拖拽)
# - radix-ui (UI组件)
```

### 3. 更新代码引用

```typescript
// 移除Supabase导入
// ❌ 删除这行
// import { supabase } from './services/supabase'

// 移除同步相关导入
// ❌ 删除这些导入
// import { SyncService } from './services/sync-service'
// import { useSync } from './hooks/use-sync'

// 更新数据库导入
import { db } from './services/database'; // 现在这是纯本地数据库
```

## 📊 数据模型变更对比

### 卡片实体变更

**移除的字段**：
```typescript
// ❌ 删除这些字段
supabaseId?: string;
syncStatus: 'synced' | 'pending' | 'error' | 'conflict';
lastSyncAt?: Date;
conflictResolution?: 'local' | 'remote' | 'manual';
remoteVersion?: number;
```

**保留的字段**：
```typescript
// ✅ 保留这些字段
id: string;
title: string;
content: string;
backContent?: string;
contentType: 'text' | 'richtext';
folderId?: string;
tags: string[];
images: string[];
style: CardStyle;
createdAt: Date;
updatedAt: Date;
version: number;
isArchived: boolean;
isFavorite: boolean;
viewCount: number;
searchText: string;
```

## 🧪 本地存储功能

### 1. 数据备份

```typescript
// 手动备份
const createBackup = async (name: string) => {
  const backupData = await collectAllData();
  const backup = {
    id: generateUUID(),
    name,
    data: backupData,
    createdAt: new Date(),
    size: JSON.stringify(backupData).length
  };

  await db.backups.add(backup);
  console.log(`备份创建成功: ${name}`);
};

// 自动备份（每24小时）
setupAutoBackup();
```

### 2. 数据恢复

```typescript
// 从备份恢复
const restoreFromBackup = async (backupId: string) => {
  const backup = await db.backups.get(backupId);
  if (!backup) {
    throw new Error('备份不存在');
  }

  // 恢复所有数据
  await restoreAllData(backup.data);
  console.log(`恢复完成: ${backup.name}`);
};
```

### 3. 数据完整性检查

```typescript
// 运行完整性检查
const runIntegrityCheck = async () => {
  const check = await db.integrityChecks.add({
    checkType: 'full',
    status: 'running',
    startedAt: new Date()
  });

  // 检查结果将自动记录
  console.log('数据完整性检查已启动');
};
```

## 🔍 本地功能特性

### 1. 搜索功能

```typescript
// 本地全文搜索
const searchCards = async (query: string) => {
  return await db.cards
    .where('searchText')
    .startsWithIgnoreCase(query)
    .limit(50)
    .toArray();
};

// 高级搜索
const advancedSearch = async (options: {
  query: string;
  folderId?: string;
  tags?: string[];
  dateRange?: { start: Date; end: Date };
}) => {
  let query = db.cards.toCollection();

  // 应用过滤条件
  if (options.folderId) {
    query = query.filter(card => card.folderId === options.folderId);
  }

  if (options.tags && options.tags.length > 0) {
    query = query.filter(card =>
      options.tags.some(tag => card.tags.includes(tag))
    );
  }

  return await query.toArray();
};
```

### 2. 批量操作

```typescript
// 批量移动卡片
const moveCardsToFolder = async (cardIds: string[], targetFolderId: string) => {
  return await db.transaction('rw', db.cards, db.folders, async () => {
    for (const cardId of cardIds) {
      const card = await db.cards.get(cardId);
      if (card) {
        card.folderId = targetFolderId;
        await db.cards.put(card);
      }
    }
  });
};

// 批量添加标签
const addTagsToCards = async (cardIds: string[], tagIds: string[]) => {
  return await db.transaction('rw', db.cards, db.tags, async () => {
    for (const cardId of cardIds) {
      const card = await db.cards.get(cardId);
      if (card) {
        card.tags = [...new Set([...card.tags, ...tagIds])];
        await db.cards.put(card);
      }
    }
  });
};
```

### 3. 数据导入导出

```typescript
// 导出为JSON
const exportData = async () => {
  const data = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    data: {
      cards: await db.cards.toArray(),
      folders: await db.folders.toArray(),
      tags: await db.tags.toArray(),
      images: await getImagesAsBase64(),
      settings: await db.settings.toArray()
    }
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cardall-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  return data;
};

// 从JSON导入
const importData = async (file: File) => {
  const data = JSON.parse(await file.text());

  // 验证数据格式
  if (!data.version || !data.data) {
    throw new Error('无效的备份文件格式');
  }

  // 清空现有数据
  await clearAllData();

  // 导入数据
  await db.transaction('rw', db.cards, db.folders, db.tags, db.images, db.settings, async () => {
    await db.cards.bulkAdd(data.data.cards);
    await db.folders.bulkAdd(data.data.folders);
    await db.tags.bulkAdd(data.data.tags);

    // 恢复图片
    for (const imageData of data.data.images) {
      const image = {
        id: imageData.id,
        data: base64ToBlob(imageData.data),
        filename: imageData.metadata.filename,
        mimeType: imageData.metadata.mimeType,
        size: imageData.metadata.size,
        width: imageData.metadata.width,
        height: imageData.metadata.height,
        createdAt: new Date(),
        updatedAt: new Date(),
        cardUsageCount: 0
      };
      await db.images.add(image);
    }

    await db.settings.bulkAdd(data.data.settings);
  });

  console.log('数据导入完成');
};
```

## 🚨 性能优化

### 1. 索引策略

本地数据库已优化以下索引：
- `cards.title`: 标题搜索
- `cards.searchText`: 全文搜索
- `cards.tags`: 标签搜索（多条目索引）
- `cards.folderId`: 文件夹过滤
- `cards.createdAt`: 时间排序
- `cards.updatedAt`: 修改时间排序

### 2. 查询优化

```typescript
// 使用索引的查询
const getCardsByFolder = async (folderId: string) => {
  return await db.cards
    .where('folderId')
    .equals(folderId)
    .toArray();
};

// 分页查询
const getCardsPaginated = async (offset = 0, limit = 20) => {
  return await db.cards
    .orderBy('updatedAt', 'desc')
    .offset(offset)
    .limit(limit)
    .toArray();
};
```

### 3. 内存管理

```typescript
// 图片懒加载
const loadImageData = async (imageId: string) => {
  const image = await db.images.get(imageId);
  if (!image || image.isDeleted) {
    return null;
  }

  // 只在需要时加载完整数据
  return image.data;
};

// 定期清理
const cleanupDeletedData = async () => {
  const deletedImages = await db.images
    .where('isDeleted')
    .toArray();

  // 完全删除已标记为删除的图片
  for (const image of deletedImages) {
    await db.images.delete(image.id);
  }

  console.log(`清理了 ${deletedImages.length} 个已删除的图片`);
};
```

## 🐛 故障排除

### 常见问题

1. **数据迁移失败**
   ```bash
   # 检查IndexedDB支持
   if (!('indexedDB' in self)) {
     console.error('浏览器不支持IndexedDB');
   }

   # 检查存储配额
   if ('storage' in navigator && 'estimate' in navigator.storage) {
     const estimate = await navigator.storage.estimate();
     console.log('存储使用情况:', estimate);
   }
   ```

2. **搜索功能不工作**
   ```typescript
   // 检查搜索索引
   const testSearch = await searchCards('test');
   console.log('搜索测试结果:', testSearch.length);

   // 如果搜索为空，检查searchText字段
   const cards = await db.cards.toArray();
   console.log('卡片searchText示例:', cards[0]?.searchText);
   ```

3. **备份功能异常**
   ```typescript
   // 检查数据库版本
   console.log('数据库版本:', db.verno);

   // 检查备份表是否存在
   const backupCount = await db.backups.count();
   console.log('备份数量:', backupCount);
   ```

4. **性能问题**
   ```typescript
   // 监控数据库性能
   const startTime = performance.now();
   const cards = await db.cards.toArray();
   const endTime = performance.now();
   console.log(`查询${cards.length}张卡片耗时: ${endTime - startTime}ms`);
   ```

### 调试技巧

```typescript
// 开启调试模式
localStorage.setItem('cardall-debug', 'true');

// 查看数据库内容
await viewDatabaseContent();

// 运行数据完整性检查
await runIntegrityCheck();
```

## 📱 版本管理

### 版本标记策略

```typescript
// 应用版本号
const APP_VERSION = '1.0.0-local';

// 数据版本号
const DATA_VERSION = '1.0.0';

// 在应用启动时显示版本信息
console.log(`CardAll 本地版本 v${APP_VERSION}`);
console.log(`数据版本 v${DATA_VERSION}`);
```

### 更新日志格式

```
## 版本 1.0.0-local (2025-01-19)
### 降级重构版本
- 移除所有云端同步功能
- 保留完整的本地功能
- 增强本地备份系统
- 优化性能和稳定性

### 已移除的功能
- Supabase云端同步
- 用户认证系统
- 实时同步状态
- 云端冲突解决
```

## 🎯 下一步规划

### 短期目标（1-2周）
1. **稳定运行**: 监控本地版本稳定性
2. **用户反馈**: 收集使用体验反馈
3. **问题修复**: 快速修复发现的问题

### 中期目标（1-2月）
1. **功能增强**: 基于反馈增强本地功能
2. **性能优化**: 优化本地存储性能
3. **新功能**: 添加本地特有功能

### 长期目标（3-6月）
1. **云端重新设计**: 重新设计云端同步架构
2. **分阶段实施**: 逐步重新实现云端功能
3. **版本合并**: 合并本地和云端版本

## 🆘 帮用快捷键

### 数据管理
- `Ctrl+S`: 保存当前卡片
- `Ctrl+E`: 导出所有数据
- `Ctrl+I`: 导入数据文件
- `Ctrl+Shift+C`: 清理已删除数据

### 导航快捷键
- `Ctrl+/`: 全局搜索
- `Ctrl+N`: 新建卡片
- `Ctrl+F`: 查找卡片
- `Ctrl+D`: 删除当前卡片

### 视图快捷键
- `Esc`: 退出编辑模式
- `Ctrl+Z`: 撤销操作
- `Ctrl+Y`: 重做操作
- `Ctrl+B`: 添加书签
- `F11`: 全屏模式

---

**降级重构完成！** 🎉

您现在拥有一个稳定、快速、功能完整的本地离线版本CardAll应用。所有核心功能都已保留，移除了有问题的云端同步功能，为未来的功能重构奠定了坚实基础。

**重要提醒**:
- 定期备份数据
- 保存好原始代码备份
- 记录使用中发现的问题

**需要帮助？** 查看完整的故障排除指南或联系技术支持。
