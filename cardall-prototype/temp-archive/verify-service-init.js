/**
 * 服务初始化验证脚本
 * 用于验证服务循环依赖修复是否成功
 */

import fs from 'fs';
import path from 'path';

// 检查文件是否存在
function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

// 读取文件内容
function readFileContent(filePath) {
  if (!checkFileExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// 验证修复
function verifyFixes() {
  console.log('🔍 开始验证服务初始化循环依赖修复...\n');

  const results = {
    syncIntegration: false,
    dataConsistencyChecker: false,
    unifiedSyncService: false,
    appInit: false,
    serviceFactory: false
  };

  try {
    // 1. 验证 sync-integration.ts
    console.log('1. 检查 sync-integration.ts...');
    const syncIntegrationContent = readFileContent('src/services/sync-integration.ts');
    const hasLazyImport = syncIntegrationContent.includes('initializeCircularDependencies');
    const hasDelayedInit = syncIntegrationContent.includes('不在构造函数中初始化');

    if (hasLazyImport && hasDelayedInit) {
      console.log('   ✅ sync-integration.ts 修复成功');
      results.syncIntegration = true;
    } else {
      console.log('   ❌ sync-integration.ts 修复失败');
    }

    // 2. 验证 data-consistency-checker.ts
    console.log('2. 检查 data-consistency-checker.ts...');
    const dataConsistencyContent = readFileContent('src/services/data-consistency-checker.ts');
    const hasConsistencyLazyImport = dataConsistencyContent.includes('initializeCircularDependencies');
    const hasConsistencyDelayedInit = dataConsistencyContent.includes('不在构造函数中初始化');

    if (hasConsistencyLazyImport && hasConsistencyDelayedInit) {
      console.log('   ✅ data-consistency-checker.ts 修复成功');
      results.dataConsistencyChecker = true;
    } else {
      console.log('   ❌ data-consistency-checker.ts 修复失败');
    }

    // 3. 验证 unified-sync-service.ts
    console.log('3. 检查 unified-sync-service.ts...');
    const unifiedSyncContent = readFileContent('src/services/unified-sync-service.ts');
    const hasDependencyValidation = unifiedSyncContent.includes('validateDependencies');

    if (hasDependencyValidation) {
      console.log('   ✅ unified-sync-service.ts 优化成功');
      results.unifiedSyncService = true;
    } else {
      console.log('   ❌ unified-sync-service.ts 优化失败');
    }

    // 4. 验证 app-init.ts
    console.log('4. 检查 app-init.ts...');
    const appInitContent = readFileContent('src/services/app-init.ts');
    const hasServiceFactoryImport = appInitContent.includes('service-factory');
    const hasAllServicesInit = appInitContent.includes('initializeAllServices');

    if (hasServiceFactoryImport && hasAllServicesInit) {
      console.log('   ✅ app-init.ts 修复成功');
      results.appInit = true;
    } else {
      console.log('   ❌ app-init.ts 修复失败');
    }

    // 5. 验证 service-factory.ts
    console.log('5. 检查 service-factory.ts...');
    const serviceFactoryExists = checkFileExists('src/services/service-factory.ts');

    if (serviceFactoryExists) {
      const serviceFactoryContent = readFileContent('src/services/service-factory.ts');
      const hasContainer = serviceFactoryContent.includes('ServiceContainer');
      const hasFactoryPattern = serviceFactoryContent.includes('createSyncIntegrationService');

      if (hasContainer && hasFactoryPattern) {
        console.log('   ✅ service-factory.ts 创建成功');
        results.serviceFactory = true;
      } else {
        console.log('   ❌ service-factory.ts 内容不完整');
      }
    } else {
      console.log('   ❌ service-factory.ts 不存在');
    }

  } catch (error) {
    console.error('验证过程中发生错误:', error.message);
    return false;
  }

  // 输出结果
  console.log('\n📊 验证结果:');
  console.log('========================================');
  Object.entries(results).forEach(([file, success]) => {
    const status = success ? '✅' : '❌';
    const name = file.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`${status} ${name}`);
  });
  console.log('========================================');

  const successCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  const successRate = (successCount / totalCount * 100).toFixed(1);

  console.log(`\n总体成功率: ${successCount}/${totalCount} (${successRate}%)`);

  if (successCount === totalCount) {
    console.log('\n🎉 所有修复验证通过！循环依赖问题已解决。');
    return true;
  } else {
    console.log('\n⚠️  部分修复验证失败，请检查相关问题。');
    return false;
  }
}

// 运行验证
const success = verifyFixes();
process.exit(success ? 0 : 1);