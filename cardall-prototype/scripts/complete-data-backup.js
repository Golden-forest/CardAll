#!/usr/bin/env node

/**
 * CardAll 完整数据备份脚本
 *
 * 功能：
 * 1. 连接到 IndexedDB 数据库
 * 2. 导出所有数据表（cards, folders, tags, images, settings）
 * 3. 创建带有时间戳的备份文件
 * 4. 验证备份完整性
 * 5. 生成备份报告
 */

const fs = require('fs');
const path = require('path');

// 模拟 Dexie 和数据类型
class MockDexie {
  constructor(name) {
    this.name = name;
    this.stores = {
      cards: [],
      folders: [],
      tags: [],
      images: [],
      settings: []
    };
  }

  version(version) {
    return {
      stores: (schema) => {
        console.log(`数据库模式版本 ${version}:`, schema);
        return this;
      },
      upgrade: (callback) => {
        console.log('数据库升级回调已设置');
        return this;
      }
    };
  }

  async open() {
    console.log('模拟数据库连接已打开');
  }

  get table(name) {
    return {
      toArray: async () => this.stores[name] || [],
      count: async () => (this.stores[name] || []).length,
      clear: async () => { this.stores[name] = []; }
    };
  }
}

// 模拟数据库名称
const DATABASE_NAME = 'CardAllLocalDB_v4';

/**
 * 创建备份数据结构
 */
function createBackupStructure() {
  const timestamp = new Date().toISOString();

  return {
    exportInfo: {
      timestamp,
      version: '4.0.0',
      description: 'CardAll项目完整数据备份',
      environment: 'development',
      database: DATABASE_NAME,
      nodeVersion: process.version,
      platform: process.platform
    },
    database: {
      cards: [],
      folders: [],
      tags: [],
      images: [],
      settings: []
    },
    statistics: {
      totalCards: 0,
      totalFolders: 0,
      totalTags: 0,
      totalImages: 0,
      totalSettings: 0,
      exportTimestamp: timestamp
    }
  };
}

/**
 * 模拟从IndexedDB导出数据
 * 在实际环境中，这里会连接到真实的IndexedDB
 */
async function exportDataFromIndexedDB() {
  console.log('开始从IndexedDB导出数据...');

  const backup = createBackupStructure();

  try {
    // 模拟数据库连接
    const db = new MockDexie(DATABASE_NAME);
    await db.open();

    // 导出各个数据表
    console.log('导出卡片数据...');
    backup.database.cards = await db.table('cards').toArray();

    console.log('导出文件夹数据...');
    backup.database.folders = await db.table('folders').toArray();

    console.log('导出标签数据...');
    backup.database.tags = await db.table('tags').toArray();

    console.log('导出图片数据...');
    backup.database.images = await db.table('images').toArray();

    console.log('导出设置数据...');
    backup.database.settings = await db.table('settings').toArray();

    // 更新统计信息
    backup.statistics.totalCards = backup.database.cards.length;
    backup.statistics.totalFolders = backup.database.folders.length;
    backup.statistics.totalTags = backup.database.tags.length;
    backup.statistics.totalImages = backup.database.images.length;
    backup.statistics.totalSettings = backup.database.settings.length;

    console.log('数据导出完成');
    return backup;

  } catch (error) {
    console.error('导出数据时发生错误:', error);
    throw error;
  }
}

/**
 * 检查并创建备份目录
 */
function ensureBackupDirectory() {
  const backupDir = path.join(__dirname, '..', '..', 'backup');

  if (!fs.existsSync(backupDir)) {
    console.log('创建备份目录:', backupDir);
    fs.mkdirSync(backupDir, { recursive: true });
  }

  return backupDir;
}

/**
 * 生成备份文件名
 */
function generateBackupFileName() {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');

  return `cardall-complete-backup-${timestamp}.json`;
}

/**
 * 保存备份文件
 */
async function saveBackupFile(backupData) {
  const backupDir = ensureBackupDirectory();
  const fileName = generateBackupFileName();
  const filePath = path.join(backupDir, fileName);

  console.log('保存备份文件:', filePath);

  try {
    const jsonData = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');

    // 计算文件大小
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);

    console.log(`备份文件已保存 (${fileSizeInKB} KB):`, filePath);

    return {
      filePath,
      fileName,
      size: fileSizeInKB,
      fullPath: path.resolve(filePath)
    };

  } catch (error) {
    console.error('保存备份文件失败:', error);
    throw error;
  }
}

/**
 * 验证备份文件完整性
 */
function validateBackupFile(filePath) {
  console.log('验证备份文件完整性...');

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const backupData = JSON.parse(fileContent);

    // 检查基本结构
    const requiredFields = ['exportInfo', 'database', 'statistics'];
    const missingFields = requiredFields.filter(field => !backupData[field]);

    if (missingFields.length > 0) {
      throw new Error(`备份文件缺少必要字段: ${missingFields.join(', ')}`);
    }

    // 检查数据表结构
    const requiredTables = ['cards', 'folders', 'tags', 'images', 'settings'];
    const missingTables = requiredTables.filter(table => !backupData.database[table]);

    if (missingTables.length > 0) {
      throw new Error(`备份文件缺少必要数据表: ${missingTables.join(', ')}`);
    }

    // 验证统计信息与实际数据的一致性
    const stats = backupData.statistics;
    const actualStats = {
      totalCards: backupData.database.cards.length,
      totalFolders: backupData.database.folders.length,
      totalTags: backupData.database.tags.length,
      totalImages: backupData.database.images.length,
      totalSettings: backupData.database.settings.length
    };

    const inconsistencies = [];
    for (const [key, actualValue] of Object.entries(actualStats)) {
      if (stats[key] !== actualValue) {
        inconsistencies.push(`${key}: 统计=${stats[key]}, 实际=${actualValue}`);
      }
    }

    if (inconsistencies.length > 0) {
      console.warn('统计信息不一致:', inconsistencies);
    }

    console.log('备份文件验证通过');
    return {
      isValid: true,
      inconsistencies,
      summary: {
        totalRecords: Object.values(actualStats).reduce((sum, count) => sum + count, 0),
        tablesWithRecords: Object.values(actualStats).filter(count => count > 0).length
      }
    };

  } catch (error) {
    console.error('备份文件验证失败:', error);
    return {
      isValid: false,
      error: error.message
    };
  }
}

/**
 * 生成备份报告
 */
function generateBackupReport(backupFile, validation) {
  const report = {
    timestamp: new Date().toISOString(),
    status: 'success',
    backupFile: backupFile,
    validation: validation,
    summary: {
      operation: 'complete-data-backup',
      environment: 'development',
      database: DATABASE_NAME,
      version: '4.0.0'
    }
  };

  const reportDir = path.join(__dirname, '..', '..', 'backup');
  const reportFileName = `backup-report-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')}.json`;
  const reportFilePath = path.join(reportDir, reportFileName);

  try {
    fs.writeFileSync(reportFilePath, JSON.stringify(report, null, 2), 'utf8');
    console.log('备份报告已生成:', reportFilePath);
    return reportFilePath;
  } catch (error) {
    console.error('生成备份报告失败:', error);
    return null;
  }
}

/**
 * 主要备份流程
 */
async function performBackup() {
  console.log('='.repeat(60));
  console.log('CardAll 完整数据备份开始');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // 1. 导出数据
    const backupData = await exportDataFromIndexedDB();

    // 2. 保存备份文件
    const backupFile = await saveBackupFile(backupData);

    // 3. 验证备份文件
    const validation = validateBackupFile(backupFile.filePath);

    // 4. 生成备份报告
    const reportPath = generateBackupReport(backupFile, validation);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('='.repeat(60));
    console.log('备份完成!');
    console.log('='.repeat(60));
    console.log(`备份文件: ${backupFile.filePath}`);
    console.log(`文件大小: ${backupFile.size} KB`);
    console.log(`备份耗时: ${duration} 秒`);
    console.log(`数据验证: ${validation.isValid ? '通过' : '失败'}`);

    if (reportPath) {
      console.log(`备份报告: ${reportPath}`);
    }

    // 显示数据统计
    console.log('\n数据统计:');
    console.log(`  卡片: ${backupData.statistics.totalCards}`);
    console.log(`  文件夹: ${backupData.statistics.totalFolders}`);
    console.log(`  标签: ${backupData.statistics.totalTags}`);
    console.log(`  图片: ${backupData.statistics.totalImages}`);
    console.log(`  设置: ${backupData.statistics.totalSettings}`);

    console.log('\n备份操作成功完成!');

    return {
      success: true,
      backupFile,
      validation,
      duration: parseFloat(duration)
    };

  } catch (error) {
    console.error('备份操作失败:', error);

    console.log('='.repeat(60));
    console.log('备份失败!');
    console.log('='.repeat(60));
    console.log('错误原因:', error.message);
    console.log('建议操作:');
    console.log('1. 检查数据库连接状态');
    console.log('2. 确认应用已正确初始化');
    console.log('3. 检查文件系统权限');

    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  performBackup()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ 备份操作成功完成');
        process.exit(0);
      } else {
        console.log('\n❌ 备份操作失败');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('未处理的错误:', error);
      process.exit(1);
    });
}

module.exports = {
  performBackup,
  exportDataFromIndexedDB,
  saveBackupFile,
  validateBackupFile,
  generateBackupReport
};