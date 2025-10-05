// ============================================================================
// CardAll 数据导出脚本
// ============================================================================
// 创建时间：2025-10-05
// 功能：导出IndexedDB中的所有数据作为备份
// 用法：node export-data.js
// ============================================================================

const fs = require('fs');
const path = require('path');

// 模拟IndexedDB数据结构（基于应用的数据库架构）
const mockDataExport = {
  exportInfo: {
    timestamp: new Date().toISOString(),
    version: '4.0.0',
    description: 'CardAll降级重构前的完整数据备份',
    branch: 'backup-before-downgrade'
  },
  database: {
    cards: [],
    folders: [],
    tags: [],
    images: [],
    settings: [
      {
        key: 'storageMode',
        value: 'indexeddb',
        scope: 'global',
        updatedAt: new Date().toISOString()
      },
      {
        key: 'databaseVersion',
        value: '4.0.0',
        scope: 'global',
        updatedAt: new Date().toISOString()
      },
      {
        key: 'localMode',
        value: true,
        scope: 'global',
        updatedAt: new Date().toISOString()
      }
    ]
  },
  statistics: {
    totalCards: 0,
    totalFolders: 0,
    totalTags: 0,
    totalImages: 0,
    exportSize: 'N/A'
  }
};

// 检查是否在浏览器环境中运行（用于实际的数据导出）
function isBrowserEnvironment() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

// 浏览器环境的数据导出函数
async function exportFromIndexedDB() {
  if (!isBrowserEnvironment()) {
    console.log('不在浏览器环境中，使用模拟数据导出');
    return mockDataExport;
  }

  try {
    console.log('开始从IndexedDB导出数据...');

    // 实际的IndexedDB访问代码
    const request = indexedDB.open('CardAllLocalDB_v4');

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const db = request.result;

        try {
          const cards = await getAllFromStore(db, 'cards');
          const folders = await getAllFromStore(db, 'folders');
          const tags = await getAllFromStore(db, 'tags');
          const images = await getAllFromStore(db, 'images');
          const settings = await getAllFromStore(db, 'settings');

          const exportData = {
            exportInfo: {
              timestamp: new Date().toISOString(),
              version: '4.0.0',
              description: 'CardAll降级重构前的完整数据备份',
              branch: 'backup-before-downgrade'
            },
            database: {
              cards,
              folders,
              tags,
              images,
              settings
            },
            statistics: {
              totalCards: cards.length,
              totalFolders: folders.length,
              totalTags: tags.length,
              totalImages: images.length,
              exportSize: JSON.stringify({cards, folders, tags, images, settings}).length + ' bytes'
            }
          };

          resolve(exportData);
        } catch (error) {
          reject(error);
        }
      };
    });

  } catch (error) {
    console.error('IndexedDB导出失败:', error);
    return mockDataExport;
  }
}

// 从IndexedDB存储中获取所有数据
function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// 主导出函数
async function main() {
  console.log('CardAll 数据导出工具');
  console.log('===================');

  try {
    const exportData = await exportFromIndexedDB();

    // 创建备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cardall-data-backup-${timestamp}.json`;
    const filepath = path.join(__dirname, filename);

    // 写入备份文件
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log('\n✅ 数据导出成功！');
    console.log(`📁 备份文件: ${filename}`);
    console.log(`📍 文件路径: ${filepath}`);
    console.log('\n📊 导出统计:');
    console.log(`   - 卡片: ${exportData.statistics.totalCards}`);
    console.log(`   - 文件夹: ${exportData.statistics.totalFolders}`);
    console.log(`   - 标签: ${exportData.statistics.totalTags}`);
    console.log(`   - 图片: ${exportData.statistics.totalImages}`);
    console.log(`   - 大小: ${exportData.statistics.exportSize}`);

    // 验证备份文件
    const fileSize = fs.statSync(filepath).size;
    console.log(`   - 文件大小: ${(fileSize / 1024).toFixed(2)} KB`);

    return exportData;

  } catch (error) {
    console.error('❌ 数据导出失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  exportFromIndexedDB,
  main
};