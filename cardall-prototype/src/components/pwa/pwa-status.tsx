import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Wifi, 
  WifiOff, 
  Download, 
  RefreshCw, 
  Smartphone, 
  Monitor,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'

interface PWAStatusProps {
  className?: string
}

export const PWAStatus: React.FC<PWAStatusProps> = ({ className }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isInstalled, setIsInstalled] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [cacheStats, setCacheStats] = useState({
    totalCaches: 0,
    totalSize: 0,
    lastUpdated: null as Date | null
  })

  useEffect(() => {
    // Check if app is installed
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
      }
    }

    // Register service worker
    const registerSW = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js')
          setSwRegistration(registration)
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true)
                }
              })
            }
          })
          
          console.log('Service Worker registered successfully')
        } catch (error) {
          console.error('Service Worker registration failed:', error)
        }
      }
    }

    // Get cache statistics
    const getCacheStats = async () => {
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys()
          let totalSize = 0
          
          for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName)
            const requests = await cache.keys()
            
            for (const request of requests) {
              const response = await cache.match(request)
              if (response) {
                const blob = await response.blob()
                totalSize += blob.size
              }
            }
          }
          
          setCacheStats({
            totalCaches: cacheNames.length,
            totalSize,
            lastUpdated: new Date()
          })
        } catch (error) {
          console.error('Failed to get cache stats:', error)
        }
      }
    }

    // Event listeners
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    checkInstalled()
    registerSW()
    getCacheStats()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Update cache stats every 30 seconds
    const interval = setInterval(getCacheStats, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const handleUpdate = async () => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  const handleRefreshCache = async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      window.location.reload()
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500'
    if (updateAvailable) return 'bg-orange-500'
    if (isInstalled) return 'bg-green-500'
    return 'bg-blue-500'
  }

  const getStatusText = () => {
    if (!isOnline) return '离线'
    if (updateAvailable) return '有更新'
    if (isInstalled) return '已安装'
    return '在线'
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`relative ${className}`}>
          {isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getStatusColor()}`} />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">PWA 状态</CardTitle>
              <Badge variant={isOnline ? 'default' : 'destructive'}>
                {getStatusText()}
              </Badge>
            </div>
            <CardDescription>
              Progressive Web App 功能状态
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">网络连接</span>
              </div>
              <Badge variant={isOnline ? 'default' : 'destructive'}>
                {isOnline ? '在线' : '离线'}
              </Badge>
            </div>

            {/* Installation Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isInstalled ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Download className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-sm">应用安装</span>
              </div>
              <Badge variant={isInstalled ? 'default' : 'secondary'}>
                {isInstalled ? '已安装' : '未安装'}
              </Badge>
            </div>

            {/* Service Worker Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {swRegistration ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
                <span className="text-sm">Service Worker</span>
              </div>
              <Badge variant={swRegistration ? 'default' : 'secondary'}>
                {swRegistration ? '活跃' : '未注册'}
              </Badge>
            </div>

            {/* Cache Statistics */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">缓存统计</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>缓存数量: {cacheStats.totalCaches}</div>
                <div>总大小: {formatBytes(cacheStats.totalSize)}</div>
              </div>
              {cacheStats.lastUpdated && (
                <div className="text-xs text-gray-500">
                  更新时间: {cacheStats.lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Platform Detection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/Mobi|Android/i.test(navigator.userAgent) ? (
                  <Smartphone className="h-4 w-4 text-purple-600" />
                ) : (
                  <Monitor className="h-4 w-4 text-purple-600" />
                )}
                <span className="text-sm">设备类型</span>
              </div>
              <Badge variant="outline">
                {/Mobi|Android/i.test(navigator.userAgent) ? '移动设备' : '桌面设备'}
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {updateAvailable && (
                <Button 
                  size="sm" 
                  onClick={handleUpdate}
                  className="flex-1"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  更新应用
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRefreshCache}
                className="flex-1"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                清除缓存
              </Button>
            </div>

            {/* Features List */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium">PWA 功能</h4>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>离线访问</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>后台同步</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>推送通知</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>快速加载</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  )
}

export default PWAStatus