// CardAll 浏览器端数据备份脚本
// 在浏览器控制台中运行此脚本来备份IndexedDB数据

(function() {
  'use strict';

  console.log('🚀 开始 CardAll 数据备份...');

  /**
   * 备份配置
   */
  const BACKUP_CONFIG = {
    databaseName: 'CardAllLocalDB_v4',
    version: 4,
    tables: ['cards', 'folders', 'tags', 'images', 'settings']
  };

  /**
   * 创建备份对象
   */
  function createBackupObject() {
    const timestamp = new Date().toISOString();

    return {
      exportInfo: {
        timestamp,
        version: '4.0.0',
        description: 'CardAll项目完整数据备份 - 浏览器端导出',
        environment: 'browser',
        database: BACKUP_CONFIG.databaseName,
        userAgent: navigator.userAgent,
        url: window.location.href
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
   * 打开IndexedDB数据库
   */
  function openDatabase() {
    return new Promise((resolve, reject) => {
      console.log('📊 连接到数据库:', BACKUP_CONFIG.databaseName);

      const request = indexedDB.open(BACKUP_CONFIG.databaseName, BACKUP_CONFIG.version);

      request.onerror = () => {
        console.error('❌ 数据库连接失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('✅ 数据库连接成功');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        console.log('🔄 数据库需要升级:', event);
        const db = event.target.result;

        // 确保所有表都存在
        if (!db.objectStoreNames.contains('cards')) {
          console.log('创建cards表');
          db.createObjectStore('cards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('folders')) {
          console.log('创建folders表');
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tags')) {
          console.log('创建tags表');
          db.createObjectStore('tags', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('images')) {
          console.log('创建images表');
          db.createObjectStore('images', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          console.log('创建settings表');
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * 从表中获取所有数据
   */
  function getAllDataFromTable(db, tableName) {
    return new Promise((resolve, reject) => {
      console.log(`📋 读取表数据: ${tableName}`);

      if (!db.objectStoreNames.contains(tableName)) {
        console.log(`⚠️ 表 ${tableName} 不存在，跳过`);
        resolve([]);
        return;
      }

      const transaction = db.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const request = store.getAll();

      request.onerror = () => {
        console.error(`❌ 读取表 ${tableName} 失败:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const data = request.result || [];
        console.log(`✅ 表 ${tableName} 读取完成，共 ${data.length} 条记录`);
        resolve(data);
      };
    });
  }

  /**
   * 导出所有数据
   */
  async function exportAllData() {
    const backup = createBackupObject();
    let db;

    try {
      // 连接数据库
      db = await openDatabase();

      // 检查数据库表
      console.log('📊 数据库表列表:');
      for (let i = 0; i < db.objectStoreNames.length; i++) {
        console.log(`  - ${db.objectStoreNames[i]}`);
      }

      // 并行导出所有表
      console.log('📦 开始导出数据...');
      const exportPromises = BACKUP_CONFIG.tables.map(async (tableName) => {
        try {
          const data = await getAllDataFromTable(db, tableName);
          backup.database[tableName] = data;
          return { tableName, count: data.length, success: true };
        } catch (error) {
          console.error(`❌ 导出表 ${tableName} 失败:`, error);
          return { tableName, error: error.message, success: false };
        }
      });

      const results = await Promise.all(exportPromises);

      // 更新统计信息
      backup.statistics.totalCards = backup.database.cards.length;
      backup.statistics.totalFolders = backup.database.folders.length;
      backup.statistics.totalTags = backup.database.tags.length;
      backup.statistics.totalImages = backup.database.images.length;
      backup.statistics.totalSettings = backup.database.settings.length;

      // 显示导出结果
      console.log('\n📊 导出结果摘要:');
      results.forEach(result => {
        if (result.success) {
          console.log(`  ✅ ${result.tableName}: ${result.count} 条记录`);
        } else {
          console.log(`  ❌ ${result.tableName}: ${result.error}`);
        }
      });

      console.log('\n📈 数据统计:');
      console.log(`  卡片: ${backup.statistics.totalCards}`);
      console.log(`  文件夹: ${backup.statistics.totalFolders}`);
      console.log(`  标签: ${backup.statistics.totalTags}`);
      console.log(`  图片: ${backup.statistics.totalImages}`);
      console.log(`  设置: ${backup.statistics.totalSettings}`);

      return backup;

    } catch (error) {
      console.error('❌ 数据导出失败:', error);
      throw error;
    } finally {
      if (db) {
        db.close();
        console.log('🔒 数据库连接已关闭');
      }
    }
  }

  /**
   * 下载备份文件
   */
  function downloadBackup(backupData) {
    try {
      console.log('💾 准备下载备份文件...');

      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace('Z', '');

      const fileName = `cardall-browser-backup-${timestamp}.json`;
      const jsonData = JSON.stringify(backupData, null, 2);

      // 创建Blob
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 创建下载链接
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = fileName;
      downloadLink.style.display = 'none';

      // 触发下载
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // 清理URL对象
      URL.revokeObjectURL(url);

      console.log(`✅ 备份文件已下载: ${fileName}`);
      console.log(`📁 文件大小: ${(new Blob([jsonData]).size / 1024).toFixed(2)} KB`);

      return fileName;

    } catch (error) {
      console.error('❌ 下载备份文件失败:', error);
      throw error;
    }
  }

  /**
   * 在控制台显示备份摘要
   */
  function displayBackupSummary(backupData) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 CardAll 数据备份摘要');
    console.log('='.repeat(60));
    console.log(`📅 备份时间: ${backupData.exportInfo.timestamp}`);
    console.log(`🔢 版本: ${backupData.exportInfo.version}`);
    console.log(`💾 数据库: ${backupData.exportInfo.database}`);
    console.log(`🌐 环境: ${backupData.exportInfo.environment}`);
    console.log('\n📊 数据统计:');
    console.log(`  📝 卡片: ${backupData.statistics.totalCards}`);
    console.log(`  📁 文件夹: ${backupData.statistics.totalFolders}`);
    console.log(`  🏷️ 标签: ${backupData.statistics.totalTags}`);
    console.log(`  🖼️ 图片: ${backupData.statistics.totalImages}`);
    console.log(`  ⚙️ 设置: ${backupData.statistics.totalSettings}`);
    console.log(`  📊 总计: ${Object.values(backupData.statistics).reduce((sum, val) =>
      typeof val === 'number' ? sum + val : sum, 0)} 条记录`);
    console.log('='.repeat(60));
  }

  /**
   * 主备份流程
   */
  async function performBackup() {
    const startTime = Date.now();

    try {
      console.log('🎯 开始执行完整数据备份流程...');

      // 1. 导出数据
      const backupData = await exportAllData();

      // 2. 显示备份摘要
      displayBackupSummary(backupData);

      // 3. 下载备份文件
      const fileName = downloadBackup(backupData);

      // 4. 计算耗时
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n🎉 备份操作成功完成!');
      console.log(`⏱️ 总耗时: ${duration} 秒`);
      console.log(`📁 备份文件: ${fileName}`);

      // 在页面上显示成功消息
      const successMessage = document.createElement('div');
      successMessage.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 15px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 9999;
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 300px;
        ">
          <div style="font-weight: bold; margin-bottom: 5px;">✅ 备份成功!</div>
          <div style="font-size: 14px;">文件已下载: ${fileName}</div>
          <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">
            耗时: ${duration}秒 | 共${backupData.statistics.totalCards + backupData.statistics.totalFolders + backupData.statistics.totalTags + backupData.statistics.totalImages + backupData.statistics.totalSettings}条记录
          </div>
        </div>
      `;
      document.body.appendChild(successMessage);

      // 3秒后自动移除消息
      setTimeout(() => {
        if (successMessage.parentNode) {
          successMessage.parentNode.removeChild(successMessage);
        }
      }, 5000);

      return {
        success: true,
        fileName,
        backupData,
        duration: parseFloat(duration)
      };

    } catch (error) {
      console.error('❌ 备份操作失败:', error);

      // 在页面上显示错误消息
      const errorMessage = document.createElement('div');
      errorMessage.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 15px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 9999;
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 300px;
        ">
          <div style="font-weight: bold; margin-bottom: 5px;">❌ 备份失败!</div>
          <div style="font-size: 14px;">${error.message}</div>
        </div>
      `;
      document.body.appendChild(errorMessage);

      // 5秒后自动移除消息
      setTimeout(() => {
        if (errorMessage.parentNode) {
          errorMessage.parentNode.removeChild(errorMessage);
        }
      }, 5000);

      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  // 检查是否在浏览器环境中
  if (typeof window === 'undefined') {
    console.error('❌ 此脚本只能在浏览器环境中运行');
    return;
  }

  // 检查IndexedDB支持
  if (!window.indexedDB) {
    console.error('❌ 当前浏览器不支持 IndexedDB');
    return;
  }

  // 自动执行备份
  console.log('🚀 CardAll 浏览器端数据备份脚本已加载');
  console.log('📝 提示: 备份将自动开始，完成后会下载文件');

  // 执行备份
  performBackup().then(result => {
    if (result.success) {
      console.log('🎉 所有备份操作已完成!');
    } else {
      console.error('💥 备份过程中出现错误:', result.error);
    }
  });

  // 提供手动重新备份的函数
  window.CardAllBackup = {
    performBackup,
    exportAllData,
    downloadBackup,
    displayBackupSummary
  };

  console.log('💡 提示: 如需重新备份，可在控制台运行: CardAllBackup.performBackup()');

})();