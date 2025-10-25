/**
 * 备份调度服务
 * 提供自动备份调度、定时任务和智能调度功能
 */

import { BackupConfig, StorageLocation } from './backup-core.service'

// ============================================================================
// 调度系统类型定义
// ============================================================================

export interface BackupSchedule {
  id: string
  name: string
  configId: string
  enabled: boolean
  schedule: {
    type: 'interval' | 'cron' | 'once'
    interval?: number // 毫秒
    cron?: string
    time?: string // HH:mm格式
    days?: number[] // 0-6 表示周日到周六
    date?: string // YYYY-MM-DD格式，仅用于once类型
  }
  conditions: {
    minChanges?: number
    maxSize?: number
    networkType?: 'wifi' | 'cellular' | 'any'
    batteryLevel?: number
    deviceIdle?: boolean
  }
  notifications: {
    enabled: boolean
    onStart: boolean
    onSuccess: boolean
    onError: boolean
    channels: ('browser' | 'email' | 'push')[]
  }
  retry: {
    enabled: boolean
    maxAttempts: number
    interval: number
    backoffMultiplier: number
  }
  stats: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    lastRun: Date | null
    nextRun: Date | null
    averageDuration: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface IntelligentBackupConfig {
  adaptiveInterval: boolean
  smartCompression: boolean
  predictiveBackup: boolean
  resourceAware: boolean
  changeDetection: boolean
}

export interface SystemResources {
  memory: {
    used: number
    total: number
    percent: number
  }
  storage: {
    used: number
    total: number
    percent: number
  }
  cpu: {
    usage: number
  }
  battery: {
    level: number
    charging: boolean
  }
  network: {
    type: 'wifi' | 'cellular' | 'none'
    online: boolean
    downlink: number
    rtt: number
  }
}

export interface ChangeTrackingData {
  entityType: string
  entityId: string
  changeCount: number
  lastChangeTime: number
  changeTypes: Set<'create' | 'update' | 'delete'>
  averageChangeInterval: number
}

export interface ChangeStatistics {
  totalChanges: number
  uniqueEntities: number
  startTime: number
  averageInterval: number
  changeTypes: Set<string>
}

export interface IntelligentBackupStats {
  adaptiveInterval: boolean
  resourceAware: boolean
  changeDetection: boolean
  totalTrackedChanges: number
  uniqueTrackedEntities: number
  memoryUsagePercent: number
  storageUsagePercent: number
  activeSchedules: number
  lastOptimization: number
}

// ============================================================================
// 备份调度服务类
// ============================================================================

export class BackupSchedulerService {
  private schedules: Map<string, BackupSchedule> = new Map()
  private autoBackupTimers: Map<string, NodeJS.Timeout> = new Map()
  private changeTracking: Map<string, ChangeTrackingData> = new Map()
  private intelligentConfig: IntelligentBackupConfig = {
    adaptiveInterval: true,
    smartCompression: true,
    predictiveBackup: true,
    resourceAware: true,
    changeDetection: true
  }

  constructor() {
    this.loadSchedules()
    this.startAllEnabledSchedules()
    this.initializeIntelligentScheduler()
  }

  /**
   * 加载调度配置
   */
  private async loadSchedules(): Promise<void> {
    try {
      const savedSchedules = localStorage.getItem('cardall-backup-schedules')
      if (savedSchedules) {
        const schedules = JSON.parse(savedSchedules)
        Object.entries(schedules).forEach(([id, schedule]) => {
          const parsedSchedule = schedule as BackupSchedule
          // 转换日期字符串为Date对象
          parsedSchedule.stats.lastRun = schedule.stats.lastRun ? new Date(schedule.stats.lastRun) : null
          parsedSchedule.stats.nextRun = schedule.stats.nextRun ? new Date(schedule.stats.nextRun) : null
          parsedSchedule.createdAt = new Date(schedule.createdAt)
          parsedSchedule.updatedAt = new Date(schedule.updatedAt)
          this.schedules.set(id, parsedSchedule)
        })
      }
    } catch (error) {
      console.error('Failed to load backup schedules:', error)
    }
  }

  /**
   * 启动所有启用的调度
   */
  private startAllEnabledSchedules(): void {
    this.schedules.forEach((schedule, id) => {
      if (schedule.enabled) {
        this.startAutoBackup(schedule)
      }
    })
  }

  /**
   * 初始化智能调度器
   */
  private initializeIntelligentScheduler(): void {
    this.startChangeTracking()
    this.startIntelligentScheduler()
    this.monitorSystemResources()
  }

  /**
   * 开始变更跟踪
   */
  private startChangeTracking(): void {
    // 监听数据库变更
    if (typeof window !== 'undefined') {
      // 这里应该监听实际的数据库变更事件
      // 现在使用模拟的变更跟踪
      this.simulateChangeTracking()
    }
  }

  /**
   * 模拟变更跟踪（实际项目中应该监听真实的数据库事件）
   */
  private simulateChangeTracking(): void {
    // 模拟一些变更事件
    setInterval(() => {
      if (Math.random() < 0.1) { // 10%概率模拟变更
        this.trackEntityChange('card', `card_${Date.now()}`, 'update')
      }
    }, 60000) // 每分钟检查一次
  }

  /**
   * 跟踪实体变更
   */
  private trackEntityChange(
    entityType: string,
    entityId: string,
    changeType: 'create' | 'update' | 'delete'
  ): void {
    const key = `${entityType}:${entityId}`
    const now = Date.now()

    let tracking = this.changeTracking.get(key)
    if (!tracking) {
      tracking = {
        entityType,
        entityId,
        changeCount: 0,
        lastChangeTime: now,
        changeTypes: new Set(),
        averageChangeInterval: 0
      }
      this.changeTracking.set(key, tracking)
    }

    tracking.changeCount++
    tracking.changeTypes.add(changeType)

    // 计算平均变更间隔
    const timeSinceLastChange = now - tracking.lastChangeTime
    tracking.averageChangeInterval = (tracking.averageChangeInterval * (tracking.changeCount - 1) + timeSinceLastChange) / tracking.changeCount

    tracking.lastChangeTime = now

    // 评估是否需要触发备份
    this.evaluateBackupTrigger(tracking)
  }

  /**
   * 评估备份触发条件
   */
  private evaluateBackupTrigger(tracking: ChangeTrackingData): void {
    const stats = this.getChangeStatistics()

    // 如果变更次数超过阈值，触发备份
    if (stats.totalChanges > 50) {
      this.triggerEmergencyBackup('High change volume detected')
    }

    // 如果有大量实体变更，触发备份
    if (stats.uniqueEntities > 20) {
      this.triggerEmergencyBackup('Multiple entities modified')
    }
  }

  /**
   * 获取变更统计信息
   */
  private getChangeStatistics(): ChangeStatistics {
    const now = Date.now()
    let totalChanges = 0
    let uniqueEntities = 0
    let totalInterval = 0
    const changeTypes = new Set<string>()

    this.changeTracking.forEach(tracking => {
      totalChanges += tracking.changeCount
      uniqueEntities++
      totalInterval += tracking.averageChangeInterval
      tracking.changeTypes.forEach(type => changeTypes.add(type))
    })

    const startTime = now - (totalInterval / this.changeTracking.size) * 1000

    return {
      totalChanges,
      uniqueEntities,
      startTime,
      averageInterval: this.changeTracking.size > 0 ? totalInterval / this.changeTracking.size : 0,
      changeTypes
    }
  }

  /**
   * 触发紧急备份
   */
  private async triggerEmergencyBackup(reason: string): Promise<void> {
    console.log(`Emergency backup triggered: ${reason}`)

    // 查找适合的调度配置
    for (const [id, schedule] of this.schedules) {
      if (schedule.enabled && this.checkScheduleConditions(schedule)) {
        await this.executeScheduledBackup(schedule, reason)
        break
      }
    }
  }

  /**
   * 启动智能调度器
   */
  private startIntelligentScheduler(): void {
    // 每分钟检查一次智能调度条件
    setInterval(async () => {
      if (this.intelligentConfig.adaptiveInterval) {
        await this.optimizeBackupOperations()
      }
    }, 60000)
  }

  /**
   * 监控系统资源
   */
  private monitorSystemResources(): void {
    // 每30秒检查一次系统资源
    setInterval(() => {
      const resources = this.getSystemResourcesSync()

      // 如果资源使用率过高，暂停非关键调度
      if (resources.memory.percent > 90 || resources.cpu.usage > 90) {
        this.pauseNonCriticalSchedules()
      } else {
        this.resumePausedSchedules()
      }
    }, 30000)
  }

  /**
   * 获取系统资源信息（同步版本）
   */
  private getSystemResourcesSync(): SystemResources {
    // 简化的系统资源检测
    const memory = (performance as any).memory || { usedJSHeapSize: 0, totalJSHeapSize: 0 }

    return {
      memory: {
        used: memory.usedJSHeapSize || 0,
        total: memory.totalJSHeapSize || 100 * 1024 * 1024,
        percent: Math.round(((memory.usedJSHeapSize || 0) / (memory.totalJSHeapSize || 100 * 1024 * 1024)) * 100)
      },
      storage: {
        used: 0,
        total: 0,
        percent: 0 // 需要实现存储检测
      },
      cpu: {
        usage: 0 // 需要实现CPU使用率检测
      },
      battery: {
        level: 100,
        charging: true
      },
      network: {
        type: navigator.onLine ? 'wifi' : 'none',
        online: navigator.onLine,
        downlink: 0,
        rtt: 0
      }
    }
  }

  /**
   * 暂停非关键调度
   */
  private pauseNonCriticalSchedules(): void {
    this.schedules.forEach((schedule, id) => {
      if (schedule.schedule.type === 'interval' && schedule.schedule.interval && schedule.schedule.interval < 300000) {
        this.stopAutoBackup(id)
        console.log(`Paused schedule ${id} due to high resource usage`)
      }
    })
  }

  /**
   * 恢复暂停的调度
   */
  private resumePausedSchedules(): void {
    this.schedules.forEach((schedule, id) => {
      if (schedule.enabled && !this.autoBackupTimers.has(id)) {
        this.startAutoBackup(schedule)
        console.log(`Resumed schedule ${id}`)
      }
    })
  }

  /**
   * 优化备份操作
   */
  private async optimizeBackupOperations(): Promise<void> {
    const stats = this.getChangeStatistics()

    // 根据变更频率调整调度间隔
    if (stats.totalChanges > 100) {
      // 高变更频率，增加备份频率
      this.adjustScheduleIntervals(0.5) // 减半间隔
    } else if (stats.totalChanges < 10) {
      // 低变更频率，减少备份频率
      this.adjustScheduleIntervals(2.0) // 双倍间隔
    }

    // 清理过期的变更跟踪数据
    this.cleanupChangeTracking()
  }

  /**
   * 调整调度间隔
   */
  private adjustScheduleIntervals(multiplier: number): void {
    this.schedules.forEach(schedule => {
      if (schedule.schedule.type === 'interval' && schedule.schedule.interval) {
        const newInterval = Math.max(60000, Math.floor(schedule.schedule.interval * multiplier)) // 最小1分钟
        schedule.schedule.interval = newInterval
        schedule.updatedAt = new Date()

        // 重新启动调度
        if (schedule.enabled) {
          this.stopAutoBackup(schedule.id)
          this.startAutoBackup(schedule)
        }
      }
    })

    this.saveSchedules()
  }

  /**
   * 清理变更跟踪数据
   */
  private cleanupChangeTracking(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000 // 24小时前

    for (const [key, tracking] of this.changeTracking) {
      if (tracking.lastChangeTime < cutoffTime) {
        this.changeTracking.delete(key)
      }
    }
  }

  /**
   * 开始自动备份
   */
  private startAutoBackup(schedule: BackupSchedule): void {
    this.stopAutoBackup(schedule.id) // 先停止现有的定时器

    if (schedule.schedule.type === 'interval' && schedule.schedule.interval) {
      const timer = setInterval(async () => {
        if (this.checkScheduleConditions(schedule)) {
          await this.executeScheduledBackup(schedule)
        }
      }, schedule.schedule.interval)

      this.autoBackupTimers.set(schedule.id, timer)
    } else if (schedule.schedule.type === 'cron') {
      // Cron调度实现较复杂，这里简化处理
      this.scheduleCronBackup(schedule)
    } else if (schedule.schedule.type === 'once') {
      this.scheduleOneTimeBackup(schedule)
    }
  }

  /**
   * 停止自动备份
   */
  private stopAutoBackup(scheduleId: string): void {
    const timer = this.autoBackupTimers.get(scheduleId)
    if (timer) {
      clearInterval(timer)
      this.autoBackupTimers.delete(scheduleId)
    }
  }

  /**
   * 检查调度条件
   */
  private checkScheduleConditions(schedule: BackupSchedule): boolean {
    const resources = this.getSystemResourcesSync()

    // 检查电池电量
    if (schedule.conditions.batteryLevel && resources.battery.level < schedule.conditions.batteryLevel) {
      return false
    }

    // 检查网络类型
    if (schedule.conditions.networkType && schedule.conditions.networkType !== 'any') {
      if (!resources.network.online) return false
      if (schedule.conditions.networkType === 'wifi' && resources.network.type !== 'wifi') {
        return false
      }
    }

    // 检查变更数量
    if (schedule.conditions.minChanges) {
      const stats = this.getChangeStatistics()
      if (stats.totalChanges < schedule.conditions.minChanges) {
        return false
      }
    }

    // 检查设备空闲状态
    if (schedule.conditions.deviceIdle) {
      // 简化的空闲检测
      const idleTime = (document as any).lastActivityTime ? Date.now() - (document as any).lastActivityTime : 0
      if (idleTime < 300000) { // 5分钟内无活动
        return false
      }
    }

    return true
  }

  /**
   * 执行调度的备份
   */
  private async executeScheduledBackup(schedule: BackupSchedule, reason?: string): Promise<void> {
    const startTime = Date.now()

    try {
      // 更新统计信息
      schedule.stats.totalRuns++
      schedule.stats.lastRun = new Date()
      schedule.updatedAt = new Date()

      // 发送开始通知
      if (schedule.notifications.enabled && schedule.notifications.onStart) {
        this.sendNotification('backup-start', `开始执行备份: ${schedule.name}`)
      }

      // 这里应该调用实际的备份服务
      console.log(`Executing scheduled backup: ${schedule.name}`, reason)

      // 模拟备份执行
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 更新成功统计
      schedule.stats.successfulRuns++
      const duration = Date.now() - startTime
      schedule.stats.averageDuration = (schedule.stats.averageDuration * (schedule.stats.successfulRuns - 1) + duration) / schedule.stats.successfulRuns

      // 发送成功通知
      if (schedule.notifications.enabled && schedule.notifications.onSuccess) {
        this.sendNotification('backup-success', `备份完成: ${schedule.name}`)
      }

      // 清理变更跟踪
      this.clearChangeTrackingAfterBackup()

      console.log(`Scheduled backup completed: ${schedule.name} in ${duration}ms`)

    } catch (error) {
      console.error(`Scheduled backup failed: ${schedule.name}`, error)

      // 更新失败统计
      schedule.stats.failedRuns++

      // 重试逻辑
      if (schedule.retry.enabled && schedule.stats.failedRuns <= schedule.retry.maxAttempts) {
        const retryDelay = schedule.retry.interval * Math.pow(schedule.retry.backoffMultiplier, schedule.stats.failedRuns - 1)
        setTimeout(() => {
          this.executeScheduledBackup(schedule, 'retry')
        }, retryDelay)
      }

      // 发送错误通知
      if (schedule.notifications.enabled && schedule.notifications.onError) {
        this.sendNotification('backup-error', `备份失败: ${schedule.name} - ${error}`)
      }
    }

    this.saveSchedules()
  }

  /**
   * 发送通知
   */
  private sendNotification(type: 'backup-start' | 'backup-success' | 'backup-error', message: string): void {
    // 简化的通知实现
    if ('Notification' in window) {
      new Notification('CardEverything 备份', {
        body: message,
        icon: '/favicon.ico'
      })
    }

    // 发送自定义事件
    window.dispatchEvent(new CustomEvent('backup-notification', {
      detail: { type, message, timestamp: new Date() }
    }))
  }

  /**
   * 清理备份后的变更跟踪
   */
  private clearChangeTrackingAfterBackup(): void {
    // 清理较旧的变更跟踪数据
    const cutoffTime = Date.now() - 3600000 // 1小时前
    for (const [key, tracking] of this.changeTracking) {
      if (tracking.lastChangeTime < cutoffTime) {
        this.changeTracking.delete(key)
      }
    }
  }

  /**
   * 调度Cron备份
   */
  private scheduleCronBackup(schedule: BackupSchedule): void {
    // 简化的Cron调度实现
    // 实际项目中应该使用完整的Cron解析器
    if (schedule.schedule.time) {
      const [hours, minutes] = schedule.schedule.time.split(':').map(Number)

      const checkTime = () => {
        const now = new Date()
        if (now.getHours() === hours && now.getMinutes() === minutes) {
          if (this.checkScheduleConditions(schedule)) {
            this.executeScheduledBackup(schedule)
          }
        }
      }

      // 每分钟检查一次
      const timer = setInterval(checkTime, 60000)
      this.autoBackupTimers.set(schedule.id, timer)
    }
  }

  /**
   * 调度一次性备份
   */
  private scheduleOneTimeBackup(schedule: BackupSchedule): void {
    if (schedule.schedule.date) {
      const targetDate = new Date(schedule.schedule.date)
      const now = new Date()

      if (targetDate > now) {
        const delay = targetDate.getTime() - now.getTime()
        const timer = setTimeout(() => {
          if (this.checkScheduleConditions(schedule)) {
            this.executeScheduledBackup(schedule)
          }
        }, delay)

        this.autoBackupTimers.set(schedule.id, timer as unknown as NodeJS.Timeout)
      }
    }
  }

  /**
   * 保存调度配置
   */
  private async saveSchedules(): Promise<void> {
    try {
      const schedules = Object.fromEntries(this.schedules)
      localStorage.setItem('cardall-backup-schedules', JSON.stringify(schedules))
    } catch (error) {
      console.error('Failed to save backup schedules:', error)
    }
  }

  // ============================================================================
  // 公共接口方法
  // ============================================================================

  /**
   * 创建调度
   */
  async createSchedule(schedule: Omit<BackupSchedule, 'id' | 'stats' | 'createdAt' | 'updatedAt'>): Promise<BackupSchedule> {
    const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const newSchedule: BackupSchedule = {
      ...schedule,
      id,
      stats: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        lastRun: null,
        nextRun: null,
        averageDuration: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.schedules.set(id, newSchedule)
    await this.saveSchedules()

    if (newSchedule.enabled) {
      this.startAutoBackup(newSchedule)
    }

    return newSchedule
  }

  /**
   * 更新调度
   */
  async updateSchedule(scheduleId: string, updates: Partial<BackupSchedule>): Promise<BackupSchedule | null> {
    const schedule = this.schedules.get(scheduleId)
    if (!schedule) return null

    const updatedSchedule = {
      ...schedule,
      ...updates,
      updatedAt: new Date()
    }

    this.schedules.set(scheduleId, updatedSchedule)
    await this.saveSchedules()

    // 重新启动调度
    if (updatedSchedule.enabled) {
      this.startAutoBackup(updatedSchedule)
    } else {
      this.stopAutoBackup(scheduleId)
    }

    return updatedSchedule
  }

  /**
   * 删除调度
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId)
    if (!schedule) return false

    this.stopAutoBackup(scheduleId)
    this.schedules.delete(scheduleId)
    await this.saveSchedules()

    return true
  }

  /**
   * 获取调度
   */
  getSchedule(scheduleId: string): BackupSchedule | undefined {
    return this.schedules.get(scheduleId)
  }

  /**
   * 获取所有调度
   */
  getSchedules(): BackupSchedule[] {
    return Array.from(this.schedules.values())
  }

  /**
   * 取消所有调度的备份
   */
  cancelAllScheduledBackups(): void {
    this.autoBackupTimers.forEach((timer, scheduleId) => {
      clearInterval(timer)
    })
    this.autoBackupTimers.clear()
  }

  /**
   * 取消指定调度的备份
   */
  cancelScheduledBackup(scheduleId: string): void {
    const timer = this.autoBackupTimers.get(scheduleId)
    if (timer) {
      clearInterval(timer)
      this.autoBackupTimers.delete(scheduleId)
    }
  }

  /**
   * 更新智能备份配置
   */
  updateIntelligentBackupConfig(config: Partial<IntelligentBackupConfig>): void {
    this.intelligentConfig = { ...this.intelligentConfig, ...config }
  }

  /**
   * 获取智能备份统计信息
   */
  getIntelligentBackupStats(): IntelligentBackupStats {
    const stats = this.getChangeStatistics()
    const resources = this.getSystemResourcesSync()

    return {
      adaptiveInterval: this.intelligentConfig.adaptiveInterval,
      resourceAware: this.intelligentConfig.resourceAware,
      changeDetection: this.intelligentConfig.changeDetection,
      totalTrackedChanges: stats.totalChanges,
      uniqueTrackedEntities: stats.uniqueEntities,
      memoryUsagePercent: resources.memory.percent,
      storageUsagePercent: resources.storage.percent,
      activeSchedules: this.autoBackupTimers.size,
      lastOptimization: Date.now()
    }
  }
}

// 导出单例实例
export const backupSchedulerService = new BackupSchedulerService()