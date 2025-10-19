/**
 * 应用配置文件
 *
 * 此配置文件包含云端功能的所有开关设置
 * 用于控制应用的云端功能启用/禁用状态
 */

export interface AppConfigType {
  /** 是否启用云端同步功能 */
  enableCloudSync: boolean;
  /** 是否启用认证功能 */
  enableAuth: boolean;
  /** 是否启用实时同步功能 */
  enableRealtime: boolean;
  /** 默认存储模式 */
  defaultStorageMode: 'indexeddb' | 'localstorage' | 'memory';
  /** 是否启用调试模式 */
  enableDebugMode: boolean;
}

/**
 * 应用配置对象
 *
 * 注意：这些配置值可以通过环境变量覆盖
 * 环境变量格式：VITE_ENABLE_CLOUD_SYNC=true/false
 */
export const AppConfig: AppConfigType = {
  // 从环境变量读取配置，如果未设置则使用默认值
  enableCloudSync: import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' || false,
  enableAuth: import.meta.env.VITE_ENABLE_AUTH === 'true' || false,
  enableRealtime: import.meta.env.VITE_ENABLE_REALTIME === 'true' || false,
  enableDebugMode: import.meta.env.VITE_ENABLE_DEBUG_MODE === 'true' || false,

  // 默认使用 indexeddb 作为存储模式
  defaultStorageMode: 'indexeddb' as const,
};

/**
 * 配置验证函数
 * 确保配置值的类型和范围正确
 */
export function validateAppConfig(config: Partial<AppConfigType>): AppConfigType {
  return {
    enableCloudSync: Boolean(config.enableCloudSync),
    enableAuth: Boolean(config.enableAuth),
    enableRealtime: Boolean(config.enableRealtime),
    enableDebugMode: Boolean(config.enableDebugMode),
    defaultStorageMode: ['indexeddb', 'localstorage', 'memory'].includes(config.defaultStorageMode as any)
      ? config.defaultStorageMode as 'indexeddb' | 'localstorage' | 'memory'
      : 'indexeddb',
  };
}

/**
 * 检查是否启用了任何云端功能
 */
export function isCloudFeatureEnabled(config: AppConfigType = AppConfig): boolean {
  return config.enableCloudSync || config.enableAuth || config.enableRealtime;
}

/**
 * 获取当前配置的摘要信息
 */
export function getConfigSummary(config: AppConfigType = AppConfig): string {
  const features = [];
  if (config.enableCloudSync) features.push('云端同步');
  if (config.enableAuth) features.push('用户认证');
  if (config.enableRealtime) features.push('实时同步');
  if (config.enableDebugMode) features.push('调试模式');

  const enabledFeatures = features.length > 0 ? features.join('、') : '本地模式';
  return `CardAll 配置状态: ${enabledFeatures} (存储: ${config.defaultStorageMode})`;
}

export default AppConfig;