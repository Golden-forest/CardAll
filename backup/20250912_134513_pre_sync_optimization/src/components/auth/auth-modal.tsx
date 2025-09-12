import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Github, Cloud, Shield, RefreshCw } from 'lucide-react'
import { authService, type AuthState } from '@/services/auth'
import { cloudSyncService } from '@/services/cloud-sync'
import { UserAvatar } from '@/components/ui/user-avatar'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: false,
    error: null
  })

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(setAuthState)
    return unsubscribe
  }, [])

  const handleGitHubLogin = async () => {
    const { error } = await authService.signInWithGitHub()
    if (error) {
      console.error('Login failed:', error)
    }
  }

  const handleLogout = async () => {
    const { error } = await authService.signOut()
    if (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleSyncNow = async () => {
    await cloudSyncService.performFullSync()
  }

  if (authState.user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              已登录
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <UserAvatar 
                    user={authState.user}
                    size="lg"
                    showHoverEffect={false}
                  />
                  <div>
                    <CardTitle className="text-base">{authState.user.username}</CardTitle>
                    <CardDescription>{authState.user.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cloud className="h-4 w-4" />
                  云端同步已启用
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                onClick={handleSyncNow}
                variant="outline" 
                className="flex-1"
                disabled={authState.loading}
              >
                {authState.loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                立即同步
              </Button>
              
              <Button 
                onClick={handleLogout}
                variant="outline"
                disabled={authState.loading}
              >
                登出
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">登录到 CardAll</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 功能介绍 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <RefreshCw className="h-4 w-4 text-purple-500" />
              <span>离线优先，智能同步</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-green-500" />
              <span>数据安全，自动备份</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <RefreshCw className="h-4 w-4 text-purple-500" />
              <span>离线优先，智能同步</span>
            </div>
          </div>

          {/* 登录按钮 */}
          <Button 
            onClick={handleGitHubLogin}
            disabled={authState.loading}
            className="w-full h-12"
            size="lg"
          >
            {authState.loading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Github className="h-5 w-5 mr-2" />
            )}
            使用 GitHub 登录
          </Button>

          {/* 错误信息 */}
          {authState.error && (
            <div className="text-sm text-red-500 text-center bg-red-50 p-3 rounded-lg">
              {authState.error}
            </div>
          )}

          {/* 说明文字 */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>登录后可以享受云端同步功能</p>
            <p>即使不登录也可以正常使用本地功能</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}