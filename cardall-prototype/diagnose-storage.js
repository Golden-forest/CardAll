// CardAll 存储问题诊断脚本
// 专门诊断 localStorage 配额超限问题

console.log('🔍 CardAll 存储问题诊断开始...\n');

// 详细分析 localStorage 内容
function analyzeLocalStorage() {
    console.log('📊 详细分析 localStorage 内容...\n');

    const analysis = {
        totalSize: 0,
        itemCount: 0,
        categories: {
            auth: { count: 0, size: 0, items: [] },
            supabase: { count: 0, size: 0, items: [] },
            sync: { count: 0, size: 0, items: [] },
            folders: { count: 0, size: 0, items: [] },
            cache: { count: 0, size: 0, items: [] },
            backup: { count: 0, size: 0, items: [] },
            debug: { count: 0, size: 0, items: [] },
            other: { count: 0, size: 0, items: [] }
        },
        largeItems: [],
        potentialProblems: []
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const size = (key.length + value.length) * 2;

        analysis.totalSize += size;
        analysis.itemCount++;

        // 分类
        let category = 'other';
        if (key.includes('auth') || key.includes('token')) {
            category = 'auth';
        } else if (key.includes('supabase')) {
            category = 'supabase';
        } else if (key.includes('sync') || key.includes('queue')) {
            category = 'sync';
        } else if (key.includes('folder')) {
            category = 'folders';
        } else if (key.includes('cache')) {
            category = 'cache';
        } else if (key.includes('backup')) {
            category = 'backup';
        } else if (key.includes('debug') || key.includes('test')) {
            category = 'debug';
        }

        analysis.categories[category].count++;
        analysis.categories[category].size += size;
        analysis.categories[category].items.push({ key, size: size / 1024 });

        // 记录大项目
        if (size > 50 * 1024) { // 大于50KB
            analysis.largeItems.push({ key, size: size / 1024 });
        }

        // 检查潜在问题
        if (key.includes('supabase.auth.token')) {
            try {
                const tokenData = JSON.parse(value);
                if (tokenData.expires_at) {
                    const now = Date.now();
                    if (tokenData.expires_at < now) {
                        analysis.potentialProblems.push({
                            type: 'expired_token',
                            key,
                            message: `过期令牌: ${key}`
                        });
                    }
                }
            } catch (e) {
                analysis.potentialProblems.push({
                    type: 'corrupt_token',
                    key,
                    message: `损坏的令牌: ${key}`
                });
            }
        }

        if (size > 100 * 1024) { // 大于100KB
            analysis.potentialProblems.push({
                type: 'large_item',
                key,
                message: `超大项目: ${key} (${(size / 1024).toFixed(2)} KB)`
            });
        }
    }

    return analysis;
}

// 显示分析结果
function displayAnalysis(analysis) {
    console.log('📈 localStorage 分析结果:');
    console.log('=' .repeat(60));
    console.log(`总大小: ${(analysis.totalSize / 1024).toFixed(2)} KB (${(analysis.totalSize / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`项目数量: ${analysis.itemCount}`);
    console.log(`配额使用率: ${((analysis.totalSize / (5 * 1024 * 1024)) * 100).toFixed(1)}%`);
    console.log('');

    // 显示分类统计
    console.log('📂 分类统计:');
    Object.entries(analysis.categories).forEach(([category, data]) => {
        if (data.count > 0) {
            console.log(`${category.padEnd(10)}: ${data.count} 项, ${(data.size / 1024).toFixed(2)} KB`);
        }
    });

    // 显示大项目
    if (analysis.largeItems.length > 0) {
        console.log('\n🚨 大项目 (>50KB):');
        analysis.largeItems.forEach(item => {
            console.log(`  - ${item.key}: ${item.size.toFixed(2)} KB`);
        });
    }

    // 显示潜在问题
    if (analysis.potentialProblems.length > 0) {
        console.log('\n⚠️ 潜在问题:');
        analysis.potentialProblems.forEach(problem => {
            console.log(`  - ${problem.message}`);
        });
    }

    // 检查具体的 supabase.auth.token 问题
    console.log('\n🔐 认证令牌详细检查:');
    const authTokens = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('supabase.auth.token')) {
            const value = localStorage.getItem(key);
            const size = (key.length + value.length) * 2;
            authTokens.push({ key, size: size / 1024, value });
        }
    }

    if (authTokens.length > 0) {
        authTokens.forEach(token => {
            console.log(`  - ${token.key}: ${token.size.toFixed(2)} KB`);
            try {
                const parsed = JSON.parse(token.value);
                if (parsed.expires_at) {
                    const expired = parsed.expires_at < Date.now();
                    console.log(`    状态: ${expired ? '已过期' : '有效'}`);
                    console.log(`    过期时间: ${new Date(parsed.expires_at).toLocaleString()}`);
                }
            } catch (e) {
                console.log(`    状态: 解析失败`);
            }
        });
    } else {
        console.log('  没有找到认证令牌');
    }
}

// 检查浏览器存储限制
function checkStorageLimits() {
    console.log('\n🔍 浏览器存储限制检查:');

    // 尝试检测存储限制
    try {
        const testKey = 'storage_test';
        const testData = 'x'.repeat(1024 * 1024); // 1MB 测试数据

        // 尝试写入大块数据
        let totalSize = 0;
        let i = 0;
        while (i < 10) {
            try {
                localStorage.setItem(`${testKey}_${i}`, testData);
                totalSize += 1024 * 1024;
                i++;
            } catch (e) {
                console.log(`  在 ${totalSize} MB 时达到存储限制`);
                break;
            }
        }

        // 清理测试数据
        for (let j = 0; j < i; j++) {
            localStorage.removeItem(`${testKey}_${j}`);
        }

        console.log(`  估计存储限制: > ${totalSize} MB`);
    } catch (e) {
        console.log(`  存储限制检测失败: ${e.message}`);
    }

    // 检查存储管理器API
    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
            console.log(`  已用空间: ${(estimate.usage / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  可用空间: ${(estimate.quota / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  总配额: ${(estimate.quota / 1024 / 1024).toFixed(2)} MB`);
        }).catch(e => {
            console.log(`  存储信息获取失败: ${e.message}`);
        });
    }
}

// 模拟登录失败场景
function simulateLoginError() {
    console.log('\n🔐 模拟登录失败场景分析:');

    // 检查是否有 supabase.auth.token 相关的错误
    const authKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('supabase') && key.includes('auth')) {
            authKeys.push(key);
        }
    }

    console.log(`  找到 ${authKeys.length} 个认证相关项目:`);
    authKeys.forEach(key => {
        const value = localStorage.getItem(key);
        const size = (key.length + value.length) * 2;
        console.log(`    - ${key}: ${(size / 1024).toFixed(2)} KB`);
    });

    // 检查是否有超大令牌
    const largeAuthTokens = authKeys.filter(key => {
        const value = localStorage.getItem(key);
        const size = (key.length + value.length) * 2;
        return size > 1024 * 1024; // 大于1MB
    });

    if (largeAuthTokens.length > 0) {
        console.log(`  ⚠️ 发现超大认证令牌 (${largeAuthTokens.length} 个):`);
        largeAuthTokens.forEach(key => {
            const value = localStorage.getItem(key);
            const size = (key.length + value.length) * 2;
            console.log(`    - ${key}: ${(size / 1024 / 1024).toFixed(2)} MB`);
        });
    }

    // 分析可能导致配额超限的原因
    console.log('\n  🔍 配额超限原因分析:');
    const totalSize = Array.from({length: localStorage.length}, (_, i) => {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        return (key.length + value.length) * 2;
    }).reduce((sum, size) => sum + size, 0);

    const quotaLimit = 5 * 1024 * 1024; // 5MB
    const usagePercent = (totalSize / quotaLimit) * 100;

    console.log(`    - 总使用量: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`    - 配额限制: 5 MB`);
    console.log(`    - 使用率: ${usagePercent.toFixed(1)}%`);

    if (usagePercent > 90) {
        console.log('    - 状态: 严重超限，需要立即清理');
    } else if (usagePercent > 70) {
        console.log('    - 状态: 使用率较高，建议清理');
    } else if (usagePercent > 50) {
        console.log('    - 状态: 使用率正常，但可能有单个项目过大');
    } else {
        console.log('    - 状态: 使用率正常，可能是其他问题');
    }
}

// 提供解决方案建议
function provideSolutions() {
    console.log('\n💡 解决方案建议:');
    console.log('=' .repeat(60));

    console.log('1. 🔐 认证数据清理:');
    console.log('   - 删除过期的认证令牌');
    console.log('   - 清理重复的认证数据');
    console.log('   - 移除损坏的令牌数据');

    console.log('\n2. 🔄 同步数据优化:');
    console.log('   - 清理过期的同步队列');
    console.log('   - 移除重复的同步记录');
    console.log('   - 限制同步历史记录数量');

    console.log('\n3. 💾 备份数据管理:');
    console.log('   - 只保留最近的几个备份');
    console.log('   - 压缩备份数据');
    console.log('   - 定期清理旧备份');

    console.log('\n4. 🧹 缓存数据清理:');
    console.log('   - 清理临时缓存');
    console.log('   - 移除调试数据');
    console.log('   - 删除测试数据');

    console.log('\n5. ⚡ 紧急解决方案:');
    console.log('   - 使用 storage-cleanup.html 页面进行一键清理');
    console.log('   - 在浏览器中清除所有站点数据');
    console.log('   - 重新登录并重新授权');
}

// 主诊断函数
function mainDiagnosis() {
    console.log('🚀 开始 CardAll 存储问题诊断...\n');

    try {
        const analysis = analyzeLocalStorage();
        displayAnalysis(analysis);
        checkStorageLimits();
        simulateLoginError();
        provideSolutions();

        console.log('\n' + '=' .repeat(60));
        console.log('🎯 诊断完成!');
        console.log('\n📋 下一步建议:');
        console.log('1. 打开 storage-cleanup.html 页面');
        console.log('2. 执行深度清理');
        console.log('3. 尝试重新登录');
        console.log('4. 如果问题仍然存在，清除浏览器数据后重试');

    } catch (error) {
        console.error('❌ 诊断过程中出现错误:', error);
    }
}

// 导出函数供外部使用
window.diagnoseStorage = {
    analyzeLocalStorage,
    displayAnalysis,
    checkStorageLimits,
    simulateLoginError,
    provideSolutions,
    mainDiagnosis
};

// 执行诊断
mainDiagnosis();

console.log('\n📝 诊断脚本已加载完成!');
console.log('💡 使用 window.diagnoseStorage.mainDiagnosis() 重新运行诊断');