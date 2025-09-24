/**
 * 数据库状态检查启动脚本
 * 在浏览器控制台中运行此脚本来执行完整的数据库状态检查
 */

console.log('🚀 CardAll 数据库状态检查启动...');

// 主检查函数
async function runCompleteDatabaseCheck() {
    console.log('📋 开始完整的数据库状态检查...\n');

    try {
        // 1. 检查数据库连接
        console.log('📊 1. 检查数据库连接...');
        await checkDatabaseConnection();

        // 2. 检查文件夹数据
        console.log('\n📁 2. 检查文件夹数据...');
        await checkFolderData();

        // 3. 检查同步服务状态
        console.log('\n🔄 3. 检查同步服务状态...');
        await checkSyncServiceStatus();

        // 4. 检查同步间隔设置
        console.log('\n⏰ 4. 检查同步间隔设置...');
        await checkSyncIntervals();

        // 5. 测试文件夹持久化
        console.log('\n🧪 5. 测试文件夹持久化...');
        await testFolderPersistence();

        // 6. 检查浏览器存储
        console.log('\n💾 6. 检查浏览器存储...');
        checkBrowserStorage();

        console.log('\n✅ 完整数据库状态检查完成!');

    } catch (error) {
        console.error('❌ 数据库检查失败:', error);
    }
}

// 检查数据库连接
async function checkDatabaseConnection() {
    try {
        // 动态导入数据库模块
        const { db } = await import('./src/services/database.js');

        console.log('测试数据库连接...');
        await db.tables.toArray();
        console.log('✅ 数据库连接正常');

        // 检查数据库版本
        console.log('数据库版本: v3');
        console.log('数据表:', await db.tables.toArray());

    } catch (error) {
        console.error('❌ 数据库连接失败:', error);
        throw error;
    }
}

// 检查文件夹数据
async function checkFolderData() {
    try {
        const { db } = await import('./src/services/database.js');

        // 获取所有文件夹
        const allFolders = await db.folders.toArray();
        console.log(`📊 总文件夹数: ${allFolders.length}`);

        // 获取待同步文件夹
        const pendingFolders = await db.folders.filter(f => f.pendingSync).toArray();
        console.log(`📊 待同步文件夹: ${pendingFolders.length}`);

        if (allFolders.length > 0) {
            console.log('📋 文件夹列表:');
            allFolders.forEach((folder, index) => {
                console.log(`  ${index + 1}. ${folder.name} (ID: ${folder.id})`);
                console.log(`     待同步: ${folder.pendingSync}`);
                console.log(`     同步版本: ${folder.syncVersion}`);
                console.log(`     更新时间: ${new Date(folder.updatedAt).toLocaleString()}`);
            });
        } else {
            console.log('📭 数据库中没有文件夹');
        }

    } catch (error) {
        console.error('❌ 检查文件夹数据失败:', error);
        throw error;
    }
}

// 检查同步服务状态
async function checkSyncServiceStatus() {
    try {
        const { dataSyncService } = await import('./src/services/data-sync-service.js');
        const { db } = await import('./src/services/database.js');

        // 获取同步状态
        const syncState = dataSyncService.getCurrentState();
        console.log('📊 同步服务状态:', syncState);

        // 获取同步指标
        const metrics = await dataSyncService.getMetrics();
        console.log('📊 同步指标:', {
            totalSessions: metrics.totalSessions,
            successfulSessions: metrics.successfulSessions,
            failedSessions: metrics.failedSessions,
            reliability: (metrics.reliability * 100).toFixed(1) + '%',
            lastSyncTime: metrics.lastSyncTime ? metrics.lastSyncTime.toLocaleString() : '从未同步'
        });

        // 获取待同步操作
        const pendingOps = await db.syncQueue.count();
        console.log('📊 待同步操作数:', pendingOps);

        // 检查同步间隔
        const adaptiveInterval = getAdaptiveSyncInterval(metrics.reliability);
        console.log('📊 当前同步间隔:', formatInterval(adaptiveInterval));

    } catch (error) {
        console.error('❌ 检查同步服务状态失败:', error);
        throw error;
    }
}

// 检查同步间隔设置
async function checkSyncIntervals() {
    try {
        const { dataSyncService } = await import('./src/services/data-sync-service.js');

        const metrics = await dataSyncService.getMetrics();
        const reliability = metrics.reliability || 1;

        console.log('📊 同步间隔设置:');
        console.log(`  主要同步间隔: ${formatInterval(getAdaptiveSyncInterval(reliability))} (可靠性: ${(reliability * 100).toFixed(1)}%)`);
        console.log(`  一致性检查间隔: ${formatInterval(30 * 60 * 1000)} (30分钟)`);
        console.log(`  清理间隔: ${formatInterval(6 * 60 * 60 * 1000)} (6小时)`);
        console.log(`  健康检查间隔: ${formatInterval(10 * 60 * 1000)} (10分钟)`);

        // 验证间隔设置
        validateIntervals(reliability);

    } catch (error) {
        console.error('❌ 检查同步间隔设置失败:', error);
        throw error;
    }
}

// 测试文件夹持久化
async function testFolderPersistence() {
    try {
        const { db } = await import('./src/services/database.js');

        console.log('🧪 开始测试文件夹持久化...');

        // 创建测试文件夹
        const testFolderName = `测试文件夹_${Date.now()}`;
        const testFolderId = crypto.randomUUID();

        console.log(`创建测试文件夹: ${testFolderName}`);

        const testFolder = {
            name: testFolderName,
            userId: 'default',
            parentId: null,
            cardIds: [],
            createdAt: new Date(),
            id: testFolderId,
            syncVersion: 1,
            pendingSync: true,
            updatedAt: new Date()
        };

        // 添加到数据库
        await db.folders.add(testFolder);
        console.log('✅ 测试文件夹已添加到数据库');

        // 立即查询验证
        const savedFolder = await db.folders.get(testFolderId);
        if (!savedFolder) {
            throw new Error('测试文件夹保存失败 - 无法查询到');
        }
        console.log('✅ 测试文件夹保存成功');

        // 等待1秒后再次查询
        await new Promise(resolve => setTimeout(resolve, 1000));

        const folderAfterDelay = await db.folders.get(testFolderId);
        if (!folderAfterDelay) {
            throw new Error('测试文件夹持久化失败 - 1秒后无法查询到');
        }
        console.log('✅ 测试文件夹持久化成功');

        // 清理测试文件夹
        await db.folders.delete(testFolderId);
        console.log('🧹 测试文件夹已清理');

        console.log('✅ 文件夹持久化测试通过');

    } catch (error) {
        console.error('❌ 文件夹持久化测试失败:', error);
        throw error;
    }
}

// 检查浏览器存储
function checkBrowserStorage() {
    console.log('💾 检查浏览器存储...');

    // 检查 IndexedDB
    console.log('\n📊 IndexedDB 数据库:');
    if ('indexedDB' in window) {
        const request = indexedDB.open('CardAllUnifiedDB_v3');

        request.onsuccess = function(event) {
            const db = event.target.result;
            console.log('✅ 数据库存在，版本:', db.version);
            console.log('📋 数据表:', Array.from(db.objectStoreNames));
            db.close();
        };

        request.onerror = function(event) {
            console.error('❌ 无法打开数据库:', event.target.error);
        };
    } else {
        console.error('❌ 浏览器不支持 IndexedDB');
    }

    // 检查 LocalStorage
    console.log('\n💿 LocalStorage:');
    console.log('📊 总大小:', JSON.stringify(localStorage).length, '字符');

    const appKeys = Object.keys(localStorage).filter(key =>
        key.includes('cardall') || key.includes('supabase') || key.includes('auth')
    );

    if (appKeys.length > 0) {
        console.log('📋 应用相关数据:');
        appKeys.forEach(key => {
            const value = localStorage.getItem(key);
            console.log(`  ${key}: ${value?.substring(0, 100)}${value && value.length > 100 ? '...' : ''}`);
        });
    } else {
        console.log('📭 没有找到应用相关数据');
    }
}

// 辅助函数
function getAdaptiveSyncInterval(reliability) {
    if (reliability < 0.5) {
        return 3 * 60 * 1000; // 3分钟
    } else if (reliability < 0.8) {
        return 2 * 60 * 1000; // 2分钟
    } else if (reliability < 0.95) {
        return 1 * 60 * 1000; // 1分钟
    } else {
        return 30 * 1000; // 30秒
    }
}

function formatInterval(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    } else if (ms < 60 * 1000) {
        return `${(ms / 1000).toFixed(1)}秒`;
    } else if (ms < 60 * 60 * 1000) {
        return `${(ms / 60 / 1000).toFixed(1)}分钟`;
    } else {
        return `${(ms / 60 / 60 / 1000).toFixed(1)}小时`;
    }
}

function validateIntervals(reliability) {
    const currentInterval = getAdaptiveSyncInterval(reliability);

    if (currentInterval < 30 * 1000) {
        console.log('⚠️ 主要同步间隔较短，可能影响性能');
    }

    if (currentInterval > 5 * 60 * 1000) {
        console.log('⚠️ 主要同步间隔过长，可能导致数据不同步');
    }

    if (reliability < 0.5) {
        console.log('⚠️ 系统可靠性较低，建议检查网络连接和同步错误');
    } else if (reliability < 0.8) {
        console.log('ℹ️ 系统可靠性中等，建议优化同步策略');
    }
}

// 导出函数以便手动调用
window.runCompleteDatabaseCheck = runCompleteDatabaseCheck;
window.checkDatabaseConnection = checkDatabaseConnection;
window.checkFolderData = checkFolderData;
window.checkSyncServiceStatus = checkSyncServiceStatus;
window.checkSyncIntervals = checkSyncIntervals;
window.testFolderPersistence = testFolderPersistence;
window.checkBrowserStorage = checkBrowserStorage;

// 自动运行检查
console.log('📝 使用说明:');
console.log('- runCompleteDatabaseCheck(): 运行完整检查');
console.log('- checkDatabaseConnection(): 仅检查数据库连接');
console.log('- checkFolderData(): 仅检查文件夹数据');
console.log('- checkSyncServiceStatus(): 仅检查同步状态');
console.log('- checkSyncIntervals(): 仅检查同步间隔');
console.log('- testFolderPersistence(): 仅测试文件夹持久化');
console.log('- checkBrowserStorage(): 仅检查浏览器存储');
console.log('');

// 立即运行完整检查
runCompleteDatabaseCheck();