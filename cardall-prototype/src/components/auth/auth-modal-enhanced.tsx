import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, 
  Github, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff,
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { authService, type AuthState } from '@/services/auth'
import { cloudSyncService } from '@/services/cloud-sync'
import { UserAvatar } from '@/components/ui/user-avatar'

interface AuthModalEnhancedProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AuthView = 'main' | 'email-login' | 'email-signup' | 'forgot-password' | 'check-email'

export function AuthModalEnhanced({ open, onOpenChange }: AuthModalEnhancedProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: false,
    error: null
  })
  
  const [currentView, setCurrentView] = useState<AuthView>('main')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(setAuthState)
    return unsubscribe
  }, [])

  // 重置表单
  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    })
    setFormErrors({})
    setIsSubmitting(false)
    setShowPassword(false)
  }

  // 验证表单
  const validateForm = (view: AuthView): boolean => {
    const errors: Record<string, string> = {}

    if (view === 'email-login' || view === 'email-signup' || view === 'forgot-password') {
      if (!formData.email) {
        errors.email = '请输入邮箱地址'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = '请输入有效的邮箱地址'
      }
    }

    if (view === 'email-login' || view === 'email-signup') {
      if (!formData.password) {
        errors.password = '请输入密码'
      } else if (formData.password.length < 6) {
        errors.password = '密码至少需要6个字符'
      }
    }

    if (view === 'email-signup') {
      if (!formData.name) {
        errors.name = '请输入姓名'
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = '两次输入的密码不一致'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // GitHub登录
  const handleGitHubLogin = async () => {
    setIsSubmitting(true)
    const { error } = await authService.signInWithGitHub()
    if (error) {
      console.error('GitHub登录失败:', error)
    }
    setIsSubmitting(false)
  }

  // 邮件登录
  const handleEmailLogin = async () => {
    if (!validateForm('email-login')) return

    setIsSubmitting(true)
    const { error } = await authService.signInWithEmail(formData.email, formData.password)
    
    if (error) {
      setFormErrors({ general: error.message })
    } else {
      onOpenChange(false)
      resetForm()
      setCurrentView('main')
    }
    setIsSubmitting(false)
  }

  // 邮件注册
  const handleEmailSignup = async () => {
    if (!validateForm('email-signup')) return

    setIsSubmitting(true)
    const { error } = await authService.signUpWithEmail(
      formData.email, 
      formData.password,
      { name: formData.name }
    )
    
    if (error) {
      setFormErrors({ general: error.message })
    } else {
      setCurrentView('check-email')
    }
    setIsSubmitting(false)
  }

  // 忘记密码
  const handleForgotPassword = async () => {
    if (!validateForm('forgot-password')) return

    setIsSubmitting(true)
    const { error } = await authService.resetPassword(formData.email)
    
    if (error) {
      setFormErrors({ general: error.message })
    } else {
      setCurrentView('check-email')
    }
    setIsSubmitting(false)
  }

  // 登出
  const handleLogout = async () => {
    const { error } = await authService.signOut()
    if (error) {
      console.error('登出失败:', error)
    }
  }

  // 立即同步
  const handleSyncNow = async () => {
    await cloudSyncService.performFullSync()
  }

  // 如果已登录，显示用户信息
  if (authState.user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl">
          <div className="space-y-6 p-2">
            {/* 用户信息卡片 */}
            <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <UserAvatar 
                      user={authState.user}
                      size="lg"
                      className="h-16 w-16 shadow-lg"
                      showHoverEffect={false}
                    />
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{authState.user.username || '用户'}</h3>
                    <p className="text-sm text-muted-foreground">{authState.user.email}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-600">云端同步已启用</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 操作按钮 */}
            <div className="space-y-3">
              <Button 
                onClick={handleSyncNow}
                variant="outline" 
                className="w-full h-12 rounded-2xl border-2 hover:bg-blue-50 transition-all duration-200"
                disabled={authState.loading}
              >
                {authState.loading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2 text-blue-500" />
                )}
                立即同步数据
              </Button>
              
              <Button 
                onClick={handleLogout}
                variant="ghost"
                className="w-full h-12 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                disabled={authState.loading}
              >
                退出登录
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 主登录界面
  const renderMainView = () => (
    <div className="space-y-6 p-2">
      {/* 标题 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          欢迎使用 CardAll
        </h2>
        <p className="text-muted-foreground">选择您的登录方式</p>
      </div>

      {/* GitHub登录 */}
      <Button 
        onClick={handleGitHubLogin}
        disabled={isSubmitting}
        className="w-full h-14 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
        size="lg"
      >
        {isSubmitting ? (
          <Loader2 className="h-5 w-5 mr-3 animate-spin" />
        ) : (
          <Github className="h-5 w-5 mr-3" />
        )}
        使用 GitHub 登录
      </Button>

      {/* 分割线 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 text-muted-foreground">或</span>
        </div>
      </div>

      {/* 邮件登录选项 */}
      <div className="space-y-3">
        <Button 
          onClick={() => setCurrentView('email-login')}
          variant="outline"
          className="w-full h-14 rounded-2xl border-2 hover:bg-blue-50 transition-all duration-200 transform hover:scale-[1.02]"
          size="lg"
        >
          <Mail className="h-5 w-5 mr-3 text-blue-500" />
          使用邮箱登录
        </Button>

        <Button 
          onClick={() => setCurrentView('email-signup')}
          variant="ghost"
          className="w-full h-12 rounded-2xl hover:bg-green-50 hover:text-green-600 transition-all duration-200"
        >
          <User className="h-4 w-4 mr-2" />
          创建新账户
        </Button>
      </div>

      {/* 说明文字 */}
      <div className="text-xs text-muted-foreground text-center space-y-1 pt-4">
        <p>登录后可享受云端同步功能</p>
        <p>即使不登录也可正常使用本地功能</p>
      </div>
    </div>
  )

  // 邮件登录界面
  const renderEmailLogin = () => (
    <div className="space-y-6 p-2">
      {/* 返回按钮和标题 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('main')}
          className="rounded-full p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">邮箱登录</h2>
      </div>

      {/* 表单 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱地址</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="输入您的邮箱地址"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="pl-10 h-12 rounded-2xl border-2"
            />
          </div>
          {formErrors.email && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="输入您的密码"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="pl-10 pr-10 h-12 rounded-2xl border-2"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-10 w-10 rounded-xl"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {formErrors.password && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formErrors.password}
            </p>
          )}
        </div>

        {/* 忘记密码链接 */}
        <div className="text-right">
          <Button
            variant="link"
            size="sm"
            onClick={() => setCurrentView('forgot-password')}
            className="text-blue-600 hover:text-blue-700 p-0 h-auto"
          >
            忘记密码？
          </Button>
        </div>

        {/* 错误信息 */}
        {formErrors.general && (
          <div className="text-sm text-red-500 text-center bg-red-50 p-3 rounded-2xl flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {formErrors.general}
          </div>
        )}

        {/* 登录按钮 */}
        <Button 
          onClick={handleEmailLogin}
          disabled={isSubmitting}
          className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all duration-200"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          登录
        </Button>
      </div>
    </div>
  )

  // 邮件注册界面
  const renderEmailSignup = () => (
    <div className="space-y-6 p-2">
      {/* 返回按钮和标题 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('main')}
          className="rounded-full p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">创建账户</h2>
      </div>

      {/* 表单 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">姓名</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="输入您的姓名"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="pl-10 h-12 rounded-2xl border-2"
            />
          </div>
          {formErrors.name && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email">邮箱地址</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="signup-email"
              type="email"
              placeholder="输入您的邮箱地址"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="pl-10 h-12 rounded-2xl border-2"
            />
          </div>
          {formErrors.email && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">密码</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="设置您的密码（至少6个字符）"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="pl-10 pr-10 h-12 rounded-2xl border-2"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-10 w-10 rounded-xl"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {formErrors.password && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formErrors.password}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">确认密码</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              placeholder="再次输入密码"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="pl-10 h-12 rounded-2xl border-2"
            />
          </div>
          {formErrors.confirmPassword && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* 错误信息 */}
        {formErrors.general && (
          <div className="text-sm text-red-500 text-center bg-red-50 p-3 rounded-2xl flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {formErrors.general}
          </div>
        )}

        {/* 注册按钮 */}
        <Button 
          onClick={handleEmailSignup}
          disabled={isSubmitting}
          className="w-full h-12 rounded-2xl bg-green-600 hover:bg-green-700 transition-all duration-200"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          创建账户
        </Button>

        {/* 说明文字 */}
        <div className="text-xs text-muted-foreground text-center">
          <p>注册即表示您同意我们的服务条款和隐私政策</p>
        </div>
      </div>
    </div>
  )

  // 忘记密码界面
  const renderForgotPassword = () => (
    <div className="space-y-6 p-2">
      {/* 返回按钮和标题 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('email-login')}
          className="rounded-full p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">重置密码</h2>
      </div>

      {/* 说明 */}
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">输入您的邮箱地址，我们将发送重置密码的链接</p>
      </div>

      {/* 表单 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">邮箱地址</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="输入您的邮箱地址"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="pl-10 h-12 rounded-2xl border-2"
            />
          </div>
          {formErrors.email && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formErrors.email}
            </p>
          )}
        </div>

        {/* 错误信息 */}
        {formErrors.general && (
          <div className="text-sm text-red-500 text-center bg-red-50 p-3 rounded-2xl flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {formErrors.general}
          </div>
        )}

        {/* 发送按钮 */}
        <Button 
          onClick={handleForgotPassword}
          disabled={isSubmitting}
          className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all duration-200"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          发送重置链接
        </Button>
      </div>
    </div>
  )

  // 检查邮件界面
  const renderCheckEmail = () => (
    <div className="space-y-6 p-2 text-center">
      {/* 图标 */}
      <div className="flex justify-center">
        <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
      </div>

      {/* 标题和说明 */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">检查您的邮箱</h2>
        <p className="text-muted-foreground">
          我们已向 <span className="font-medium">{formData.email}</span> 发送了一封邮件
        </p>
        <p className="text-sm text-muted-foreground">
          请点击邮件中的链接来完成{currentView === 'check-email' ? '账户激活' : '密码重置'}
        </p>
      </div>

      {/* 返回按钮 */}
      <Button 
        onClick={() => {
          setCurrentView('main')
          resetForm()
        }}
        variant="outline"
        className="w-full h-12 rounded-2xl border-2"
      >
        返回登录
      </Button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) {
        setCurrentView('main')
        resetForm()
      }
    }}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl rounded-3xl">
        {currentView === 'main' && renderMainView()}
        {currentView === 'email-login' && renderEmailLogin()}
        {currentView === 'email-signup' && renderEmailSignup()}
        {currentView === 'forgot-password' && renderForgotPassword()}
        {currentView === 'check-email' && renderCheckEmail()}
      </DialogContent>
    </Dialog>
  )
}
