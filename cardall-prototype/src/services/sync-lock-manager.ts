// 同步锁管理器 - 管理本地操作和云端同步的锁状态
export class SyncLockManager {
  private static instance: SyncLockManager
  private localLock = false
  private cloudLock = false
  private localLockQueue: Array<() => void> = []
  private cloudLockQueue: Array<() => void> = []
  private lockTimeouts = new Map<string, NodeJS.Timeout>()

  static getInstance(): SyncLockManager {
    if (!SyncLockManager.instance) {
      SyncLockManager.instance = new SyncLockManager()
    }
    return SyncLockManager.instance
  }

  // 获取本地锁状态
  getLocalLock(): boolean {
    return this.localLock
  }

  // 获取云端锁状态
  getCloudLock(): boolean {
    return this.cloudLock
  }

  // 获取锁状态信息
  getLockStatus(): {
    localLock: boolean
    cloudLock: boolean
    localQueueLength: number
    cloudQueueLength: number
  } {
    return {
      localLock: this.localLock,
      cloudLock: this.cloudLock,
      localQueueLength: this.localLockQueue.length,
      cloudQueueLength: this.cloudLockQueue.length
    }
  }

  // 获取本地锁 - 本地操作优先级最高
  async acquireLocalLock(timeout: number = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.localLock) {
        this.localLock = true
        console.log('🔒 Local lock acquired')
        
        // 设置超时自动释放
        const timeoutId = setTimeout(() => {
          this.releaseLocalLock()
          console.warn('⚠️ Local lock timeout released')
        }, timeout)
        
        this.lockTimeouts.set('local', timeoutId)
        resolve(true)
      } else {
        console.log('🔄 Local lock queued')
        this.localLockQueue.push(() => {
          this.localLock = true
          console.log('🔒 Local lock acquired from queue')
          
          // 设置超时自动释放
          const timeoutId = setTimeout(() => {
            this.releaseLocalLock()
            console.warn('⚠️ Local lock timeout released from queue')
          }, timeout)
          
          this.lockTimeouts.set('local', timeoutId)
          resolve(true)
        })
      }
    })
  }

  // 获取云端锁 - 云端同步优先级较低
  async acquireCloudLock(timeout: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      // 如果本地锁被占用，云端同步需要等待
      if (this.localLock) {
        console.log('⏳ Cloud sync waiting for local lock')
        this.cloudLockQueue.push(() => {
          if (!this.cloudLock) {
            this.cloudLock = true
            console.log('☁️ Cloud lock acquired')
            
            // 设置超时自动释放
            const timeoutId = setTimeout(() => {
              this.releaseCloudLock()
              console.warn('⚠️ Cloud lock timeout released')
            }, timeout)
            
            this.lockTimeouts.set('cloud', timeoutId)
            resolve(true)
          } else {
            // 重新排队
            this.cloudLockQueue.push(() => {
              this.cloudLock = true
              console.log('☁️ Cloud lock acquired from queue')
              
              const timeoutId = setTimeout(() => {
                this.releaseCloudLock()
                console.warn('⚠️ Cloud lock timeout released from queue')
              }, timeout)
              
              this.lockTimeouts.set('cloud', timeoutId)
              resolve(true)
            })
          }
        })
      } else if (!this.cloudLock) {
        this.cloudLock = true
        console.log('☁️ Cloud lock acquired')
        
        // 设置超时自动释放
        const timeoutId = setTimeout(() => {
          this.releaseCloudLock()
          console.warn('⚠️ Cloud lock timeout released')
        }, timeout)
        
        this.lockTimeouts.set('cloud', timeoutId)
        resolve(true)
      } else {
        console.log('🔄 Cloud lock queued')
        this.cloudLockQueue.push(() => {
          this.cloudLock = true
          console.log('☁️ Cloud lock acquired from queue')
          
          const timeoutId = setTimeout(() => {
            this.releaseCloudLock()
            console.warn('⚠️ Cloud lock timeout released from queue')
          }, timeout)
          
          this.lockTimeouts.set('cloud', timeoutId)
          resolve(true)
        })
      }
    })
  }

  // 释放本地锁
  releaseLocalLock(): void {
    if (this.localLock) {
      this.localLock = false
      console.log('🔓 Local lock released')
      
      // 清除超时定时器
      const timeoutId = this.lockTimeouts.get('local')
      if (timeoutId) {
        clearTimeout(timeoutId)
        this.lockTimeouts.delete('local')
      }
      
      // 处理队列中的下一个请求
      this.processLocalQueue()
    }
  }

  // 释放云端锁
  releaseCloudLock(): void {
    if (this.cloudLock) {
      this.cloudLock = false
      console.log('🔓 Cloud lock released')
      
      // 清除超时定时器
      const timeoutId = this.lockTimeouts.get('cloud')
      if (timeoutId) {
        clearTimeout(timeoutId)
        this.lockTimeouts.delete('cloud')
      }
      
      // 处理队列中的下一个请求
      this.processCloudQueue()
    }
  }

  // 处理本地锁队列
  private processLocalQueue(): void {
    if (this.localLockQueue.length > 0 && !this.localLock) {
      const nextOperation = this.localLockQueue.shift()
      if (nextOperation) {
        nextOperation()
      }
    }
  }

  // 处理云端锁队列
  private processCloudQueue(): void {
    if (this.cloudLockQueue.length > 0 && !this.cloudLock && !this.localLock) {
      const nextOperation = this.cloudLockQueue.shift()
      if (nextOperation) {
        nextOperation()
      }
    }
  }

  // 强制释放所有锁（紧急情况）
  forceReleaseAllLocks(): void {
    console.warn('⚠️ Force releasing all locks')
    
    this.localLock = false
    this.cloudLock = false
    
    // 清除所有超时定时器
    this.lockTimeouts.forEach((timeoutId, key) => {
      clearTimeout(timeoutId)
    })
    this.lockTimeouts.clear()
    
    // 清空队列
    this.localLockQueue = []
    this.cloudLockQueue = []
    
    console.log('🔓 All locks force released')
  }

  // 获取队列状态
  getQueueStatus(): {
    localQueueLength: number
    cloudQueueLength: number
    localLock: boolean
    cloudLock: boolean
  } {
    return {
      localQueueLength: this.localLockQueue.length,
      cloudQueueLength: this.cloudLockQueue.length,
      localLock: this.localLock,
      cloudLock: this.cloudLock
    }
  }
}

// 导出单例实例
export const syncLockManager = SyncLockManager.getInstance()