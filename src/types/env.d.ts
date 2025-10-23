/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_ENVIRONMENT: string

  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_ACCESS_TOKEN: string

  // 云端功能开关配置
  readonly VITE_ENABLE_CLOUD_SYNC: string
  readonly VITE_ENABLE_AUTH: string
  readonly VITE_ENABLE_REALTIME: string
  readonly VITE_ENABLE_DEBUG_MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 全局变量声明 (由 vite.config.ts 的 define 注入)
declare const __ENABLE_CLOUD_SYNC__: boolean;
declare const __ENABLE_AUTH__: boolean;
declare const __ENABLE_REALTIME__: boolean;
declare const __ENABLE_DEBUG_MODE__: boolean;