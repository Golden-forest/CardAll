// CardAll 存储清理脚本
// 解决 localStorage 配额超限问题

console.log('🧹 开始清理 CardAll 存储空间...\n');

// 获取当前 localStorage 使用情况
function getStorageUsage() {
    let totalSize = 0;
    const items = {};

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const size = (key.length + value.length) * 2; // UTF-16 编码，每个字符2字节
        items[key] = {
            size: size,
            sizeKB: (size / 1024).toFixed(2),
            value: value.length > 100 ? value.substring(0, 100) + '...' : value
        };
        totalSize += size;
    }

    return {
        totalSize: totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(2),
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        itemCount: Object.keys(items).length,
        items: items
    };
}

// 清理过期的认证数据
function cleanupAuthData() {
    console.log('🔐 清理认证相关数据...');

    const authKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('supabase') || key.includes('auth') || key.includes('token')) {
            authKeys.push(key);
        }
    }

    let cleanedCount = 0;
    authKeys.forEach(key => {
        try {
            // 保留必要的认证数据，清理过期的
            if (key.includes('expired') || key.includes('old') || key.includes('temp')) {
                localStorage.removeItem(key);
                console.log(`  🗑️ 删除: ${key}`);
                cleanedCount++;
            } else if (key.includes('supabase.auth.token')) {
                // 检查令牌是否过期
                try {
                    const tokenData = JSON.parse(localStorage.getItem(key));
                    if (tokenData && tokenData.expires_at) {
                        const now = Date.now();
                        if (tokenData.expires_at < now) {
                            localStorage.removeItem(key);
                            console.log(`  🗑️ 删除过期令牌: ${key}`);
                            cleanedCount++;
                        } else {
                            console.log(`  ✅ 保留有效令牌: ${key}`);
                        }
                    }
                } catch (e) {
                    // 如果解析失败，删除该令牌
                    localStorage.removeItem(key);
                    console.log(`  🗑️ 删除损坏令牌: ${key}`);
                    cleanedCount++;
                }
            }
        } catch (error) {
            console.log(`  ⚠️ 处理 ${key} 时出错: ${error.message}`);
        }
    });

    console.log(`📊 认证数据清理完成，删除了 ${cleanedCount} 项\n`);
    return cleanedCount;
}

// 清理同步队列和缓存
function cleanupSyncData() {
    console.log('🔄 清理同步相关数据...');

    const syncKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('sync') || key.includes('queue') || key.includes('cache')) {
            syncKeys.push(key);
        }
    }

    let cleanedCount = 0;
    syncKeys.forEach(key => {
        try {
            // 清理过期的同步队列
            if (key.includes('queue')) {
                const queueData = localStorage.getItem(key);
                if (queueData) {
                    try {
                        const queue = JSON.parse(queueData);
                        if (Array.isArray(queue)) {
                            // 清理超过7天的队列项
                            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                            const filteredQueue = queue.filter(item => {
                                return item.timestamp && item.timestamp > sevenDaysAgo;
                            });

                            if (filteredQueue.length < queue.length) {
                                localStorage.setItem(key, JSON.stringify(filteredQueue));
                                console.log(`  📝 清理过期队列项: ${key} (${queue.length - filteredQueue.length} 项)`);
                            }
                        }
                    } catch (e) {
                        // 如果解析失败，删除整个队列
                        localStorage.removeItem(key);
                        console.log(`  🗑️ 删除损坏队列: ${key}`);
                        cleanedCount++;
                    }
                }
            }

            // 清理缓存数据
            if (key.includes('cache') && key.includes('temp')) {
                localStorage.removeItem(key);
                console.log(`  🗑️ 删除临时缓存: ${key}`);
                cleanedCount++;
            }
        } catch (error) {
            console.log(`  ⚠️ 处理 ${key} 时出错: ${error.message}`);
        }
    });

    console.log(`📊 同步数据清理完成，处理了 ${syncKeys.length} 项\n`);
    return cleanedCount;
}

// 清理重复的备份数据
function cleanupBackupData() {
    console.log('💾 清理重复的备份数据...');

    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('backup') || key.includes('folders_state')) {
            backupKeys.push(key);
        }
    }

    // 找出重复的备份数据，保留最新的
    const backupGroups = {};
    backupKeys.forEach(key => {
        const baseKey = key.replace(/_[0-9]+$/, '').replace(/_backup$/, '');
        if (!backupGroups[baseKey]) {
            backupGroups[baseKey] = [];
        }
        backupGroups[baseKey].push(key);
    });

    let cleanedCount = 0;
    Object.keys(backupGroups).forEach(baseKey => {
        const keys = backupGroups[baseKey];
        if (keys.length > 1) {
            // 按时间排序（假设键名包含时间戳）
            keys.sort().reverse(); // 最新的在前面

            // 保留最新的2个备份
            for (let i = 2; i < keys.length; i++) {
                localStorage.removeItem(keys[i]);
                console.log(`  🗑️ 删除旧备份: ${keys[i]}`);
                cleanedCount++;
            }
        }
    });

    console.log(`📊 备份数据清理完成，删除了 ${cleanedCount} 个重复备份\n`);
    return cleanedCount;
}

// 清理调试和测试数据
function cleanupDebugData() {
    console.log('🐛 清理调试和测试数据...');

    const debugKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('debug') || key.includes('test') || key.includes('temp')) {
            debugKeys.push(key);
        }
    }

    let cleanedCount = 0;
    debugKeys.forEach(key => {
        try {
            localStorage.removeItem(key);
            console.log(`  🗑️ 删除调试数据: ${key}`);
            cleanedCount++;
        } catch (error) {
            console.log(`  ⚠️ 删除 ${key} 时出错: ${error.message}`);
        }
    });

    console.log(`📊 调试数据清理完成，删除了 ${cleanedCount} 项\n`);
    return cleanedCount;
}

// 优化存储策略
function optimizeStorage() {
    console.log('⚡ 优化存储策略...');

    // 检查文件夹状态备份
    const foldersBackup = localStorage.getItem('folders_state_backup');
    if (foldersBackup) {
        try {
            const folders = JSON.parse(foldersBackup);
            if (Array.isArray(folders) && folders.length > 50) {
                // 如果文件夹数量过多，只保留最新的
                const limitedFolders = folders.slice(-50);
                localStorage.setItem('folders_state_backup', JSON.stringify(limitedFolders));
                console.log(`  📝 限制文件夹备份数量: ${folders.length} -> ${limitedFolders.length}`);
            }
        } catch (e) {
            console.log(`  ⚠️ 文件夹备份数据损坏，将删除`);
            localStorage.removeItem('folders_state_backup');
        }
    }

    console.log('📊 存储优化完成\n');
}

// 主清理函数
function mainCleanup() {
    console.log('🚀 开始执行存储清理...\n');

    // 显示清理前的存储情况
    console.log('📊 清理前的存储情况:');
    const beforeCleanup = getStorageUsage();
    console.log(`  总大小: ${beforeCleanup.totalSizeKB} KB (${beforeCleanup.totalSizeMB} MB)`);
    console.log(`  项目数量: ${beforeCleanup.itemCount}`);

    // 显示大项目（>10KB）
    const largeItems = Object.entries(beforeCleanup.items)
        .filter(([key, data]) => data.size > 10 * 1024)
        .sort(([,a], [,b]) => b.size - a.size);

    if (largeItems.length > 0) {
        console.log('\n🔍 大项目 (>10KB):');
        largeItems.slice(0, 5).forEach(([key, data]) => {
            console.log(`  - ${key}: ${data.sizeKB} KB`);
        });
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 执行清理
    let totalCleaned = 0;
    totalCleaned += cleanupAuthData();
    totalCleaned += cleanupSyncData();
    totalCleaned += cleanupBackupData();
    totalCleaned += cleanupDebugData();

    optimizeStorage();

    // 显示清理后的存储情况
    console.log('📊 清理后的存储情况:');
    const afterCleanup = getStorageUsage();
    console.log(`  总大小: ${afterCleanup.totalSizeKB} KB (${afterCleanup.totalSizeMB} MB)`);
    console.log(`  项目数量: ${afterCleanup.itemCount}`);

    // 计算节省的空间
    const savedSize = beforeCleanup.totalSize - afterCleanup.totalSize;
    const savedPercent = ((savedSize / beforeCleanup.totalSize) * 100).toFixed(1);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 清理完成!');
    console.log(`📊 清理统计:`);
    console.log(`  - 删除项目数: ${totalCleaned}`);
    console.log(`  - 节省空间: ${savedSize} 字节 (${(savedSize / 1024).toFixed(2)} KB)`);
    console.log(`  - 空间节省: ${savedPercent}%`);
    console.log(`  - 剩余空间: ${afterCleanup.totalSizeKB} KB`);

    // 检查是否还有存储问题
    if (afterCleanup.totalSize > 4 * 1024 * 1024) { // 4MB
        console.log('\n⚠️ 警告: 存储使用量仍然较大，建议进一步清理');
    } else {
        console.log('\n✅ 存储使用量已优化，应该可以正常登录了');
    }

    console.log('\n💡 建议:');
    console.log('1. 重新加载页面并尝试登录');
    console.log('2. 如果问题仍然存在，可能需要清除所有站点数据');
    console.log('3. 定期执行此清理脚本以保持存储空间');
}

// 执行清理
try {
    mainCleanup();
} catch (error) {
    console.error('❌ 清理过程中出现错误:', error);
    console.log('💡 可以尝试手动清除浏览器数据或联系开发者');
}

// 导出函数供外部使用
window.cleanupStorage = {
    getStorageUsage,
    cleanupAuthData,
    cleanupSyncData,
    cleanupBackupData,
    cleanupDebugData,
    optimizeStorage,
    mainCleanup
};

console.log('\n📝 清理脚本已加载完成!');
console.log('💡 使用 window.cleanupStorage.mainCleanup() 重新运行清理');
console.log('💡 使用 window.cleanupStorage.getStorageUsage() 检查存储使用情况');