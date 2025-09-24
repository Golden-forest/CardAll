// CardAll 文件夹状态保存问题诊断脚本
// 专门诊断文件夹修改后刷新状态保持问题

console.log('🔍 CardAll 文件夹状态保存问题诊断开始...\n');

// 检查 IndexedDB 中的文件夹数据
async function checkIndexedDBFolders() {
    console.log('📊 检查 IndexedDB 中的文件夹数据...');

    try {
        // 动态导入数据库模块
        const { db } = await import('./src/services/database.js');

        // 等待数据库初始化
        await new Promise(resolve => setTimeout(resolve, 100));

        const folders = await db.folders.toArray();
        console.log(`✅ IndexedDB 连接成功`);
        console.log(`📋 文件夹总数: ${folders.length}`);

        if (folders.length > 0) {
            console.log('\n📋 文件夹列表:');
            folders.forEach((folder, index) => {
                console.log(`  ${index + 1}. ${folder.name} (ID: ${folder.id})`);
                console.log(`     - 父ID: ${folder.parentId || '无'}`);
                console.log(`     - 卡片数: ${folder.cardIds ? folder.cardIds.length : 0}`);
                console.log(`     - 同步版本: ${folder.syncVersion || '未设置'}`);
                console.log(`     - 待同步: ${folder.pendingSync || 'false'}`);
                console.log(`     - 更新时间: ${folder.updatedAt || '未知'}`);
            });
        } else {
            console.log('⚠️ IndexedDB 中没有文件夹数据');
        }

        return { success: true, folders };
    } catch (error) {
        console.error('❌ 检查 IndexedDB 失败:', error);
        return { success: false, error: error.message, folders: [] };
    }
}

// 检查 localStorage 中的备份数据
function checkLocalStorageBackup() {
    console.log('\n💾 检查 localStorage 中的文件夹备份数据...');

    try {
        // 检查所有可能的备份键
        const backupKeys = [
            'cardall_folders_state_backup',
            'folders_state_backup',
            'cardall_folders_backup',
            'folders_backup'
        ];

        let foundBackup = false;
        backupKeys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`✅ 找到备份数据 (${key}):`);
                    console.log(`  - 文件夹数量: ${Array.isArray(parsed) ? parsed.length : '非数组'}`);
                    console.log(`  - 数据大小: ${(data.length / 1024).toFixed(2)} KB`);

                    if (Array.isArray(parsed) && parsed.length > 0) {
                        console.log('  - 前3个文件夹:');
                        parsed.slice(0, 3).forEach((folder, index) => {
                            console.log(`    ${index + 1}. ${folder.name} (ID: ${folder.id})`);
                        });
                    }

                    foundBackup = true;
                } catch (e) {
                    console.log(`❌ 备份数据解析失败 (${key}): ${e.message}`);
                }
            }
        });

        if (!foundBackup) {
            console.log('⚠️ 没有找到文件夹备份数据');
        }

        return foundBackup;
    } catch (error) {
        console.error('❌ 检查 localStorage 备份失败:', error);
        return false;
    }
}

// 检查 secureStorage 功能
function checkSecureStorage() {
    console.log('\n🔐 检查 secureStorage 功能...');

    try {
        // 尝试使用 secureStorage
        const testData = { test: 'data', timestamp: Date.now() };

        // 测试写入
        const writeSuccess = secureStorage.set('test_key', testData, {
            validate: true,
            encrypt: true
        });

        if (writeSuccess) {
            console.log('✅ secureStorage 写入成功');
        } else {
            console.log('❌ secureStorage 写入失败');
            return false;
        }

        // 测试读取
        const readData = secureStorage.get('test_key', {
            validate: true,
            encrypt: true
        });

        if (readData && readData.test === 'data') {
            console.log('✅ secureStorage 读取成功');
        } else {
            console.log('❌ secureStorage 读取失败');
            return false;
        }

        // 清理测试数据
        secureStorage.remove('test_key');
        console.log('✅ secureStorage 功能正常');

        return true;
    } catch (error) {
        console.error('❌ secureStorage 检查失败:', error);
        return false;
    }
}

// 检查文件夹状态初始化
function checkFolderStateInitialization() {
    console.log('\n🔄 检查文件夹状态初始化...');

    try {
        // 检查 use-folders.ts 中的初始化逻辑
        const mockDataKey = 'cardall_mock_folders_initialized';
        const migrationCompleteKey = 'cardall_folder_migration_complete';

        const mockInitialized = localStorage.getItem(mockDataKey);
        const migrationComplete = localStorage.getItem(migrationComplete);

        console.log(`📋 Mock数据初始化: ${mockInitialized ? '是' : '否'}`);
        console.log(`📋 迁移完成标记: ${migrationComplete ? '是' : '否'}`);

        // 检查是否有初始化相关的标记
        const initKeys = Object.keys(localStorage).filter(key =>
            key.includes('init') || key.includes('migration') || key.includes('mock')
        );

        if (initKeys.length > 0) {
            console.log('📋 初始化相关标记:');
            initKeys.forEach(key => {
                console.log(`  - ${key}: ${localStorage.getItem(key)}`);
            });
        }

        return { mockInitialized, migrationComplete };
    } catch (error) {
        console.error('❌ 检查文件夹状态初始化失败:', error);
        return { mockInitialized: false, migrationComplete: false };
    }
}

// 检查数据同步服务状态
async function checkDataSyncService() {
    console.log('\n☁️ 检查数据同步服务状态...');

    try {
        // 动态导入同步服务
        const { dataSyncService } = await import('./src/services/data-sync-service.js');

        // 检查同步服务状态
        const currentState = dataSyncService.getCurrentState();
        console.log(`📊 当前同步状态: ${currentState}`);

        // 检查同步指标
        const metrics = await dataSyncService.getMetrics();
        console.log(`📊 总会话数: ${metrics.totalSessions}`);
        console.log(`📊 成功率: ${((metrics.reliability || 0) * 100).toFixed(1)}%`);

        // 检查定时器
        const hasActiveTimers = dataSyncService.syncIntervals && dataSyncService.syncIntervals.size > 0;
        console.log(`📊 活动定时器: ${hasActiveTimers ? '是' : '否'}`);

        if (hasActiveTimers) {
            console.log('📊 定时器详情:');
            dataSyncService.syncIntervals.forEach((intervalId, name) => {
                console.log(`  - ${name}: ${intervalId}`);
            });
        }

        // 检查同步间隔
        const interval = dataSyncService.getAdaptiveSyncInterval();
        console.log(`📊 同步间隔: ${(interval / 1000).toFixed(1)} 秒`);

        return { success: true, state: currentState, metrics };
    } catch (error) {
        console.error('❌ 检查数据同步服务失败:', error);
        return { success: false, error: error.message };
    }
}

// 检查文件夹操作的一致性
async function checkFolderOperationsConsistency() {
    console.log('\n🔍 检查文件夹操作的一致性...');

    try {
        const { db } = await import('./src/services/database.js');
        await new Promise(resolve => setTimeout(resolve, 100));

        // 检查内存中的状态（通过模拟 use-folders.ts 的逻辑）
        const foldersInDb = await db.folders.toArray();
        const foldersInMemory = []; // 这里无法直接获取内存状态，但可以检查一致性

        console.log(`📊 IndexedDB 中的文件夹: ${foldersInDb.length}`);

        // 检查数据完整性
        let issues = [];

        // 检查必要的字段
        foldersInDb.forEach((folder, index) => {
            if (!folder.id) {
                issues.push(`文件夹 ${index} 缺少 ID`);
            }
            if (!folder.name) {
                issues.push(`文件夹 ${index} 缺少名称`);
            }
            if (!folder.syncVersion) {
                issues.push(`文件夹 ${folder.name} 缺少同步版本`);
            }
            if (folder.pendingSync === undefined) {
                issues.push(`文件夹 ${folder.name} 缺少待同步标记`);
            }
            if (!folder.updatedAt) {
                issues.push(`文件夹 ${folder.name} 缺少更新时间`);
            }
        });

        // 检查父文件夹引用
        const folderIds = new Set(foldersInDb.map(f => f.id));
        foldersInDb.forEach((folder, index) => {
            if (folder.parentId && !folderIds.has(folder.parentId)) {
                issues.push(`文件夹 ${folder.name} 的父文件夹 ${folder.parentId} 不存在`);
            }
        });

        if (issues.length > 0) {
            console.log('❌ 发现数据一致性问题:');
            issues.forEach(issue => console.log(`  - ${issue}`));
        } else {
            console.log('✅ 数据一致性检查通过');
        }

        return { issues: issues.length, folderCount: foldersInDb.length };
    } catch (error) {
        console.error('❌ 检查文件夹操作一致性失败:', error);
        return { issues: -1, folderCount: 0, error: error.message };
    }
}

// 模拟文件夹操作测试
async function testFolderOperations() {
    console.log('\n🧪 测试文件夹操作...');

    try {
        const { db } = await import('./src/services/database.js');
        await new Promise(resolve => setTimeout(resolve, 100));

        // 创建测试文件夹
        const testFolder = {
            id: `test-folder-${Date.now()}`,
            name: `测试文件夹_${new Date().toLocaleTimeString()}`,
            user_id: 'test-user',
            parent_id: null,
            card_ids: [],
            created_at: new Date(),
            updated_at: new Date(),
            sync_version: 1,
            pending_sync: true,
            is_deleted: false,
            color: '#ff0000',
            icon: 'Folder'
        };

        console.log('📝 创建测试文件夹...');
        await db.folders.add(testFolder);

        // 验证创建
        const createdFolder = await db.folders.get(testFolder.id);
        if (createdFolder) {
            console.log('✅ 测试文件夹创建成功');
        } else {
            console.log('❌ 测试文件夹创建失败');
            return false;
        }

        // 更新文件夹
        console.log('📝 更新测试文件夹...');
        const updatedFolder = {
            ...createdFolder,
            name: `更新的测试文件夹_${new Date().toLocaleTimeString()}`,
            updated_at: new Date(),
            sync_version: 2,
            pending_sync: true
        };

        await db.folders.update(testFolder.id, updatedFolder);

        // 验证更新
        const retrievedFolder = await db.folders.get(testFolder.id);
        if (retrievedFolder && retrievedFolder.name === updatedFolder.name) {
            console.log('✅ 测试文件夹更新成功');
        } else {
            console.log('❌ 测试文件夹更新失败');
            return false;
        }

        // 清理测试文件夹
        console.log('🧹 清理测试文件夹...');
        await db.folders.delete(testFolder.id);

        // 验证删除
        const deletedFolder = await db.folders.get(testFolder.id);
        if (!deletedFolder) {
            console.log('✅ 测试文件夹删除成功');
        } else {
            console.log('❌ 测试文件夹删除失败');
            return false;
        }

        console.log('✅ 文件夹操作测试通过');
        return true;
    } catch (error) {
        console.error('❌ 文件夹操作测试失败:', error);
        return false;
    }
}

// 主诊断函数
async function mainDiagnosis() {
    console.log('🚀 开始文件夹状态保存问题诊断...\n');

    const results = {
        indexedDB: await checkIndexedDBFolders(),
        localStorageBackup: checkLocalStorageBackup(),
        secureStorage: checkSecureStorage(),
        initialization: checkFolderStateInitialization(),
        syncService: await checkDataSyncService(),
        consistency: await checkFolderOperationsConsistency(),
        operationsTest: await testFolderOperations()
    };

    console.log('\n' + '='.repeat(60));
    console.log('🎯 诊断结果总结:');
    console.log('='.repeat(60));

    // 评估每个组件的状态
    const components = [
        { name: 'IndexedDB', result: results.indexedDB.success },
        { name: 'localStorage备份', result: results.localStorageBackup },
        { name: 'SecureStorage', result: results.secureStorage },
        { name: '数据同步服务', result: results.syncService.success },
        { name: '数据一致性', result: results.consistency.issues === 0 },
        { name: '文件夹操作', result: results.operationsTest }
    ];

    let workingComponents = 0;
    components.forEach(({ name, result }) => {
        const status = result ? '✅' : '❌';
        console.log(`${status} ${name}: ${result ? '正常' : '异常'}`);
        if (result) workingComponents++;
    });

    console.log(`\n📊 组件健康状况: ${workingComponents}/${components.length} (${((workingComponents/components.length)*100).toFixed(1)}%)`);

    // 分析可能的问题
    console.log('\n🔍 问题分析:');

    if (!results.indexedDB.success) {
        console.log('❌ IndexedDB 连接失败，可能导致数据无法保存');
    }

    if (!results.localStorageBackup) {
        console.log('⚠️ 没有找到localStorage备份，刷新后可能无法恢复状态');
    }

    if (!results.secureStorage) {
        console.log('❌ SecureStorage 功能异常，影响数据保存和恢复');
    }

    if (!results.syncService.success) {
        console.log('❌ 数据同步服务异常，影响云端同步');
    }

    if (results.consistency.issues > 0) {
        console.log(`❌ 发现 ${results.consistency.issues} 个数据一致性问题`);
    }

    if (!results.operationsTest) {
        console.log('❌ 文件夹操作测试失败，数据保存可能有问题');
    }

    // 提供解决方案
    console.log('\n💡 解决方案建议:');

    if (workingComponents < components.length * 0.8) {
        console.log('🚨 建议执行完整修复:');
        console.log('1. 清理浏览器数据');
        console.log('2. 重新初始化数据库');
        console.log('3. 检查所有存储相关服务');
    } else if (!results.localStorageBackup) {
        console.log('🔧 建议修复备份机制:');
        console.log('1. 检查 use-folders.ts 的保存逻辑');
        console.log('2. 确保 localStorage 备份正常工作');
        console.log('3. 验证数据恢复流程');
    } else if (!results.operationsTest) {
        console.log('🔧 建议修复数据保存:');
        console.log('1. 检查 IndexedDB 事务处理');
        console.log('2. 验证文件夹操作逻辑');
        console.log('3. 测试数据持久化');
    } else {
        console.log('✅ 系统基本正常，建议监控使用情况');
    }

    console.log('\n📋 下一步操作:');
    console.log('1. 使用 storage-cleanup.html 清理存储空间');
    console.log('2. 使用 sync-test.html 测试同步功能');
    console.log('3. 重新登录并测试文件夹操作');
    console.log('4. 刷新页面验证状态保持');

    return results;
}

// 导出函数供外部使用
window.diagnoseFolderPersistence = {
    checkIndexedDBFolders,
    checkLocalStorageBackup,
    checkSecureStorage,
    checkFolderStateInitialization,
    checkDataSyncService,
    checkFolderOperationsConsistency,
    testFolderOperations,
    mainDiagnosis
};

// 执行诊断
mainDiagnosis().catch(console.error);

console.log('\n📝 文件夹状态保存诊断脚本已加载完成!');
console.log('💡 使用 window.diagnoseFolderPersistence.mainDiagnosis() 重新运行诊断');