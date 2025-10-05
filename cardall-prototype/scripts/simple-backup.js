// CardAll 简化数据备份脚本
// 在浏览器控制台中运行此脚本来快速备份数据

(async function() {
  console.log('🚀 开始 CardAll 数据备份...');

  try {
    // 1. 导入必要的数据库服务
    const { db, getDatabase } = await import('./src/services/database.js');
    const { exportService } = await import('./src/services/export-service.js');

    console.log('📊 连接到数据库...');
    const database = getDatabase();

    // 2. 执行健康检查
    console.log('🔍 执行数据库健康检查...');
    const health = await database.healthCheck();
    console.log('数据库健康状态:', health);

    if (!health.isHealthy) {
      console.warn('⚠️ 数据库存在问题:', health.issues);
    }

    // 3. 获取统计信息
    console.log('📈 获取数据库统计信息...');
    const stats = await database.getStats();
    console.log('数据库统计:', stats);

    // 4. 执行完整数据导出
    console.log('📦 开始导出所有数据...');

    const exportResult = await exportService.exportData({
      includeImages: true,
      includeSettings: true,
      dateRange: undefined, // 导出所有数据
      folderIds: undefined, // 导出所有文件夹
      tagIds: undefined,    // 导出所有标签
      searchQuery: undefined // 不应用搜索过滤
    }, (progress) => {
      console.log(`[${progress.stage}] ${progress.message} - ${progress.progress}%`);
      if (progress.estimatedTimeRemaining) {
        console.log(`  预计剩余时间: ${progress.estimatedTimeRemaining}秒`);
      }
    });

    // 5. 显示导出结果
    console.log('='.repeat(60));
    console.log('📋 导出结果摘要');
    console.log('='.repeat(60));

    if (exportResult.success) {
      console.log('✅ 导出成功!');
      console.log(`📁 文件名: ${exportResult.filename}`);
      console.log(`📏 文件大小: ${(exportResult.size / 1024).toFixed(2)} KB`);
      console.log(`⏱️ 耗时: ${exportResult.duration} ms`);

      console.log('\n📊 导出数据统计:');
      console.log(`  📝 卡片: ${exportResult.itemCount.cards} 条`);
      console.log(`  📁 文件夹: ${exportResult.itemCount.folders} 条`);
      console.log(`  🏷️ 标签: ${exportResult.itemCount.tags} 条`);
      console.log(`  🖼️ 图片: ${exportResult.itemCount.images} 条`);

      // 在页面上显示成功消息
      const successDiv = document.createElement('div');
      successDiv.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 320px;
          animation: slideIn 0.3s ease-out;
        ">
          <style>
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          </style>
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <div style="width: 24px; height: 24px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
              <span style="color: #10b981; font-size: 16px;">✓</span>
            </div>
            <div style="font-size: 18px; font-weight: 600;">备份成功!</div>
          </div>
          <div style="font-size: 14px; margin-bottom: 8px;">
            <strong>文件:</strong> ${exportResult.filename}
          </div>
          <div style="font-size: 14px; margin-bottom: 8px;">
            <strong>大小:</strong> ${(exportResult.size / 1024).toFixed(2)} KB
          </div>
          <div style="font-size: 14px; margin-bottom: 12px;">
            <strong>数据:</strong> ${exportResult.itemCount.cards + exportResult.itemCount.folders + exportResult.itemCount.tags + exportResult.itemCount.images} 条记录
          </div>
          <div style="font-size: 12px; opacity: 0.8; text-align: right;">
            耗时: ${(exportResult.duration / 1000).toFixed(2)}秒
          </div>
        </div>
      `;
      document.body.appendChild(successDiv);

      // 5秒后自动移除
      setTimeout(() => {
        if (successDiv.parentNode) {
          successDiv.parentNode.removeChild(successDiv);
        }
      }, 8000);

    } else {
      console.error('❌ 导出失败:', exportResult.error);

      // 显示错误消息
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 320px;
        ">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">
            ❌ 备份失败
          </div>
          <div style="font-size: 14px;">
            ${exportResult.error}
          </div>
        </div>
      `;
      document.body.appendChild(errorDiv);

      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.parentNode.removeChild(errorDiv);
        }
      }, 5000);
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 备份过程中发生错误:', error);
    console.log('\n🔧 可能的解决方案:');
    console.log('1. 确保应用已完全加载');
    console.log('2. 检查数据库连接状态');
    console.log('3. 尝试刷新页面后重新运行');

    // 显示错误消息
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 320px;
      ">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">
          ❌ 系统错误
        </div>
        <div style="font-size: 14px; margin-bottom: 12px;">
          ${error.message}
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          请检查控制台获取详细信息
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }

  console.log('\n💡 提示: 备份文件将自动下载到您的默认下载文件夹');
  console.log('🔄 如需重新备份，请刷新页面后重新运行此脚本');

})();