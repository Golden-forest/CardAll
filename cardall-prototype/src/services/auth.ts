import { supabase, type User } from './supabase'
import { AuthError, Session, AuthChangeEvent } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

class AuthService {
  private listeners: ((state: AuthState) => void)[] = []
  private currentState: AuthState = {
    user: null,
    session: null,
    loading: true,
    error: null
  }

  constructor() {
    this.initialize()
    // 延迟设置认证服务到同步服务，避免循环依赖
    setTimeout(() => {
      this.setupSyncService()
    }, 0)
  }

  // 设置统一同步服务（解决循环依赖）
  private setupSyncService() {
    try {
      // 动态导入避免循环依赖
      import('./unified-sync-service').then(({ unifiedSyncService }) => {
        unifiedSyncService.setAuthService(this)
      }).catch(error => {
        console.warn('Failed to setup unified sync service:', error)
      })
    } catch (error) {
      console.warn('Failed to setup unified sync service:', error)
    }
  }

  // 初始化认证服务
  private async initialize() {
    try {
      // 获取当前会话
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        this.updateState({ error: error.message, loading: false })
        return
      }

      if (session?.user) {
        const user = await this.fetchUserProfile(session.user.id)
        this.updateState({ 
          user, 
          session, 
          loading: false, 
          error: null 
        })
      } else {
        this.updateState({ loading: false })
      }

      // 监听认证状态变化
      supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event, session?.user?.id)
        
        if (event === 'SIGNED_OUT') {
          // 用户登出，清理同步状态但保留本地数据
          try {
            // 动态获取同步服务
            const { unifiedSyncService } = await import('./unified-sync-service')
            await unifiedSyncService.clearHistory()
          } catch (error) {
            console.warn('Failed to clear sync history on signout:', error)
          }
          
          this.updateState({ 
            user: null, 
            session: null, 
            loading: false, 
            error: null 
          })
        } else if (session?.user) {
          const user = await this.fetchUserProfile(session.user.id)
          this.updateState({ 
            user, 
            session, 
            loading: false, 
            error: null 
          })
          
          // 触发完整同步
          if (event === 'SIGNED_IN') {
            try {
              const { unifiedSyncService } = await import('./unified-sync-service')
              await unifiedSyncService.performFullSync()
            } catch (error) {
              console.warn('Failed to perform full sync after signin:', error)
            }
          }
        } else {
          this.updateState({ 
            user: null, 
            session: null, 
            loading: false, 
            error: null 
          })
        }
      })
    } catch (error) {
      console.error('Auth initialization failed:', error)
      this.updateState({ 
        error: error instanceof Error ? error.message : 'Authentication failed',
        loading: false 
      })
    }
  }

  // 获取用户资料
  private async fetchUserProfile(userId: string): Promise<User | null> {
    try {
      // 等待一小段时间，让数据库触发器有时间创建用户资料
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Failed to fetch user profile:', error)
        // 如果用户资料不存在，返回null，让触发器处理
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  // 更新状态并通知监听器
  private updateState(updates: Partial<AuthState>) {
    this.currentState = { ...this.currentState, ...updates }
    this.listeners.forEach(listener => listener(this.currentState))
  }

  // 添加状态监听器
  onAuthStateChange(callback: (state: AuthState) => void): () => void {
    this.listeners.push(callback)
    // 立即调用一次以获取当前状态
    callback(this.currentState)
    
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // 获取当前状态
  getCurrentState(): AuthState {
    return this.currentState
  }

  // 邮件注册
  async signUpWithEmail(email: string, password: string, userData?: { name?: string }): Promise<{ error: AuthError | null }> {
    try {
      this.updateState({ loading: true, error: null })
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData?.name || email.split('@')[0],
            full_name: userData?.name || email.split('@')[0]
          }
        }
      })

      if (error) {
        this.updateState({ error: error.message, loading: false })
        return { error }
      }

      // 用户资料将由数据库触发器自动创建
      // 注册成功，显示验证邮件提示
      this.updateState({ loading: false, error: null })
      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      this.updateState({ error: errorMessage, loading: false })
      return { error: error as AuthError }
    }
  }

  // 邮件登录
  async signInWithEmail(email: string, password: string): Promise<{ error: AuthError | null }> {
    try {
      this.updateState({ loading: true, error: null })
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        this.updateState({ error: error.message, loading: false })
        return { error }
      }

      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      this.updateState({ error: errorMessage, loading: false })
      return { error: error as AuthError }
    }
  }

  // 重置密码
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      this.updateState({ loading: true, error: null })
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (error) {
        this.updateState({ error: error.message, loading: false })
        return { error }
      }

      this.updateState({ loading: false, error: null })
      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed'
      this.updateState({ error: errorMessage, loading: false })
      return { error: error as AuthError }
    }
  }

  // GitHub OAuth登录
  async signInWithGitHub(): Promise<{ error: AuthError | null }> {
    try {
      this.updateState({ loading: true, error: null })
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}`
        }
      })

      if (error) {
        this.updateState({ error: error.message, loading: false })
        return { error }
      }

      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      this.updateState({ error: errorMessage, loading: false })
      return { error: error as AuthError }
    }
  }

  // 登出
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      this.updateState({ loading: true, error: null })
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        this.updateState({ error: error.message, loading: false })
        return { error }
      }

      this.updateState({ 
        user: null, 
        session: null, 
        loading: false, 
        error: null 
      })
      
      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed'
      this.updateState({ error: errorMessage, loading: false })
      return { error: error as AuthError }
    }
  }

  // 创建或更新用户资料
  async upsertUserProfile(userData: {
    github_id?: string
    email: string
    username: string
    avatar_url?: string
  }): Promise<User | null> {
    try {
      if (!this.currentState.session?.user.id) {
        console.error('No authenticated user found')
        return null
      }

      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: this.currentState.session.user.id,
          ...userData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to upsert user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error upserting user profile:', error)
      return null
    }
  }

  // 检查用户是否已认证
  isAuthenticated(): boolean {
    return !!this.currentState.user && !!this.currentState.session
  }

  // 获取当前用户
  getCurrentUser(): User | null {
    return this.currentState.user
  }

  // 获取当前会话
  getCurrentSession(): Session | null {
    return this.currentState.session
  }
}

// 导出单例实例
export const authService = new AuthService()