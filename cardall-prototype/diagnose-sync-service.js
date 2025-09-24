// CardAll 数据同步服务诊断脚本
// 专门诊断云端同步功能的实现和运行状态

console.log('🌐 CardAll 数据同步服务诊断开始...\n');

// 检查同步服务依赖项
async function checkSyncDependencies() {
    console.log('📦 检查同步服务依赖项...');

    const dependencies = [
        { name: 'database', path: './src/services/database.ts' },
        { name: 'supabase', path: './src/services/supabase.ts' },
        { name: 'data-converter', path: './src/services/data-converter.ts' },
        { name: 'sync-queue', path: './src/services/sync-queue.ts' },
        { name: 'offline-manager', path: './src/services/offline-manager.ts' },
        { name: 'conflict-resolution-engine', path: './src/services/conflict-resolution-engine.ts' },
        { name: 'data-consistency-validator', path: './src/services/data-consistency-validator.ts' }
    ];

    const results = {};

    for (const dep of dependencies) {
        try {
            const module = await import(dep.path);
            results[dep.name] = {
                loaded: true,
                hasExports: Object.keys(module).length > 0,
                exports: Object.keys(module).slice(0, 5) // 只显示前5个导出
            };
            console.log(`✅ ${dep.name}: 已加载 (${Object.keys(module).length} 个导出)`);
        } catch (error) {
            results[dep.name] = {
                loaded: false,
                error: error.message
            };
            console.log(`❌ ${dep.name}: 加载失败 - ${error.message}`);
        }
    }

    return results;
}

// 检查同步服务核心功能
async function checkSyncServiceCore() {
    console.log('\n🔧 检查同步服务核心功能...');

    try {
        const dataSyncService = await import('./src/services/data-sync-service.ts');
        const { DataSyncService } = dataSyncService;

        // 检查 DataSyncService 类
        if (!DataSyncService) {
            console.log('❌ DataSyncService 类未找到');
            return false;
        }

        console.log('✅ DataSyncService 类已找到');

        // 检查核心方法
        const coreMethods = [
            'performFullSync',
            'performIncrementalSync',
            'getCurrentState',
            'getMetrics',
            'checkDataConsistency'
        ];

        let missingMethods = [];
        for (const method of coreMethods) {
            if (typeof DataSyncService.prototype[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            console.log(`❌ 缺少核心方法: ${missingMethods.join(', ')}`);
            return false;
        }

        console.log('✅ 所有核心方法都已实现');

        // 检查导出的实例
        if (!dataSyncService.dataSyncService) {
            console.log('❌ dataSyncService 实例未导出');
            return false;
        }

        console.log('✅ dataSyncService 实例已导出');
        return true;

    } catch (error) {
        console.log(`❌ 同步服务核心功能检查失败: ${error.message}`);
        return false;
    }
}

// 检查 Supabase 连接
async function checkSupabaseConnection() {
    console.log('\n☁️ 检查 Supabase 连接...');

    try {
        const supabaseModule = await import('./src/services/supabase.ts');
        const { supabase } = supabaseModule;

        if (!supabase) {
            console.log('❌ Supabase 客户端未找到');
            return false;
        }

        console.log('✅ Supabase 客户端已找到');

        // 检查必要的方法
        const requiredMethods = ['auth', 'from', 'functions'];
        let missingMethods = [];

        for (const method of requiredMethods) {
            if (typeof supabase[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            console.log(`❌ Supabase 客户端缺少方法: ${missingMethods.join(', ')}`);
            return false;
        }

        console.log('✅ Supabase 客户端方法完整');

        // 检查认证方法
        const authMethods = ['getUser', 'getSession', 'signIn', 'signOut'];
        const auth = supabase.auth;
        let missingAuthMethods = [];

        for (const method of authMethods) {
            if (typeof auth[method] !== 'function') {
                missingAuthMethods.push(method);
            }
        }

        if (missingAuthMethods.length > 0) {
            console.log(`❌ Supabase 认证缺少方法: ${missingAuthMethods.join(', ')}`);
            return false;
        }

        console.log('✅ Supabase 认证方法完整');
        return true;

    } catch (error) {
        console.log(`❌ Supabase 连接检查失败: ${error.message}`);
        return false;
    }
}

// 检查数据转换功能
async function checkDataConverter() {
    console.log('\n🔄 检查数据转换功能...');

    try {
        const dataConverterModule = await import('./src/services/data-converter.ts');
        const { DataConverter } = dataConverterModule;

        if (!DataConverter) {
            console.log('❌ DataConverter 类未找到');
            return false;
        }

        console.log('✅ DataConverter 类已找到');

        // 检查核心转换方法
        const conversionMethods = [
            'toDbCard',
            'fromDbCard',
            'toDbFolder',
            'fromDbFolder',
            'toDbTag',
            'fromDbTag'
        ];

        let missingMethods = [];
        for (const method of conversionMethods) {
            if (typeof DataConverter[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            console.log(`❌ DataConverter 缺少方法: ${missingMethods.join(', ')}`);
            return false;
        }

        console.log('✅ DataConverter 方法完整');
        return true;

    } catch (error) {
        console.log(`❌ 数据转换功能检查失败: ${error.message}`);
        return false;
    }
}

// 检查同步队列管理
async function checkSyncQueue() {
    console.log('\n📋 检查同步队列管理...');

    try {
        const syncQueueModule = await import('./src/services/sync-queue.ts');
        const { syncQueueManager } = syncQueueModule;

        if (!syncQueueManager) {
            console.log('❌ syncQueueManager 未找到');
            return false;
        }

        console.log('✅ syncQueueManager 已找到');

        // 检查队列管理方法
        const queueMethods = [
            'enqueue',
            'dequeue',
            'processQueue',
            'getQueueStatus',
            'setEventListeners'
        ];

        let missingMethods = [];
        for (const method of queueMethods) {
            if (typeof syncQueueManager[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            console.log(`❌ syncQueueManager 缺少方法: ${missingMethods.join(', ')}`);
            return false;
        }

        console.log('✅ syncQueueManager 方法完整');
        return true;

    } catch (error) {
        console.log(`❌ 同步队列管理检查失败: ${error.message}`);
        return false;
    }
}

// 检查离线管理器
async function checkOfflineManager() {
    console.log('\n📴 检查离线管理器...');

    try {
        const offlineModule = await import('./src/services/offline-manager.ts');
        const { offlineManager } = offlineModule;

        if (!offlineManager) {
            console.log('❌ offlineManager 未找到');
            return false;
        }

        console.log('✅ offlineManager 已找到');

        // 检查离线管理方法
        const offlineMethods = [
            'isOnline',
            'registerOfflineHandler',
            'registerOnlineHandler',
            'getConnectionStatus'
        ];

        let missingMethods = [];
        for (const method of offlineMethods) {
            if (typeof offlineManager[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            console.log(`❌ offlineManager 缺少方法: ${missingMethods.join(', ')}`);
            return false;
        }

        console.log('✅ offlineManager 方法完整');
        return true;

    } catch (error) {
        console.log(`❌ 离线管理器检查失败: ${error.message}`);
        return false;
    }
}

// 检查冲突解决引擎
async function checkConflictResolution() {
    console.log('\n⚔️ 检查冲突解决引擎...');

    try {
        const conflictModule = await import('./src/services/conflict-resolution-engine.ts');
        const { conflictResolutionEngine } = conflictModule;

        if (!conflictResolutionEngine) {
            console.log('❌ conflictResolutionEngine 未找到');
            return false;
        }

        console.log('✅ conflictResolutionEngine 已找到');

        // 检查冲突解决方法
        const conflictMethods = [
            'resolveConflict',
            'autoResolve',
            'getConflicts',
            'clearConflicts'
        ];

        let missingMethods = [];
        for (const method of conflictMethods) {
            if (typeof conflictResolutionEngine[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            console.log(`❌ conflictResolutionEngine 缺少方法: ${missingMethods.join(', ')}`);
            return false;
        }

        console.log('✅ conflictResolutionEngine 方法完整');
        return true;

    } catch (error) {
        console.log(`❌ 冲突解决引擎检查失败: ${error.message}`);
        return false;
    }
}

// 检查数据一致性验证器
async function checkDataConsistencyValidator() {
    console.log('\n✅ 检查数据一致性验证器...');

    try {
        const validatorModule = await import('./src/services/data-consistency-validator.ts');
        const { dataConsistencyValidator } = validatorModule;

        if (!dataConsistencyValidator) {
            console.log('❌ dataConsistencyValidator 未找到');
            return false;
        }

        console.log('✅ dataConsistencyValidator 已找到');

        // 检查验证方法
        const validatorMethods = [
            'validateConsistency',
            'validateCards',
            'validateFolders',
            'autoRepair'
        ];

        let missingMethods = [];
        for (const method of validatorMethods) {
            if (typeof dataConsistencyValidator[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            console.log(`❌ dataConsistencyValidator 缺少方法: ${missingMethods.join(', ')}`);
            return false;
        }

        console.log('✅ dataConsistencyValidator 方法完整');
        return true;

    } catch (error) {
        console.log(`❌ 数据一致性验证器检查失败: ${error.message}`);
        return false;
    }
}

// 模拟同步流程测试
async function testSyncWorkflow() {
    console.log('\n🧪 模拟同步流程测试...');

    try {
        // 这里我们只能测试模块加载，无法实际运行同步
        // 因为需要真实的浏览器环境和用户认证

        console.log('📋 同步流程组件检查:');

        // 1. 检查数据同步服务是否可以创建实例
        const dataSyncServiceModule = await import('./src/services/data-sync-service.ts');
        const { DataSyncService, dataSyncService } = dataSyncServiceModule;

        if (!dataSyncService) {
            console.log('❌ 全局 dataSyncService 实例未找到');
            return false;
        }

        console.log('✅ 全局 dataSyncService 实例已找到');

        // 2. 检查实例的方法
        const instanceMethods = [
            'performFullSync',
            'performIncrementalSync',
            'getCurrentState',
            'getMetrics'
        ];

        let missingInstanceMethods = [];
        for (const method of instanceMethods) {
            if (typeof dataSyncService[method] !== 'function') {
                missingInstanceMethods.push(method);
            }
        }

        if (missingInstanceMethods.length > 0) {
            console.log(`❌ dataSyncService 实例缺少方法: ${missingInstanceMethods.join(', ')}`);
            return false;
        }

        console.log('✅ dataSyncService 实例方法完整');

        // 3. 检查初始状态
        const currentState = dataSyncService.getCurrentState();
        console.log(`📊 当前同步状态: ${currentState}`);

        // 4. 检查指标
        const metrics = dataSyncService.getMetrics();
        console.log(`📊 同步指标: ${JSON.stringify(metrics, null, 2)}`);

        console.log('✅ 同步流程组件检查完成');
        return true;

    } catch (error) {
        console.log(`❌ 同步流程测试失败: ${error.message}`);
        return false;
    }
}

// 主诊断函数
async function mainDiagnosis() {
    console.log('🚀 开始数据同步服务诊断...\n');

    const results = {
        dependencies: await checkSyncDependencies(),
        syncServiceCore: await checkSyncServiceCore(),
        supabaseConnection: await checkSupabaseConnection(),
        dataConverter: await checkDataConverter(),
        syncQueue: await checkSyncQueue(),
        offlineManager: await checkOfflineManager(),
        conflictResolution: await checkConflictResolution(),
        dataConsistencyValidator: await checkDataConsistencyValidator(),
        syncWorkflow: await testSyncWorkflow()
    };

    console.log('\n' + '='.repeat(60));
    console.log('🎯 同步服务诊断结果总结:');
    console.log('='.repeat(60));

    // 评估每个组件的状态
    const components = [
        { name: '依赖项加载', result: Object.values(results.dependencies).every(d => d.loaded) },
        { name: '同步服务核心', result: results.syncServiceCore },
        { name: 'Supabase连接', result: results.supabaseConnection },
        { name: '数据转换器', result: results.dataConverter },
        { name: '同步队列管理', result: results.syncQueue },
        { name: '离线管理器', result: results.offlineManager },
        { name: '冲突解决引擎', result: results.conflictResolution },
        { name: '数据一致性验证器', result: results.dataConsistencyValidator },
        { name: '同步流程', result: results.syncWorkflow }
    ];

    let workingComponents = 0;
    components.forEach(({ name, result }) => {
        const status = result ? '✅' : '❌';
        console.log(`${status} ${name}: ${result ? '正常' : '异常'}`);
        if (result) workingComponents++;
    });

    console.log(`\n📊 组件健康状况: ${workingComponents}/${components.length} (${((workingComponents/components.length)*100).toFixed(1)}%)`);

    // 分析问题
    console.log('\n🔍 问题分析:');

    if (workingComponents < components.length * 0.8) {
        console.log('🚨 严重问题：多个组件异常，同步功能可能完全失效');
    } else if (workingComponents < components.length) {
        console.log('⚠️ 部分组件异常，同步功能可能受限');
    } else {
        console.log('✅ 所有组件正常，问题可能在运行时逻辑');
    }

    // 提供解决方案
    console.log('\n💡 解决方案建议:');

    if (!results.supabaseConnection) {
        console.log('1. 🔧 修复 Supabase 连接问题');
        console.log('   - 检查 Supabase 配置');
        console.log('   - 验证网络连接');
        console.log('   - 确认认证状态');
    }

    if (!results.syncServiceCore) {
        console.log('2. 🔧 修复同步服务核心功能');
        console.log('   - 检查 DataSyncService 类实现');
        console.log('   - 确保核心方法完整');
        console.log('   - 验证实例导出');
    }

    if (!results.dependencies) {
        console.log('3. 🔧 修复依赖项问题');
        console.log('   - 检查模块导入路径');
        console.log('   - 验证依赖项安装');
        console.log('   - 确保导出正确');
    }

    if (workingComponents === components.length) {
        console.log('✅ 所有组件正常，建议：');
        console.log('1. 检查用户认证状态');
        console.log('2. 验证网络连接');
        console.log('3. 查看浏览器控制台错误');
        console.log('4. 测试实际的同步操作');
    }

    console.log('\n📋 下一步操作:');
    console.log('1. 运行 storage-cleanup.html 清理存储空间');
    console.log('2. 尝试重新登录应用');
    console.log('3. 在浏览器控制台中测试同步功能');
    console.log('4. 检查网络请求是否正常');

    return results;
}

// 导出函数供外部使用
if (typeof window !== 'undefined') {
    window.diagnoseSyncService = {
        checkSyncDependencies,
        checkSyncServiceCore,
        checkSupabaseConnection,
        checkDataConverter,
        checkSyncQueue,
        checkOfflineManager,
        checkConflictResolution,
        checkDataConsistencyValidator,
        testSyncWorkflow,
        mainDiagnosis
    };
}

// Node.js 环境导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkSyncDependencies,
        checkSyncServiceCore,
        checkSupabaseConnection,
        checkDataConverter,
        checkSyncQueue,
        checkOfflineManager,
        checkConflictResolution,
        checkDataConsistencyValidator,
        testSyncWorkflow,
        mainDiagnosis
    };
}

// 执行诊断
mainDiagnosis().catch(console.error);

console.log('\n📝 同步服务诊断脚本已加载完成!');
console.log('💡 使用 window.diagnoseSyncService.mainDiagnosis() 重新运行诊断');