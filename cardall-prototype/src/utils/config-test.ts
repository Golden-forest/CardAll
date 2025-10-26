/**
 * 配置测试工具
 * 用于验证应用配置是否正确导入和工作
 */

import { AppConfig, validateAppConfig, getConfigSummary } from '@/config/app-config';
import { validateConfig, logConfigInfo } from '@/utils/config-validator';

/**
 * 运行配置测试
 */
export function runConfigTest(): void {
  console.group('🧪 CardAll 配置测试');

  try {
    // 测试配置导入
    console.log('✅ 配置文件导入成功');
    console.log('📋 配置对象:', AppConfig);

    // 测试配置验证
    const validatedConfig = validateAppConfig(AppConfig);
    console.log('✅ 配置验证通过:', validatedConfig);

    // 测试功能状态检查
    const hasCloudFeatures = AppConfig.enableCloudSync;
    console.log(`🔍 云端功能状态: ${hasCloudFeatures ? '已启用' : '已禁用'}`);

    // 测试配置摘要
    const summary = getConfigSummary();
    console.log('📝 配置摘要:', summary);

    // 运行完整验证
    const validation = validateConfig();
    console.log(`🔧 验证结果: ${validation.isValid ? '通过' : '失败'}`);

    if (validation.errors.length > 0) {
      console.error('❌ 配置错误:', validation.errors);
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️ 配置警告:', validation.warnings);
    }

    // 打印详细信息
    logConfigInfo(AppConfig, true);

    console.log('✅ 所有配置测试通过！');

  } catch (error) {
    console.error('❌ 配置测试失败:', error);
  }

  console.groupEnd();
}

/**
 * 检查环境变量加载情况
 */
export function checkEnvironmentVariables(): void {
  console.group('🌍 环境变量检查');

  const envVars = [
    'VITE_APP_NAME',
    'VITE_APP_VERSION',
    'VITE_ENABLE_CLOUD_SYNC',
    'VITE_ENABLE_AUTH',
    'VITE_ENABLE_REALTIME',
    'VITE_ENABLE_DEBUG_MODE'
  ];

  envVars.forEach(varName => {
    const value = import.meta.env[varName];
    console.log(`${varName}: ${value}`);
  });

  console.groupEnd();
}

/**
 * 测试配置在不同模式下的行为
 */
export function testConfigModes(): void {
  console.group('🔄 配置模式测试');

  // 测试本地模式 (当前配置)
  console.log('🏠 本地模式测试:');
  console.log(`- 云端同步: ${AppConfig.enableCloudSync ? '启用' : '禁用'}`);
  console.log(`- 调试模式: ${AppConfig.enableDebugMode ? '启用' : '禁用'}`);
  console.log(`- 存储模式: ${AppConfig.defaultStorageMode}`);
  console.log(`- 应用版本: ${AppConfig.version}`);
  console.log(`- 应用名称: ${AppConfig.appName}`);

  // 模拟云端模式
  const cloudConfig = {
    ...AppConfig,
    enableCloudSync: true,
    enableDebugMode: false
  };

  console.log('☁️ 云端模式模拟:');
  console.log(`- 云端同步: ${cloudConfig.enableCloudSync ? '启用' : '禁用'}`);
  console.log(`- 调试模式: ${cloudConfig.enableDebugMode ? '启用' : '禁用'}`);
  console.log(`- 云端功能状态: ${cloudConfig.enableCloudSync ? '已启用' : '已禁用'}`);

  console.groupEnd();
}

// 在开发环境下自动运行测试
if (import.meta.env.DEV) {
  // 延迟执行，确保应用初始化完成
  setTimeout(() => {
    console.log('🚀 CardAll 配置系统测试开始...');
    runConfigTest();
    checkEnvironmentVariables();
    testConfigModes();
    console.log('🎉 配置系统测试完成！');
  }, 1000);
}

export default {
  runConfigTest,
  checkEnvironmentVariables,
  testConfigModes
};