# Data Model Design - 本地离线版本

**项目**: CardAll 本地离线版本
**日期**: 2025-01-19
**版本**: 1.0 (降级重构版)
**目标**: 简化现有数据模型，移除云端依赖

## 概述

本文档定义了CardAll本地离线版本的数据模型。基于现有功能完整的项目，进行最小化调整，移除所有云端同步相关字段和逻辑，保留核心本地功能。

## 核心实体调整

### 1. Card (卡片) - 简化版

**现有模型 (带云端字段)**:
```typescript
interface Card {
  id: string;
  title: string;
  content: string;
  backContent?: string;
  contentType: 'text' | 'richtext';

  // 组织结构
  folderId?: string;
  tags: string[];
  images: string[];

  // 样式设置
  style: CardStyle;

  // 元数据
  createdAt: Date;
  updatedAt: Date;
  version: number;

  // 状态信息
  isArchived: boolean;
  isFavorite: boolean;
  viewCount: number;

  // 云端相关字段 (需要移除)
  supabaseId?: string;
  syncStatus: 'synced' | 'pending' | 'error' | 'conflict';
  lastSyncAt?: Date;
  conflictResolution?: 'local' | 'remote' | 'manual';
  remoteVersion?: number;

  // 搜索索引
  searchText: string;
}
```

**本地化模型 (移除云端字段)**:
```typescript
interface Card {
  id: string;                    // 本地生成的UUID v4
  title: string;                 // 卡片标题，必填，1-200字符
  content: string;               // 正面内容，支持富文本
  backContent?: string;          // 背面内容，可选
  contentType: 'text' | 'richtext'; // 内容类型

  // 组织结构
  folderId?: string;             // 所属文件夹ID
  tags: string[];                // 标签数组
  images: string[];              // 关联图片ID数组

  // 样式设置
  style: CardStyle;              // 卡片样式配置

  // 元数据
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 最后修改时间
  version: number;               // 版本号，用于本地冲突检测

  // 状态信息
  isArchived: boolean;           // 是否归档
  isFavorite: boolean;           // 是否收藏
  viewCount: number;             // 查看次数

  // 本地搜索索引
  searchText: string;            // 全文搜索内容（衍生字段）
}
```

**移除的字段说明**:
- `supabaseId`: 云端数据库ID
- `syncStatus`: 同步状态
- `lastSyncAt`: 最后同步时间
- `conflictResolution`: 冲突解决策略
- `remoteVersion`: 远程版本号

### 2. Folder (文件夹) - 保持不变

```typescript
interface Folder {
  id: string;                    // UUID v4
  name: string;                  // 文件夹名称，必填，1-100字符
  description?: string;          // 描述，0-500字符
  color?: string;                // 颜色标识，十六进制格式

  // 层级结构
  parentId?: string;             // 父文件夹ID
  path: string;                  // 完整路径
  level: number;                 // 层级深度，0-10

  // 统计信息
  cardCount: number;             // 包含的卡片数量
  childFolderCount: number;      // 子文件夹数量

  // 元数据
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 最后修改时间

  // 状态信息
  isExpanded: boolean;           // UI状态：是否展开
  sortOrder: number;             // 排序权重
}
```

### 3. Tag (标签) - 保持不变

```typescript
interface Tag {
  id: string;                    // UUID v4
  name: string;                  // 标签名称，必填，1-50字符
  color?: string;                // 标签颜色
  description?: string;          // 标签描述

  // 统计信息
  usageCount: number;            // 使用次数
  lastUsedAt?: Date;             // 最后使用时间

  // 元数据
  createdAt: Date;               // 创建时间

  // 状态信息
  isSystem: boolean;             // 是否系统标签
  sortOrder: number;             // 排序权重
}
```

### 4. Image (图片) - 简化版

**现有模型**:
```typescript
interface Image {
  id: string;
  data: Blob;
  thumbnail?: Blob;
  filename: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  format: string;
  optimizedSize?: number;
  compressionRatio?: number;
  createdAt: Date;
  updatedAt: Date;
  cardUsageCount: number;
  lastUsedAt?: Date;
  isDeleted: boolean;

  // 云端相关字段 (需要移除)
  supabaseUrl?: string;
  cloudPath?: string;
  syncStatus: 'synced' | 'pending' | 'error';
}
```

**本地化模型**:
```typescript
interface Image {
  id: string;                    // UUID v4
  data: Blob;                    // 原始图片数据
  thumbnail?: Blob;              // 缩略图数据

  // 文件信息
  filename: string;              // 原始文件名，1-255字符
  mimeType: string;              // MIME类型
  size: number;                  // 文件大小（字节）

  // 图片信息
  width: number;                 // 宽度（像素）
  height: number;                // 高度（像素）
  format: string;                // 图片格式 (JPEG, PNG, WebP)

  // 优化信息
  optimizedSize?: number;        // 优化后大小
  compressionRatio?: number;     // 压缩比

  // 元数据
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 最后修改时间

  // 使用统计
  cardUsageCount: number;        // 被卡片使用次数
  lastUsedAt?: Date;             // 最后使用时间

  // 状态信息
  isDeleted: boolean;            // 软删除标记
}
```

### 5. Settings (设置) - 保持不变

```typescript
interface Setting {
  key: string;                   // 设置键名，唯一
  value: any;                    // 设置值，JSON序列化
  category: string;              // 设置分类
  description?: string;          // 设置描述
  defaultValue: any;             // 默认值
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  isUserCustomized: boolean;     // 是否用户自定义
  updatedAt: Date;               // 最后修改时间
}
```

## 本地化优化策略

### 1. 本地备份系统

新增备份实体：
```typescript
interface Backup {
  id: string;                    // UUID v4
  name: string;                  // 备份名称
  description?: string;          // 备份描述
  version: string;               // 备份版本

  // 备份内容
  data: BackupData;             // 备份数据

  // 备份信息
  createdAt: Date;               // 创建时间
  size: number;                  // 备份文件大小
  checksum: string;             // 数据校验和

  // 状态信息
  isAutoBackup: boolean;         // 是否自动备份
  isEncrypted: boolean;          // 是否加密
}

interface BackupData {
  version: string;
  exportedAt: string;
  metadata: {
    totalCards: number;
    totalImages: number;
    appVersion: string;
  };
  data: {
    cards: Card[];
    folders: Folder[];
    tags: Tag[];
    images: ImageBlobData[];
    settings: Setting[];
  };
}

interface ImageBlobData {
  id: string;
  data: string;                  // Base64编码的图片数据
  metadata: {
    filename: string;
    mimeType: string;
    size: number;
    width: number;
    height: number;
  };
}
```

### 2. 本地数据完整性验证

新增验证实体：
```typescript
interface DataIntegrityCheck {
  id: string;
  checkType: 'full' | 'incremental' | 'quick';
  status: 'running' | 'completed' | 'failed';

  // 检查结果
  results: IntegrityCheckResult[];

  // 检查信息
  startedAt: Date;
  completedAt?: Date;
  totalChecked: number;
  totalIssues: number;
  totalFixed: number;
}

interface IntegrityCheckResult {
  entityType: 'card' | 'folder' | 'tag' | 'image';
  entityId: string;
  issueType: 'missing_reference' | 'corrupted_data' | 'orphaned_record';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedAction: string;
  isFixed: boolean;
}
```

## 数据库结构 (IndexedDB)

### 简化的数据库模式

```typescript
const CARDALL_LOCAL_DB_SCHEMA = {
  version: 1,
  stores: {
    cards: {
      primaryKey: 'id',
      indexes: {
        title: 'title',
        folderId: 'folderId',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        tags: 'tags', // multi-entry index for tag search
        searchText: 'searchText', // for full-text search
        isArchived: 'isArchived',
        isFavorite: 'isFavorite'
      }
    },

    folders: {
      primaryKey: 'id',
      indexes: {
        parentId: 'parentId',
        path: 'path',
        level: 'level',
        sortOrder: 'sortOrder',
        createdAt: 'createdAt'
      }
    },

    tags: {
      primaryKey: 'id',
      indexes: {
        name: 'name', // unique
        usageCount: 'usageCount',
        lastUsedAt: 'lastUsedAt',
        sortOrder: 'sortOrder'
      }
    },

    images: {
      primaryKey: 'id',
      indexes: {
        filename: 'filename',
        mimeType: 'mimeType',
        size: 'size',
        createdAt: 'createdAt',
        cardUsageCount: 'cardUsageCount',
        isDeleted: 'isDeleted'
      }
    },

    settings: {
      primaryKey: 'key',
      indexes: {
        category: 'category',
        updatedAt: 'updatedAt'
      }
    },

    // 新增：本地备份
    backups: {
      primaryKey: 'id',
      indexes: {
        createdAt: 'createdAt',
        isAutoBackup: 'isAutoBackup',
        size: 'size'
      }
    },

    // 新增：数据完整性检查
    integrityChecks: {
      primaryKey: 'id',
      indexes: {
        checkType: 'checkType',
        status: 'status',
        startedAt: 'startedAt'
      }
    }
  }
};
```

## 数据迁移策略

### 从现有混合模式迁移

1. **保留现有 IndexedDB 数据**
   - 所有本地存储的数据保持不变
   - 仅移除云端相关的字段和索引

2. **清理云端相关字段**
   ```typescript
   // 迁移脚本示例
   const migrateCards = async () => {
     const cards = await db.cards.toArray();
     const migratedCards = cards.map(card => {
       const {
         supabaseId,
         syncStatus,
         lastSyncAt,
         conflictResolution,
         remoteVersion,
         ...cleanCard
       } = card;
       return cleanCard;
     });

     await db.cards.clear();
     await db.cards.bulkAdd(migratedCards);
   };
   ```

3. **数据完整性验证**
   - 检查外键引用完整性
   - 验证孤立记录
   - 确保数据一致性

## 性能优化

### 1. 索引优化

**保留的索引**:
- 卡片标题搜索索引
- 文件夹层级索引
- 标签使用索引
- 创建时间索引

**移除的索引**:
- 同步状态索引
- 云端ID索引
- 冲突解决索引

### 2. 查询优化

**本地化查询示例**:
```typescript
// 优化后的本地查询
const getCardsWithFolderAndTags = async (folderId?: string, tags?: string[]) => {
  let query = db.cards.toCollection();

  if (folderId) {
    query = query.filter(card => card.folderId === folderId);
  }

  if (tags && tags.length > 0) {
    query = query.filter(card =>
      tags.some(tag => card.tags.includes(tag))
    );
  }

  return await query.toArray();
};

// 本地全文搜索
const searchCards = async (searchText: string) => {
  return await db.cards
    .where('searchText')
    .startsWithIgnoreCase(searchText)
    .limit(50)
    .toArray();
};
```

## 数据完整性保证

### 1. 本地验证规则

```typescript
const validateCard = (card: Partial<Card>): ValidationResult => {
  const errors: string[] = [];

  // 基础验证
  if (!card.title || card.title.trim().length === 0) {
    errors.push('卡片标题是必需的');
  }

  if (card.title && card.title.length > 200) {
    errors.push('卡片标题不能超过200个字符');
  }

  // 本地化验证：移除云端相关验证
  // 不再验证 syncStatus, supabaseId 等字段

  // 引用完整性验证
  if (card.folderId) {
    // 验证文件夹是否存在
    // 这将在事务中进行验证
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
```

### 2. 事务完整性

```typescript
const createCardWithReferences = async (cardData: CreateCardRequest) => {
  return await db.transaction('rw', db.cards, db.folders, db.tags, async () => {
    // 验证文件夹存在
    if (cardData.folderId) {
      const folder = await db.folders.get(cardData.folderId);
      if (!folder) {
        throw new Error(`文件夹 ${cardData.folderId} 不存在`);
      }
    }

    // 验证标签存在
    if (cardData.tags && cardData.tags.length > 0) {
      for (const tagId of cardData.tags) {
        const tag = await db.tags.get(tagId);
        if (!tag) {
          throw new Error(`标签 ${tagId} 不存在`);
        }
      }
    }

    // 创建卡片
    const card = {
      ...cardData,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isArchived: false,
      isFavorite: false,
      viewCount: 0,
      searchText: generateSearchText(cardData)
    };

    return await db.cards.add(card);
  });
};
```

## 备份和恢复策略

### 1. 自动备份

```typescript
const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

const setupAutoBackup = () => {
  setInterval(async () => {
    try {
      const backup = await createAutoBackup();
      console.log('自动备份完成:', backup.name);
    } catch (error) {
      console.error('自动备份失败:', error);
    }
  }, AUTO_BACKUP_INTERVAL);
};
```

### 2. 手动备份

```typescript
const createManualBackup = async (name: string, description?: string) => {
  const backupData = await collectAllData();

  const backup: Backup = {
    id: generateUUID(),
    name,
    description,
    version: '1.0.0',
    data: backupData,
    createdAt: new Date(),
    size: JSON.stringify(backupData).length,
    checksum: generateChecksum(backupData),
    isAutoBackup: false,
    isEncrypted: false
  };

  return await db.backups.add(backup);
};
```

### 3. 数据恢复

```typescript
const restoreFromBackup = async (backupId: string) => {
  const backup = await db.backups.get(backupId);
  if (!backup) {
    throw new Error('备份不存在');
  }

  // 验证备份数据完整性
  if (backup.checksum !== generateChecksum(backup.data)) {
    throw new Error('备份数据已损坏');
  }

  // 执行恢复
  return await db.transaction('rw', db.cards, db.folders, db.tags, db.images, db.settings, async () => {
    // 清空现有数据
    await db.cards.clear();
    await db.folders.clear();
    await db.tags.clear();
    await db.images.clear();
    await db.settings.clear();

    // 恢复数据
    await db.cards.bulkAdd(backup.data.data.cards);
    await db.folders.bulkAdd(backup.data.data.folders);
    await db.tags.bulkAdd(backup.data.data.tags);

    // 恢复图片（需要特殊处理Blob数据）
    for (const imageData of backup.data.data.images) {
      const image = {
        ...imageData,
        data: base64ToBlob(imageData.data),
        thumbnail: imageData.thumbnail ? base64ToBlob(imageData.thumbnail) : undefined
      };
      await db.images.add(image);
    }

    await db.settings.bulkAdd(backup.data.data.settings);
  });
};
```

---

**状态**: 准备就绪用于实施
**下一步**: 生成具体的清理任务清单
**预期影响**: 最小化数据模型变更，保持现有功能完整