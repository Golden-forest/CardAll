/**
 * 应用配置文件
 *
 * 此配置文件包含应用的所有设置
 * 用于控制应用的功能启用/禁用状态
 */

export interface AppConfigType {
  /** 默认存储模式 */
  defaultStorageMode: 'indexeddb' | 'localstorage' | 'memory';
  /** 是否启用调试模式 */
  enableDebugMode: boolean;
  /** 是否启用云端同步功能 */
  enableCloudSync: boolean;
  /** 应用版本 */
  version: string;
  /** 应用名称 */
  appName: string;
}

/**
 * 应用配置对象
 *
 * 注意：这些配置值可以通过环境变量覆盖
 * 环境变量格式：VITE_ENABLE_DEBUG_MODE=true/false
 */
export const AppConfig: AppConfigType = {
  // 从环境变量读取配置，如果未设置则使用默认值
  enableDebugMode: import.meta.env.VITE_ENABLE_DEBUG_MODE === 'true' || false,

  // 云端同步功能已禁用
  enableCloudSync: false,

  // 默认使用 indexeddb 作为存储模式
  defaultStorageMode: 'indexeddb' as const,

  // 应用信息
  version: import.meta.env.VITE_APP_VERSION || '5.6.5',
  appName: import.meta.env.VITE_APP_NAME || 'CardAll',
};

/**
 * 配置验证函数
 * 确保配置值的类型和范围正确
 */
export function validateAppConfig(config: Partial<AppConfigType>): AppConfigType {
  return {
    enableDebugMode: Boolean(config.enableDebugMode),
    enableCloudSync: Boolean(config.enableCloudSync),
    defaultStorageMode: ['indexeddb', 'localstorage', 'memory'].includes(config.defaultStorageMode as any)
      ? config.defaultStorageMode as 'indexeddb' | 'localstorage' | 'memory'
      : 'indexeddb',
    version: config.version || '5.6.5',
    appName: config.appName || 'CardAll',
  };
}

/**
 * 获取当前配置的摘要信息
 */
export function getConfigSummary(config: AppConfigType = AppConfig): string {
  const features = [];
  if (config.enableDebugMode) features.push('调试模式');
  if (!config.enableCloudSync) features.push('本地模式');

  const enabledFeatures = features.length > 0 ? features.join('、') : '标准模式';
  return `CardAll ${config.version} - ${enabledFeatures} (存储: ${config.defaultStorageMode})`;
}

export default AppConfig;