// ============================================================================
// 认证服务适配器
// ============================================================================
// 创建时间：2025-09-13
// 功能：为现有UI组件提供统一的认证服务API接口
// ============================================================================

import { BaseAdapter, AdapterOptions } from './base-adapter'
import {
  AuthState,
  AuthStateChangeListener
} from './types'
import { authService } from '../auth'
import { versionCheck } from './version-manager'

// ============================================================================
// 认证服务适配器选项
// ============================================================================

export // ============================================================================
// 用户信息接口
// ============================================================================

export // ============================================================================
// 认证结果接口
// ============================================================================

export // ============================================================================
// 认证服务适配器实现
// ============================================================================

export class AuthServiceAdapter extends BaseAdapter {
  private authService: typeof authService
  private authStateListeners: Set<AuthStateChangeListener> = new Set()
  private authUnsubscribe: (() => void) | null = null
  private refreshTimer: NodeJS.Timeout | null = null

  constructor(options: AuthServiceAdapterOptions) {
    super({
      ...options,
      name: 'auth-service',
      version: '1.0.0'
    })
    
    this.authService = authService
  }

  // ============================================================================
  // 基础适配器方法实现
  // ============================================================================

  protected async initialize(): Promise<void> {
    this.log('info', '初始化认证服务适配器')
    
    // 设置认证状态监听器
    this.setupAuthListeners()
    
    // 启用自动令牌刷新
    if (this.options.enableAutoRefresh) {
      this.startTokenRefresh()
    }
  }

  protected async dispose(): Promise<void> {
    this.log('info', '清理认证服务适配器')
    
    // 清理认证监听器
    if (this.authUnsubscribe) {
      this.authUnsubscribe()
      this.authUnsubscribe = null
    }
    
    // 清理刷新定时器
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    
    // 清理监听器
    this.authStateListeners.clear()
  }

  protected async checkReadiness(): Promise<boolean> {
    try {
      // 检查认证服务是否可用
      const state = await this.authService.getAuthState()
      return state !== undefined
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 公共API方法 - 与原authService兼容
  // ============================================================================

  /**
   * 获取认证状态
   */
  @versionCheck('auth-service', '1.0.0')
  async getAuthState(): Promise<AuthState> {
    return this.wrapAsyncOperation(async () => {
      const state = this.authService.getAuthState()
      
      // 转换为兼容格式
      return {
        user: state.user,
        session: state.session,
        loading: state.loading,
        error: state.error
      }
    }, 'getAuthState')
  }

  /**
   * 检查是否已认证
   */
  @versionCheck('auth-service', '1.0.0')
  async isAuthenticated(): Promise<boolean> {
    return this.wrapAsyncOperation(async () => {
      return this.authService.isAuthenticated()
    }, 'isAuthenticated')
  }

  /**
   * 获取当前用户
   */
  @versionCheck('auth-service', '1.0.0')
  async getCurrentUser(): Promise<UserInfo | null> {
    return this.wrapAsyncOperation(async () => {
      const user = this.authService.getCurrentUser()
      
      if (!user) {
        return null
      }
      
      // 转换为标准用户信息格式
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName || user.email,
        avatar: user.avatar,
        createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
        lastLogin: user.lastLogin ? new Date(user.lastLogin) : undefined
      }
    }, 'getCurrentUser')
  }

  /**
   * 用户登录
   */
  @versionCheck('auth-service', '1.0.0')
  async login(email: string, password: string): Promise<AuthResult> {
    this.validateParams([email, password], ['email', 'password'])
    
    return this.wrapAsyncOperation(async () => {
      this.log('info', '用户登录请求', { email })
      
      try {
        const result = await this.authService.login(email, password)
        
        if (result.success) {
          this.log('info', '用户登录成功', { email })
          
          return {
            success: true,
            user: await this.getCurrentUser(),
            session: result.session
          }
        } else {
          this.log('warn', '用户登录失败', { email, error: result.error })
          
          return {
            success: false,
            error: result.error
          }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
        
        return {
          success: false,
          error: errorMessage
        }
      }
    }, 'login')
  }

  /**
   * 用户注册
   */
  @versionCheck('auth-service', '1.0.0')
  async register(email: string, password: string, username?: string): Promise<AuthResult> {
    this.validateParams([email, password], ['email', 'password'])
    
    return this.wrapAsyncOperation(async () => {
      this.log('info', '用户注册请求', { email, username })
      
      try {
        const result = await this.authService.register(email, password, username)
        
        if (result.success) {
          this.log('info', '用户注册成功', { email, username })
          
          return {
            success: true,
            user: await this.getCurrentUser(),
            session: result.session
          }
        } else {
          this.log('warn', '用户注册失败', { email, username, error: result.error })
          
          return {
            success: false,
            error: result.error
          }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
        
        return {
          success: false,
          error: errorMessage
        }
      }
    }, 'register')
  }

  /**
   * 用户登出
   */
  @versionCheck('auth-service', '1.0.0')
  async logout(): Promise<void> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '用户登出请求')
      
      await this.authService.logout()
      
      this.log('info', '用户登出成功')
    }, 'logout')
  }

  /**
   * 重置密码
   */
  @versionCheck('auth-service', '1.0.0')
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    this.validateParams([email], ['email'])
    
    return this.wrapAsyncOperation(async () => {
      this.log('info', '重置密码请求', { email })
      
      try {
        const result = await this.authService.resetPassword(email)
        
        if (result.success) {
          this.log('info', '重置密码邮件已发送', { email })
          return { success: true }
        } else {
          this.log('warn', '重置密码失败', { email, error: result.error })
          return { success: false, error: result.error }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
        
        return { success: false, error: errorMessage }
      }
    }, 'resetPassword')
  }

  /**
   * 更新用户信息
   */
  @versionCheck('auth-service', '1.0.0')
  async updateProfile(updates: Partial<UserInfo>): Promise<{ success: boolean; user?: UserInfo; error?: string }> {
    this.validateParams([updates], ['updates'])
    
    return this.wrapAsyncOperation(async () => {
      this.log('info', '更新用户信息', updates)
      
      try {
        const result = await this.authService.updateProfile(updates)
        
        if (result.success) {
          this.log('info', '用户信息更新成功')
          
          return {
            success: true,
            user: await this.getCurrentUser()
          }
        } else {
          this.log('warn', '用户信息更新失败', { error: result.error })
          
          return {
            success: false,
            error: result.error
          }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
        
        return {
          success: false,
          error: errorMessage
        }
      }
    }, 'updateProfile')
  }

  /**
   * 更改密码
   */
  @versionCheck('auth-service', '1.0.0')
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    this.validateParams([currentPassword, newPassword], ['currentPassword', 'newPassword'])
    
    return this.wrapAsyncOperation(async () => {
      this.log('info', '更改密码请求')
      
      try {
        const result = await this.authService.changePassword(currentPassword, newPassword)
        
        if (result.success) {
          this.log('info', '密码更改成功')
          return { success: true }
        } else {
          this.log('warn', '密码更改失败', { error: result.error })
          return { success: false, error: result.error }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
        
        return { success: false, error: errorMessage }
      }
    }, 'changePassword')
  }

  /**
   * 刷新令牌
   */
  @versionCheck('auth-service', '1.0.0')
  async refreshToken(): Promise<{ success: boolean; error?: string }> {
    return this.wrapAsyncOperation(async () => {
      this.log('info', '刷新令牌请求')
      
      try {
        const result = await this.authService.refreshToken()
        
        if (result.success) {
          this.log('info', '令牌刷新成功')
          return { success: true }
        } else {
          this.log('warn', '令牌刷新失败', { error: result.error })
          return { success: false, error: result.error }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
        
        return { success: false, error: errorMessage }
      }
    }, 'refreshToken')
  }

  // ============================================================================
  // 事件监听器方法
  // ============================================================================

  /**
   * 添加认证状态变化监听器
   */
  @versionCheck('auth-service', '1.0.0')
  onAuthStateChange(callback: AuthStateChangeListener): () => void {
    this.authStateListeners.add(callback)
    
    // 立即提供当前状态
    this.getAuthState().then(callback).catch(error => {
      this.log('error', '获取当前认证状态失败:', error)
    })
    
    return () => {
      this.authStateListeners.delete(callback)
    }
  }

  // ============================================================================
  // 增强功能
  // ============================================================================

  /**
   * 验证令牌有效性
   */
  @versionCheck('auth-service', '1.0.0')
  async validateToken(): Promise<{ valid: boolean; expiresAt?: Date; error?: string }> {
    return this.wrapAsyncOperation(async () => {
      this.log('debug', '验证令牌有效性')
      
      try {
        const result = await this.authService.validateToken()
        
        if (result.valid) {
          return {
            valid: true,
            expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined
          }
        } else {
          return {
            valid: false,
            error: result.error
          }
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
        
        return {
          valid: false,
          error: errorMessage
        }
      }
    }, 'validateToken')
  }

  /**
   * 获取用户权限
   */
  @versionCheck('auth-service', '1.0.0')
  async getUserPermissions(): Promise<string[]> {
    return this.wrapAsyncOperation(async () => {
      this.log('debug', '获取用户权限')
      
      try {
        return await this.authService.getUserPermissions()
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }, 'getUserPermissions')
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 设置认证监听器
   */
  private setupAuthListeners(): void {
    this.authUnsubscribe = this.authService.onAuthStateChange((state) => {
      // 转换为兼容格式并通知监听器
      const adaptedState: AuthState = {
        user: state.user,
        session: state.session,
        loading: state.loading,
        error: state.error
      }
      
      this.notifyAuthStateChange(adaptedState)
    })
  }

  /**
   * 启动令牌自动刷新
   */
  private startTokenRefresh(): void {
    const refreshInterval = this.options.tokenRefreshBuffer || 300000 // 默认5分钟
    
    this.refreshTimer = setInterval(async () => {
      if (this.isReady() && await this.isAuthenticated()) {
        try {
          await this.refreshToken()
        } catch (error) {
          console.warn("操作失败:", error)
        }
      }
    }, refreshInterval)
    
    this.log('info', `令牌自动刷新已启动,间隔: ${refreshInterval}ms`)
  }

  /**
   * 通知认证状态变化
   */
  private notifyAuthStateChange(state: AuthState): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
          console.warn("操作失败:", error)
        }
    })
  }
}

// ============================================================================
// 导出便利实例
// ============================================================================

export const authServiceAdapter = new AuthServiceAdapter({
  enableAutoRefresh: true,
  tokenRefreshBuffer: 300000,
  enableSessionPersistence: true,
  enableMetrics: true,
  enableWarnings: true,
  logLevel: 'info'
})

// ============================================================================
// 启动适配器
// ============================================================================

// 自动启动适配器
authServiceAdapter.start().catch(error => {
  console.error('认证服务适配器启动失败:', error)
})