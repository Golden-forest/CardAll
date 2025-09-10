import { useState, useCallback, useEffect } from 'react'

interface SyncLockOptions {
  timeout?: number
  retryDelay?: number
  maxRetries?: number
}

interface SyncLockResult {
  acquireLock: (resourceId: string, options?: SyncLockOptions) => Promise<boolean>
  releaseLock: (resourceId: string) => void
  isLocked: (resourceId: string) => boolean
  getLockInfo: (resourceId: string) => { owner: string; timestamp: number } | null
  waitForLock: (resourceId: string, options?: SyncLockOptions) => Promise<boolean>
  globalLock: boolean
  lockedResources: string[]
}

// 全局锁状态
const globalLockState = {
  locks: new Map<string, { owner: string; timestamp: number; timeout?: number }>(),
  globalLock: false,
  listeners: new Map<string, ((released: boolean) => void)[]>()
}

// 清理过期锁
const cleanupExpiredLocks = () => {
  const now = Date.now()
  for (const [resourceId, lock] of globalLockState.locks.entries()) {
    if (lock.timeout && now > lock.timestamp + lock.timeout) {
      globalLockState.locks.delete(resourceId)
      // 通知等待者
      const listeners = globalLockState.listeners.get(resourceId)
      if (listeners) {
        listeners.forEach(callback => callback(true))
        globalLockState.listeners.delete(resourceId)
      }
    }
  }
}

// 定期清理过期锁
if (typeof window !== 'undefined') {
  setInterval(cleanupExpiredLocks, 5000)
}

export function useSyncLock(ownerId: string = 'default'): SyncLockResult {
  const [globalLock, setGlobalLock] = useState(globalLockState.globalLock)
  const [lockedResources, setLockedResources] = useState<string[]>([])

  // 监听锁状态变化
  useEffect(() => {
    const checkLockState = () => {
      setGlobalLock(globalLockState.globalLock)
      setLockedResources(Array.from(globalLockState.locks.keys()))
    }

    const interval = setInterval(checkLockState, 100)
    return () => clearInterval(interval)
  }, [])

  // 获取资源锁
  const acquireLock = useCallback(async (
    resourceId: string, 
    options: SyncLockOptions = {}
  ): Promise<boolean> => {
    const { timeout = 30000, retryDelay = 100, maxRetries = 3 } = options
    
    // 清理过期锁
    cleanupExpiredLocks()
    
    // 检查是否已被锁定
    if (globalLockState.locks.has(resourceId)) {
      const existingLock = globalLockState.locks.get(resourceId)!
      
      // 如果是同一个所有者，允许重入
      if (existingLock.owner === ownerId) {
        existingLock.timestamp = Date.now()
        return true
      }
      
      // 等待锁释放
      return waitForLock(resourceId, { timeout, retryDelay, maxRetries })
    }

    // 尝试获取锁
    let retries = 0
    while (retries < maxRetries) {
      if (!globalLockState.locks.has(resourceId)) {
        globalLockState.locks.set(resourceId, {
          owner: ownerId,
          timestamp: Date.now(),
          timeout
        })
        return true
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      retries++
    }
    
    return false
  }, [ownerId])

  // 释放资源锁
  const releaseLock = useCallback((resourceId: string) => {
    const lock = globalLockState.locks.get(resourceId)
    if (lock && lock.owner === ownerId) {
      globalLockState.locks.delete(resourceId)
      
      // 通知等待者
      const listeners = globalLockState.listeners.get(resourceId)
      if (listeners) {
        listeners.forEach(callback => callback(true))
        globalLockState.listeners.delete(resourceId)
      }
    }
  }, [ownerId])

  // 检查资源是否被锁定
  const isLocked = useCallback((resourceId: string): boolean => {
    cleanupExpiredLocks()
    return globalLockState.locks.has(resourceId)
  }, [])

  // 获取锁信息
  const getLockInfo = useCallback((resourceId: string) => {
    cleanupExpiredLocks()
    const lock = globalLockState.locks.get(resourceId)
    return lock ? { owner: lock.owner, timestamp: lock.timestamp } : null
  }, [])

  // 等待锁释放
  const waitForLock = useCallback(async (
    resourceId: string, 
    options: SyncLockOptions = {}
  ): Promise<boolean> => {
    const { timeout = 30000 } = options
    
    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const checkLock = () => {
        if (!globalLockState.locks.has(resourceId)) {
          resolve(true)
          return
        }
        
        if (Date.now() - startTime > timeout) {
          resolve(false)
          return
        }
        
        setTimeout(checkLock, 100)
      }
      
      checkLock()
    })
  }, [])

  // 获取全局锁
  const acquireGlobalLock = useCallback(async (options: SyncLockOptions = {}): Promise<boolean> => {
    if (globalLockState.globalLock) {
      return false
    }
    
    globalLockState.globalLock = true
    setGlobalLock(true)
    return true
  }, [])

  // 释放全局锁
  const releaseGlobalLock = useCallback(() => {
    globalLockState.globalLock = false
    setGlobalLock(false)
  }, [])

  return {
    acquireLock,
    releaseLock,
    isLocked,
    getLockInfo,
    waitForLock,
    globalLock,
    lockedResources,
    // 额外的全局锁方法
    acquireGlobalLock,
    releaseGlobalLock
  }
}

// 便利函数：使用锁执行操作
export async function withLock<T>(
  resourceId: string,
  operation: () => Promise<T>,
  options?: SyncLockOptions & { ownerId?: string }
): Promise<T> {
  const { ownerId = 'default', ...lockOptions } = options || {}
  const { acquireLock, releaseLock } = useSyncLock(ownerId)
  
  const acquired = await acquireLock(resourceId, lockOptions)
  if (!acquired) {
    throw new Error(`Failed to acquire lock for resource: ${resourceId}`)
  }
  
  try {
    return await operation()
  } finally {
    releaseLock(resourceId)
  }
}

// 便利函数：使用全局锁执行操作
export async function withGlobalLock<T>(
  operation: () => Promise<T>,
  options?: SyncLockOptions & { ownerId?: string }
): Promise<T> {
  const { ownerId = 'default' } = options || {}
  const { acquireGlobalLock, releaseGlobalLock } = useSyncLock(ownerId)
  
  const acquired = await acquireGlobalLock(options)
  if (!acquired) {
    throw new Error('Failed to acquire global lock')
  }
  
  try {
    return await operation()
  } finally {
    releaseGlobalLock()
  }
}