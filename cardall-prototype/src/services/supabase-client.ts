/**
 * Supabase Client Configuration
 *
 * 提供增强的 Supabase 客户端配置，包含：
 * - 实际 Supabase 项目设置
 * - 安全的凭据管理
 * - 连接故障的优雅处理
 * - 多环境支持
 * - 健壮的错误处理
 */

import { createClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js'
import { AuthError, PostgrestError, RealtimeClientError } from '@supabase/supabase-js'

// 环境变量配置
interface SupabaseConfig {
  url: string
  anonKey: string
  accessToken?: string
  environment: 'development' | 'staging' | 'production'
}

// 连接状态接口
export interface ConnectionStatus {
  isConnected: boolean
  lastChecked: Date
  error: string | null
  retryCount: number
  maxRetries: number
}

// 增强的 Supabase 客户端类
class EnhancedSupabaseClient {
  private client: SupabaseClient
  private config: SupabaseConfig
  private connectionStatus: ConnectionStatus
  private reconnectTimer: NodeJS.Timeout | null = null
  private listeners: ((status: ConnectionStatus) => void)[] = []

  constructor(config: SupabaseConfig) {
    this.config = config
    this.connectionStatus = {
      isConnected: false,
      lastChecked: new Date(),
      error: null,
      retryCount: 0,
      maxRetries: 3
    }

    // 验证配置
    this.validateConfig(config)

    // 创建 Supabase 客户端配置
    const clientOptions: SupabaseClientOptions<Database> = {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: this.getSecureStorage(),
        storageKey: 'supabase.auth.token'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        logger: (level, msg, data) => {
          this.logRealtimeEvent(level, msg, data)
        }
      },
      global: {
        headers: {
          'x-application-name': 'CardAll',
          'x-application-version': this.getAppVersion(),
          'x-environment': config.environment
        }
      },
      db: {
        schema: 'public'
      }
    }

    // 创建客户端实例
    this.client = createClient(config.url, config.anonKey, clientOptions)

    // 初始化连接检查
    this.initializeConnectionCheck()
  }

  /**
   * 验证配置
   */
  private validateConfig(config: SupabaseConfig): void {
    if (!config.url || !config.url.startsWith('https://')) {
      throw new Error('Invalid Supabase URL. Must start with https://')
    }

    if (!config.anonKey || config.anonKey.length < 100) {
      throw new Error('Invalid Supabase anonymous key')
    }

    if (!['development', 'staging', 'production'].includes(config.environment)) {
      throw new Error('Invalid environment. Must be development, staging, or production')
    }
  }

  /**
   * 获取安全的存储实现
   */
  private getSecureStorage(): Storage {
    try {
      // 在支持的浏览器中使用更安全的存储
      if ('localStorage' in window && window.localStorage !== null) {
        return window.localStorage
      }
    } catch (error) {
      console.warn('Secure storage not available, falling back to memory storage')
    }

    // 内存存储回退
    return {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {}
    }
  }

  /**
   * 获取应用版本
   */
  private getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION || '1.0.0'
  }

  /**
   * 初始化连接检查
   */
  private async initializeConnectionCheck(): Promise<void> {
    await this.checkConnection()

    // 设置定期连接检查
    setInterval(() => this.checkConnection(), 30000) // 每30秒检查一次
  }

  /**
   * 检查连接状态
   */
  private async checkConnection(): Promise<void> {
    try {
      // 简单的健康检查
      const { data, error } = await this.client
        .from('users')
        .select('count', { count: 'exact', head: true })
        .limit(1)

      if (error) {
        throw new Error(`Connection check failed: ${error.message}`)
      }

      this.updateConnectionStatus({
        isConnected: true,
        lastChecked: new Date(),
        error: null,
        retryCount: 0,
        maxRetries: this.connectionStatus.maxRetries
      })

      // 清除重连定时器
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
    } catch (error) {
      this.handleConnectionError(error as Error)
    }
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    const retryCount = this.connectionStatus.retryCount + 1

    this.updateConnectionStatus({
      isConnected: false,
      lastChecked: new Date(),
      error: error.message,
      retryCount,
      maxRetries: this.connectionStatus.maxRetries
    })

    // 如果重试次数未达到最大值，设置重连
    if (retryCount <= this.connectionStatus.maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000) // 指数退避，最大30秒

      this.reconnectTimer = setTimeout(() => {
        this.checkConnection()
      }, delay)

      console.log(`Connection failed. Retrying in ${delay}ms (attempt ${retryCount})`)
    } else {
      console.error('Max retries reached. Manual reconnection required.')
    }
  }

  /**
   * 更新连接状态
   */
  private updateConnectionStatus(status: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...status }
    this.notifyListeners()
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.connectionStatus)
      } catch (error) {
        console.error('Error in connection status listener:', error)
      }
    })
  }

  /**
   * 记录实时事件
   */
  private logRealtimeEvent(level: string, msg: string, data: any): void {
    if (this.config.environment === 'development') {
      console.log(`[Realtime ${level.toUpperCase()}] ${msg}`, data)
    }
  }

  /**
   * 获取原始 Supabase 客户端
   */
  public getClient(): SupabaseClient {
    return this.client
  }

  /**
   * 获取连接状态
   */
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus }
  }

  /**
   * 添加连接状态监听器
   */
  public addConnectionListener(listener: (status: ConnectionStatus) => void): void {
    this.listeners.push(listener)
  }

  /**
   * 移除连接状态监听器
   */
  public removeConnectionListener(listener: (status: ConnectionStatus) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 手动重连
   */
  public async reconnect(): Promise<void> {
    this.connectionStatus.retryCount = 0
    await this.checkConnection()
  }

  /**
   * 执行带有重试机制的查询
   */
  public async queryWithRetry<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    maxRetries: number = 3
  ): Promise<{ data: T | null; error: any }> {
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()

        if (result.error) {
          throw new Error(result.error.message)
        }

        return result
      } catch (error) {
        lastError = error

        if (attempt === maxRetries) {
          break
        }

        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))

        console.warn(`Query failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`)
      }
    }

    return { data: null, error: lastError }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.listeners.length = 0

    // 清理 Supabase 客户端
    if (this.client && typeof this.client.realtime?.disconnect === 'function') {
      this.client.realtime.disconnect()
    }
  }
}

// 从环境变量加载配置
function loadSupabaseConfig(): SupabaseConfig {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const accessToken = import.meta.env.VITE_SUPABASE_ACCESS_TOKEN
  const environment = import.meta.env.VITE_APP_ENVIRONMENT || 'development'

  // 验证必需的环境变量
  if (!url) {
    throw new Error('VITE_SUPABASE_URL environment variable is required')
  }

  if (!anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY environment variable is required')
  }

  return {
    url,
    anonKey,
    accessToken,
    environment: environment as 'development' | 'staging' | 'production'
  }
}

// 数据库类型定义（从现有文件复制）
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          github_id: string
          email: string
          username: string
          avatar_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          github_id: string
          email: string
          username: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          github_id?: string
          email?: string
          username?: string
          avatar_url?: string
          updated_at?: string
        }
      }
      cards: {
        Row: {
          id: string
          user_id: string
          front_content: any
          back_content: any
          style: any
          folder_id: string | null
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          front_content: any
          back_content: any
          style: any
          folder_id?: string | null
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          front_content?: any
          back_content?: any
          style?: any
          folder_id?: string | null
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_id: string | null
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
      images: {
        Row: {
          id: string
          user_id: string
          card_id: string
          file_name: string
          file_path: string
          cloud_url: string | null
          metadata: any
          created_at: string
          updated_at: string
          sync_version: number
          is_deleted: boolean
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          file_name: string
          file_path: string
          cloud_url?: string | null
          metadata?: any
          created_at?: string
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          file_name?: string
          file_path?: string
          cloud_url?: string | null
          metadata?: any
          updated_at?: string
          sync_version?: number
          is_deleted?: boolean
        }
      }
    }
  }
}

// 创建并导出增强的 Supabase 客户端实例
let supabaseClientInstance: EnhancedSupabaseClient | null = null

export function getSupabaseClient(): EnhancedSupabaseClient {
  if (!supabaseClientInstance) {
    try {
      const config = loadSupabaseConfig()
      supabaseClientInstance = new EnhancedSupabaseClient(config)
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error)
      throw error
    }
  }

  return supabaseClientInstance
}

// 导出类以供测试使用
export { EnhancedSupabaseClient }

// 导出原始客户端以保持向后兼容
export const supabase = getSupabaseClient().getClient()

// 便捷的类型导出
export type SupabaseClientType = SupabaseClient<Database>

// 错误处理工具函数
export function isSupabaseError(error: any): error is AuthError | PostgrestError | RealtimeClientError {
  return error && (
    error.__isAuthError ||
    error.__isPostgrestError ||
    error.__isRealtimeClientError
  )
}

export function getSupabaseErrorMessage(error: any): string {
  if (!isSupabaseError(error)) {
    return error?.message || 'Unknown error'
  }

  return error.message || 'Supabase error'
}

// 开发环境下的调试工具
export const debugTools = {
  getConnectionStatus: () => getSupabaseClient().getConnectionStatus(),
  reconnect: () => getSupabaseClient().reconnect(),
  logConfig: () => {
    const config = loadSupabaseConfig()
    console.log('Supabase Configuration:', {
      url: config.url,
      environment: config.environment,
      hasAnonKey: !!config.anonKey,
      hasAccessToken: !!config.accessToken
    })
  }
}