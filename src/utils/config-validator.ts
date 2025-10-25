/**
 * 配置验证工具函数
 *
 * 用于验证应用配置的正确性和一致性
 */

import { AppConfig, AppConfigType } from '@/config/app-config';

/**
 * 配置验证结果接口
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: string;
}

/**
 * 验证应用配置
 *
 * @param config 要验证的配置对象，默认为 AppConfig
 * @returns 验证结果
 */
export function validateConfig(config: AppConfigType = AppConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证基本类型
  if (typeof config.enableDebugMode !== 'boolean') {
    errors.push('enableDebugMode 必须是布尔值');
  }

  // 验证存储模式
  const validStorageModes = ['indexeddb', 'localstorage', 'memory'];
  if (!validStorageModes.includes(config.defaultStorageMode)) {
    errors.push(`defaultStorageMode 必须是以下值之一: ${validStorageModes.join(', ')}`);
  }

  // 生成配置摘要
  const enabledFeatures = [];
  if (config.enableDebugMode) enabledFeatures.push('调试模式');

  const featureSummary = enabledFeatures.length > 0
    ? `启用功能: ${enabledFeatures.join(', ')}`
    : '标准模式';

  const summary = `配置验证完成 - ${featureSummary} | 存储模式: ${config.defaultStorageMode}`;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary
  };
}

/**
 * 检查配置是否兼容当前环境
 *
 * @param config 要检查的配置
 * @returns 兼容性检查结果
 */
export function checkEnvironmentCompatibility(config: AppConfigType = AppConfig): {
  isCompatible: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 检查浏览器兼容性
  if (typeof window !== 'undefined') {
    // 检查 IndexedDB 支持
    if (config.defaultStorageMode === 'indexeddb' && !window.indexedDB) {
      issues.push('当前浏览器不支持 IndexedDB');
      recommendations.push('考虑使用 localstorage 作为存储模式');
    }

    // 检查 localStorage 支持
    if (config.defaultStorageMode === 'localstorage' && !window.localStorage) {
      issues.push('当前浏览器不支持 localStorage');
      recommendations.push('考虑使用 memory 作为存储模式');
    }
  }

  // 检查开发环境
  const isDevelopment = import.meta.env.DEV;
  if (config.enableDebugMode && !isDevelopment) {
    recommendations.push('调试模式建议仅在开发环境中使用');
  }

  return {
    isCompatible: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * 打印配置信息到控制台
 *
 * @param config 要打印的配置
 * @param verbose 是否显示详细信息
 */
export function logConfigInfo(config: AppConfigType = AppConfig, verbose: boolean = false): void {
  const validation = validateConfig(config);
  const compatibility = checkEnvironmentCompatibility(config);

  console.group('🔧 CardAll 配置信息');
  console.log('📋 配置摘要:', validation.summary);

  if (verbose) {
    console.log('⚙️ 详细配置:', {
      enableDebugMode: config.enableDebugMode,
      defaultStorageMode: config.defaultStorageMode,
      version: config.version,
      appName: config.appName
    });
  }

  if (validation.errors.length > 0) {
    console.error('❌ 配置错误:', validation.errors);
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️ 配置警告:', validation.warnings);
  }

  if (compatibility.issues.length > 0) {
    console.error('🚫 环境兼容性问题:', compatibility.issues);
  }

  if (compatibility.recommendations.length > 0) {
    console.info('💡 建议:', compatibility.recommendations);
  }

  console.groupEnd();
}

/**
 * 导出配置信息为 JSON
 *
 * @param config 要导出的配置
 * @returns JSON 字符串
 */
export function exportConfig(config: AppConfigType = AppConfig): string {
  return JSON.stringify({
    config,
    validation: validateConfig(config),
    timestamp: new Date().toISOString(),
    version: import.meta.env.VITE_APP_VERSION || '1.0.0'
  }, null, 2);
}

export default {
  validateConfig,
  checkEnvironmentCompatibility,
  logConfigInfo,
  exportConfig
};