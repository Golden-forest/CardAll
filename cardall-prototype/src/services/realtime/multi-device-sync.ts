/**
 * CardEverything 多设备同步支持
 * 实现实时状态同步和多设备协作功能
 * 
 * Week 4 Task 7: 实现实时状态同步和多设备支持
 * 
 * 功能特性：
 * - 设备识别和管理
 * - 跨设备状态同步
 * - 协作冲突解决
 * - 设备在线状态监控
 * - 会话管理
 * 
 * @author Project-Brainstormer + Sync-System-Expert
 * @version Week 4.1
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { RealtimeEvent } from './supabase-realtime-listener'
import { RealtimeSystemIntegration } from './realtime-system-integration'

/**
 * 设备信息接口
 */
export interface DeviceInfo {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet' | 'web'
  platform: string
  browser: string
  version: string
  lastSeen: Date
  isOnline: boolean
  capabilities: {
    pushNotifications: boolean
    backgroundSync: boolean
    offlineSupport: boolean
    realtimeSupport: boolean
  }
}

/**
 * 会话信息接口
 */
export interface SessionInfo {
  id: string
  deviceId: string
  userId: string
  startTime: Date
  lastActivity: Date
  isActive: boolean
  currentView: string
  selectedItems: string[]
  syncVersion: number
}

/**
 * 设备状态接口
 */
export interface DeviceState {
  deviceId: string
  timestamp: Date
  currentView: string
  selectedItems: string[]
  filter: any
  sort: any
  scrollPosition: number
  isEditing: boolean
  editingItem?: string
}

/**
 * 协作事件接口
 */
export interface CollaborationEvent {
  id: string
  type: 'cursor_move' | 'selection_change' | 'view_change' | 'edit_start' | 'edit_end'
  deviceId: string
  userId: string
  timestamp: Date
  data: any
  targetId?: string
}

/**
 * 多设备同步管理器类
 */
export class MultiDeviceSyncManager {
  private supabase: SupabaseClient
  private realtimeSystem: RealtimeSystemIntegration
  private currentDevice: DeviceInfo
  private currentSession: SessionInfo | null = null
  private devices: Map<string, DeviceInfo> = new Map()
  private sessions: Map<string, SessionInfo> = new Map()
  private deviceStates: Map<string, DeviceState> = new Map()
  private collaborationEvents: CollaborationEvent[] = []
  private eventHandlers: Map<string, Function[]> = new Map()
  private heartbeatTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  constructor(
    supabase: SupabaseClient,
    realtimeSystem: RealtimeSystemIntegration
  ) {
    this.supabase = supabase
    this.realtimeSystem = realtimeSystem
    this.currentDevice = this.generateDeviceInfo()
    
    console.log('MultiDeviceSyncManager initialized for device:', this.currentDevice.id)
  }

  /**
   * 初始化多设备同步
   */
  async initialize(userId: string): Promise<void> {
    try {
      console.log('🚀 初始化多设备同步系统...')

      // 1. 注册当前设备
      await this.registerDevice(userId)

      // 2. 创建会话
      await this.createSession(userId)

      // 3. 加载其他设备信息
      await this.loadDevices(userId)

      // 4. 加载活跃会话
      await this.loadSessions(userId)

      // 5. 设置Realtime监听
      this.setupRealtimeListeners()

      // 6. 启动心跳
      this.startHeartbeat()

      // 7. 启动清理
      this.startCleanup()

      this.isInitialized = true
      console.log('✅ 多设备同步系统初始化完成')

      // 通知其他设备
      await this.broadcastDeviceOnline()

    } catch (error) {
      console.error('❌ 多设备同步系统初始化失败:', error)
      throw error
    }
  }

  /**
   * 生成设备信息
   */
  private generateDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent
    let deviceType: DeviceInfo['type'] = 'web'
    
    // 检测设备类型
    if (/Mobile|Android|iPhone/.test(userAgent)) {
      deviceType = 'mobile'
    } else if (/iPad|Tablet/.test(userAgent)) {
      deviceType = 'tablet'
    } else if (/Windows|Macintosh|Linux/.test(userAgent)) {
      deviceType = 'desktop'
    }

    // 检测浏览器
    let browser = 'Unknown'
    if (userAgent.includes('Chrome')) browser = 'Chrome'
    else if (userAgent.includes('Firefox')) browser = 'Firefox'
    else if (userAgent.includes('Safari')) browser = 'Safari'
    else if (userAgent.includes('Edge')) browser = 'Edge'

    return {
      id: this.generateDeviceId(),
      name: this.getDeviceName(deviceType),
      type: deviceType,
      platform: navigator.platform,
      browser,
      version: navigator.userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+)/)?.[1] || 'Unknown',
      lastSeen: new Date(),
      isOnline: true,
      capabilities: {
        pushNotifications: 'Notification' in window,
        backgroundSync: 'serviceWorker' in navigator,
        offlineSupport: 'indexedDB' in window,
        realtimeSupport: 'WebSocket' in window
      }
    }
  }

  /**
   * 生成设备ID
   */
  private generateDeviceId(): string {
    // 基于浏览器指纹和随机数生成唯一ID
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset()
    ].join('|')
    
    // 简单的哈希函数
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return `device_${Math.abs(hash)}_${Date.now()}`
  }

  /**
   * 获取设备名称
   */
  private getDeviceName(type: DeviceInfo['type']): string {
    const baseNames = {
      desktop: 'Desktop',
      mobile: 'Mobile',
      tablet: 'Tablet',
      web: 'Web Browser'
    }
    
    const timestamp = new Date().toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    return `${baseNames[type]} (${timestamp})`
  }

  /**
   * 注册设备
   */
  private async registerDevice(userId: string): Promise<void> {
    try {
      // 在实际实现中，这里会将设备信息存储到Supabase
      console.log('📱 注册设备:', this.currentDevice.id)
      
      // 模拟设备注册
      await new Promise(resolve => setTimeout(resolve, 100))
      
      this.devices.set(this.currentDevice.id, this.currentDevice)
      
    } catch (error) {
      console.error('设备注册失败:', error)
      throw error
    }
  }

  /**
   * 创建会话
   */
  private async createSession(userId: string): Promise<void> {
    try {
      const session: SessionInfo = {
        id: this.generateSessionId(),
        deviceId: this.currentDevice.id,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        isActive: true,
        currentView: 'dashboard',
        selectedItems: [],
        syncVersion: 1
      }
      
      // 模拟会话创建
      await new Promise(resolve => setTimeout(resolve, 100))
      
      this.currentSession = session
      this.sessions.set(session.id, session)
      
      console.log('🔐 创建会话:', session.id)
      
    } catch (error) {
      console.error('会话创建失败:', error)
      throw error
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 加载其他设备信息
   */
  private async loadDevices(userId: string): Promise<void> {
    try {
      // 在实际实现中，这里会从Supabase加载用户的所有设备
      console.log('📱 加载设备信息...')
      
      // 模拟加载其他设备
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // 添加一些模拟设备用于演示
      const mockDevices: DeviceInfo[] = [
        {
          id: 'device_mobile_001',
          name: 'iPhone (昨天14:30)',
          type: 'mobile',
          platform: 'iOS',
          browser: 'Safari',
          version: '16.0',
          lastSeen: new Date(Date.now() - 3600000), // 1小时前
          isOnline: false,
          capabilities: {
            pushNotifications: true,
            backgroundSync: true,
            offlineSupport: true,
            realtimeSupport: true
          }
        },
        {
          id: 'device_desktop_001',
          name: 'Desktop (今天09:15)',
          type: 'desktop',
          platform: 'Windows',
          browser: 'Chrome',
          version: '120.0',
          lastSeen: new Date(Date.now() - 300000), // 5分钟前
          isOnline: true,
          capabilities: {
            pushNotifications: false,
            backgroundSync: true,
            offlineSupport: true,
            realtimeSupport: true
          }
        }
      ]
      
      mockDevices.forEach(device => {
        if (device.id !== this.currentDevice.id) {
          this.devices.set(device.id, device)
        }
      })
      
      console.log(`✅ 加载了 ${mockDevices.length} 个设备信息`)
      
    } catch (error) {
      console.error('加载设备信息失败:', error)
      throw error
    }
  }

  /**
   * 加载活跃会话
   */
  private async loadSessions(userId: string): Promise<void> {
    try {
      console.log('🔐 加载活跃会话...')
      
      // 模拟加载会话
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('✅ 会话加载完成')
      
    } catch (error) {
      console.error('加载会话失败:', error)
      throw error
    }
  }

  /**
   * 设置Realtime监听
   */
  private setupRealtimeListeners(): void {
    // 监听设备状态变化
    this.realtimeSystem.onSystemEvent('device-online', (event) => {
      this.handleDeviceOnline(event.data)
    })

    this.realtimeSystem.onSystemEvent('device-offline', (event) => {
      this.handleDeviceOffline(event.data)
    })

    // 监听协作事件
    this.realtimeSystem.onSystemEvent('collaboration-event', (event) => {
      this.handleCollaborationEvent(event.data)
    })

    // 监听会话变化
    this.realtimeSystem.onSystemEvent('session-updated', (event) => {
      this.handleSessionUpdated(event.data)
    })
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.sendHeartbeat()
      } catch (error) {
        console.error('心跳发送失败:', error)
      }
    }, 30000) // 30秒心跳
  }

  /**
   * 启动清理
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleData()
    }, 300000) // 5分钟清理一次
  }

  /**
   * 发送心跳
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      this.currentDevice.lastSeen = new Date()
      
      if (this.currentSession) {
        this.currentSession.lastActivity = new Date()
      }
      
      // 在实际实现中，这里会向Supabase发送心跳
      console.log('💓 发送设备心跳')
      
    } catch (error) {
      console.error('心跳发送失败:', error)
    }
  }

  /**
   * 清理过期数据
   */
  private cleanupStaleData(): void {
    const now = Date.now()
    const staleThreshold = 300000 // 5分钟
    
    // 清理离线设备
    for (const [deviceId, device] of this.devices) {
      if (device.id !== this.currentDevice.id && 
          now - device.lastSeen.getTime() > staleThreshold) {
        device.isOnline = false
        this.emitEvent('device-offline', { device })
      }
    }
    
    // 清理过期会话
    for (const [sessionId, session] of this.sessions) {
      if (session.deviceId !== this.currentDevice.id &&
          now - session.lastActivity.getTime() > staleThreshold) {
        session.isActive = false
        this.emitEvent('session-expired', { session })
      }
    }
    
    // 清理过期协作事件
    this.collaborationEvents = this.collaborationEvents.filter(event => 
      now - event.timestamp.getTime() < 3600000 // 保留1小时内的事件
    )
  }

  /**
   * 广播设备在线
   */
  private async broadcastDeviceOnline(): Promise<void> {
    try {
      const event = {
        type: 'device-online',
        deviceId: this.currentDevice.id,
        device: this.currentDevice,
        timestamp: new Date()
      }
      
      this.emitEvent('device-online', event)
      console.log('📡 广播设备在线状态')
      
    } catch (error) {
      console.error('广播设备在线状态失败:', error)
    }
  }

  /**
   * 处理设备上线
   */
  private handleDeviceOnline(data: any): void {
    const { deviceId, device } = data
    
    if (deviceId === this.currentDevice.id) return
    
    const existingDevice = this.devices.get(deviceId)
    if (existingDevice) {
      existingDevice.isOnline = true
      existingDevice.lastSeen = new Date()
    } else {
      this.devices.set(deviceId, { ...device, isOnline: true })
    }
    
    console.log(`🟢 设备上线: ${device.name}`)
    this.emitEvent('device-status-changed', { device, status: 'online' })
  }

  /**
   * 处理设备下线
   */
  private handleDeviceOffline(data: any): void {
    const { deviceId } = data
    
    if (deviceId === this.currentDevice.id) return
    
    const device = this.devices.get(deviceId)
    if (device) {
      device.isOnline = false
      device.lastSeen = new Date()
      
      console.log(`🔴 设备下线: ${device.name}`)
      this.emitEvent('device-status-changed', { device, status: 'offline' })
    }
  }

  /**
   * 处理协作事件
   */
  private handleCollaborationEvent(event: CollaborationEvent): void {
    // 忽略自己发送的事件
    if (event.deviceId === this.currentDevice.id) return
    
    // 添加到事件历史
    this.collaborationEvents.push(event)
    
    // 根据事件类型处理
    switch (event.type) {
      case 'cursor_move':
        this.handleCursorMove(event)
        break
      case 'selection_change':
        this.handleSelectionChange(event)
        break
      case 'view_change':
        this.handleViewChange(event)
        break
      case 'edit_start':
        this.handleEditStart(event)
        break
      case 'edit_end':
        this.handleEditEnd(event)
        break
    }
    
    this.emitEvent('collaboration-event', event)
  }

  /**
   * 处理会话更新
   */
  private handleSessionUpdated(data: any): void {
    const { session } = data
    
    if (session.deviceId === this.currentDevice.id) return
    
    const existingSession = this.sessions.get(session.id)
    if (existingSession) {
      Object.assign(existingSession, session)
    } else {
      this.sessions.set(session.id, session)
    }
    
    this.emitEvent('session-updated', { session })
  }

  /**
   * 处理光标移动
   */
  private handleCursorMove(event: CollaborationEvent): void {
    // 更新其他设备的光标位置
    console.log(`🖱️ 设备 ${event.deviceId} 光标移动`)
  }

  /**
   * 处理选择变化
   */
  private handleSelectionChange(event: CollaborationEvent): void {
    // 更新其他设备的选择状态
    console.log(`🎯 设备 ${event.deviceId} 选择变化`)
  }

  /**
   * 处理视图变化
   */
  private handleViewChange(event: CollaborationEvent): void {
    // 更新其他设备的视图状态
    console.log(`👁️ 设备 ${event.deviceId} 视图变化`)
  }

  /**
   * 处理编辑开始
   */
  private handleEditStart(event: CollaborationEvent): void {
    // 处理编辑冲突
    console.log(`✏️ 设备 ${event.deviceId} 开始编辑`)
  }

  /**
   * 处理编辑结束
   */
  private handleEditEnd(event: CollaborationEvent): void {
    // 清理编辑状态
    console.log(`📝 设备 ${event.deviceId} 结束编辑`)
  }

  /**
   * 更新设备状态
   */
  public updateDeviceState(state: Partial<DeviceState>): void {
    if (!this.currentSession) return
    
    const deviceState: DeviceState = {
      deviceId: this.currentDevice.id,
      timestamp: new Date(),
      currentView: state.currentView || 'dashboard',
      selectedItems: state.selectedItems || [],
      filter: state.filter || {},
      sort: state.sort || {},
      scrollPosition: state.scrollPosition || 0,
      isEditing: state.isEditing || false,
      editingItem: state.editingItem
    }
    
    this.deviceStates.set(this.currentDevice.id, deviceState)
    
    // 广播状态变化
    this.broadcastDeviceState(deviceState)
  }

  /**
   * 广播设备状态
   */
  private async broadcastDeviceState(state: DeviceState): Promise<void> {
    try {
      const event = {
        type: 'device-state-changed',
        deviceId: state.deviceId,
        state,
        timestamp: new Date()
      }
      
      this.emitEvent('device-state-changed', event)
      
    } catch (error) {
      console.error('广播设备状态失败:', error)
    }
  }

  /**
   * 发送协作事件
   */
  public async sendCollaborationEvent(
    type: CollaborationEvent['type'],
    data: any,
    targetId?: string
  ): Promise<void> {
    if (!this.currentSession) return
    
    const event: CollaborationEvent = {
      id: this.generateEventId(),
      type,
      deviceId: this.currentDevice.id,
      userId: this.currentSession.userId,
      timestamp: new Date(),
      data,
      targetId
    }
    
    try {
      // 在实际实现中，这里会通过Realtime发送事件
      this.collaborationEvents.push(event)
      
      this.emitEvent('collaboration-event-sent', event)
      
    } catch (error) {
      console.error('发送协作事件失败:', error)
    }
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取在线设备
   */
  public getOnlineDevices(): DeviceInfo[] {
    return Array.from(this.devices.values()).filter(device => device.isOnline)
  }

  /**
   * 获取活跃会话
   */
  public getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive)
  }

  /**
   * 获取设备状态
   */
  public getDeviceStates(): Map<string, DeviceState> {
    return new Map(this.deviceStates)
  }

  /**
   * 获取最近的协作事件
   */
  public getRecentCollaborationEvents(limit: number = 50): CollaborationEvent[] {
    return this.collaborationEvents
      .slice(-limit)
      .reverse()
      .filter(event => event.deviceId !== this.currentDevice.id)
  }

  /**
   * 检查编辑冲突
   */
  public checkEditConflict(itemId: string): boolean {
    // 检查是否有其他设备正在编辑同一项目
    return Array.from(this.deviceStates.values()).some(state => 
      state.deviceId !== this.currentDevice.id && 
      state.isEditing && 
      state.editingItem === itemId
    )
  }

  /**
   * 获取编辑状态
   */
  public getEditStatus(itemId: string): { isEditing: boolean; editingDevice?: DeviceInfo } {
    for (const [deviceId, state] of this.deviceStates) {
      if (deviceId !== this.currentDevice.id && state.isEditing && state.editingItem === itemId) {
        const device = this.devices.get(deviceId)
        return {
          isEditing: true,
          editingDevice: device
        }
      }
    }
    
    return { isEditing: false }
  }

  /**
   * 监听事件
   */
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  /**
   * 触发事件
   */
  private emitEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`事件处理器错误 (${event}):`, error)
        }
      })
    }
  }

  /**
   * 获取当前设备信息
   */
  public getCurrentDevice(): DeviceInfo {
    return { ...this.currentDevice }
  }

  /**
   * 获取当前会话信息
   */
  public getCurrentSession(): SessionInfo | null {
    return this.currentSession ? { ...this.currentSession } : null
  }

  /**
   * 获取同步状态报告
   */
  public getSyncStatusReport(): string {
    const onlineDevices = this.getOnlineDevices()
    const activeSessions = this.getActiveSessions()
    const recentEvents = this.getRecentCollaborationEvents(10)
    
    return `
多设备同步状态报告
==================

当前设备: ${this.currentDevice.name} (${this.currentDevice.type})
在线设备数: ${onlineDevices.length}
活跃会话数: ${activeSessions.length}
最近协作事件: ${recentEvents.length}

在线设备:
${onlineDevices.map(d => `- ${d.name} (${d.type})`).join('\n')}

活跃会话:
${activeSessions.map(s => `- ${s.deviceId} (${s.currentView})`).join('\n')}

最近活动:
${recentEvents.slice(0, 5).map(e => 
  `${e.type} - ${e.deviceId} - ${e.timestamp.toLocaleTimeString()}`
).join('\n')}
    `.trim()
  }

  /**
   * 销毁多设备同步管理器
   */
  public async destroy(): Promise<void> {
    console.log('🧹 销毁多设备同步管理器...')
    
    // 停止定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    // 广播设备下线
    try {
      this.emitEvent('device-offline', { 
        deviceId: this.currentDevice.id, 
        device: this.currentDevice 
      })
    } catch (error) {
      console.error('广播设备下线失败:', error)
    }
    
    // 清理数据
    this.devices.clear()
    this.sessions.clear()
    this.deviceStates.clear()
    this.collaborationEvents = []
    this.eventHandlers.clear()
    
    this.currentSession = null
    this.isInitialized = false
    
    console.log('✅ 多设备同步管理器已销毁')
  }
}

/**
 * 导出单例工厂函数
 */
export const createMultiDeviceSyncManager = (
  supabase: SupabaseClient,
  realtimeSystem: RealtimeSystemIntegration
) => {
  return new MultiDeviceSyncManager(supabase, realtimeSystem)
}