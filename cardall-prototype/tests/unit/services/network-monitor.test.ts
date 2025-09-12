import { NetworkMonitorService, type NetworkInfo, type NetworkQuality, type NetworkEvent } from '@/services/network-monitor'

describe('NetworkMonitorService', () => {
  let service: NetworkMonitorService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new NetworkMonitorService()
    
    // 模拟网络相关 API
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    if (service) {
      service.stopMonitoring()
    }
  })

  describe('初始化', () => {
    it('应该正确初始化服务', async () => {
      await service.initialize()
      expect(service).toBeDefined()
      
      const initialState = service.getCurrentState()
      expect(initialState.isOnline).toBe(true)
      expect(initialState.connectionType).toBe('4g')
    })

    it('应该处理没有网络连接信息 API 的情况', async () => {
      // 移除 connection API
      delete (navigator as any).connection
      
      await service.initialize()
      
      const initialState = service.getCurrentState()
      expect(initialState.isOnline).toBe(true)
      expect(initialState.connectionType).toBe('unknown')
    })
  })

  describe('网络状态监测', () => {
    it('应该检测在线状态变化', async () => {
      const mockListener = jest.fn()
      service.onNetworkChange(mockListener)
      
      await service.initialize()
      
      // 模拟离线事件
      Object.defineProperty(navigator, 'onLine', { value: false })
      window.dispatchEvent(new Event('offline'))
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_change',
          isOnline: false,
        })
      )
      
      const currentState = service.getCurrentState()
      expect(currentState.isOnline).toBe(false)
    })

    it('应该检测连接类型变化', async () => {
      const mockListener = jest.fn()
      service.onNetworkChange(mockListener)
      
      await service.initialize()
      
      // 模拟连接类型变化
      const mockConnection = navigator.connection
      const changeEvent = new Event('change')
      
      Object.defineProperty(navigator.connection, 'effectiveType', { 
        value: '2g', 
        writable: true 
      })
      
      mockConnection.addEventListener.mock.calls[0][1](changeEvent)
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_change',
          connectionType: '2g',
        })
      )
    })

    it('应该定期检测网络质量', async () => {
      jest.useFakeTimers()
      
      await service.initialize()
      service.startMonitoring()
      
      // 模拟质量检测
      const mockListener = jest.fn()
      service.onNetworkChange(mockListener)
      
      // 等待第一次质量检测
      jest.advanceTimersByTime(31000) // 31秒，超过默认的30秒间隔
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'quality_change',
        })
      )
      
      jest.useRealTimers()
    })
  })

  describe('网络质量评估', () => {
    it('应该正确评估高速网络质量', async () => {
      Object.defineProperty(navigator.connection, 'effectiveType', { 
        value: '4g', 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'downlink', { 
        value: 20, 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'rtt', { 
        value: 50, 
        writable: true 
      })
      
      await service.initialize()
      
      const quality = service.getNetworkQuality()
      expect(quality.level).toBe('excellent')
      expect(quality.score).toBeGreaterThan(80)
    })

    it('应该正确评估低速网络质量', async () => {
      Object.defineProperty(navigator.connection, 'effectiveType', { 
        value: '2g', 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'downlink', { 
        value: 0.5, 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'rtt', { 
        value: 800, 
        writable: true 
      })
      
      await service.initialize()
      
      const quality = service.getNetworkQuality()
      expect(quality.level).toBe('poor')
      expect(quality.score).toBeLessThan(40)
    })

    it('应该处理网络连接不稳定', async () => {
      // 模拟网络连接历史中的不稳定性
      await service.initialize()
      
      // 添加一些延迟变化记录
      const now = Date.now()
      ;(service as any).connectionHistory.push(
        { timestamp: now - 5000, latency: 100, bandwidth: 10 },
        { timestamp: now - 4000, latency: 500, bandwidth: 2 },
        { timestamp: now - 3000, latency: 1000, bandwidth: 0.5 },
        { timestamp: now - 2000, latency: 200, bandwidth: 8 },
        { timestamp: now - 1000, latency: 800, bandwidth: 1 }
      )
      
      const quality = service.getNetworkQuality()
      expect(quality.stability).toBeLessThan(0.7) // 不稳定的网络
    })
  })

  describe('连接测试', () => {
    it('应该成功测试连接到端点', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ status: 'ok' })
      } as any)
      
      const result = await (service as any).testConnection('https://api.example.com/health')
      
      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThan(0)
      expect(result.bandwidth).toBeGreaterThan(0)
    })

    it('应该处理连接测试失败', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
      
      const result = await (service as any).testConnection('https://api.example.com/health')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('应该测量下载带宽', async () => {
      const mockData = new Array(1024 * 1024).join('x') // 1MB 数据
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-length', mockData.length.toString()]]),
        text: () => Promise.resolve(mockData)
      } as any)
      
      const result = await (service as any).measureBandwidth('https://api.example.com/test')
      
      expect(result.bandwidth).toBeGreaterThan(0)
      expect(result.dataSize).toBe(mockData.length)
    })
  })

  describe('网络状态推荐', () => {
    it('应该为高速网络推荐大文件操作', async () => {
      Object.defineProperty(navigator.connection, 'effectiveType', { 
        value: '4g', 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'downlink', { 
        value: 20, 
        writable: true 
      })
      
      await service.initialize()
      
      const recommendations = service.getSyncRecommendations()
      
      expect(recommendations.batchSize).toBeGreaterThan(50)
      expect(recommendations.maxConcurrentOperations).toBeGreaterThan(3)
      expect(recommendations.enableBackgroundSync).toBe(true)
      expect(recommendations.enableCompression).toBe(false)
    })

    it('应该为低速网络推荐保守设置', async () => {
      Object.defineProperty(navigator.connection, 'effectiveType', { 
        value: '2g', 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'downlink', { 
        value: 0.5, 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'saveData', { 
        value: true, 
        writable: true 
      })
      
      await service.initialize()
      
      const recommendations = service.getSyncRecommendations()
      
      expect(recommendations.batchSize).toBeLessThan(10)
      expect(recommendations.maxConcurrentOperations).toBe(1)
      expect(recommendations.enableCompression).toBe(true)
      expect(recommendations.enableBackgroundSync).toBe(false)
    })

    it('应该为离线状态提供推荐', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      
      await service.initialize()
      
      const recommendations = service.getSyncRecommendations()
      
      expect(recommendations.batchSize).toBe(0)
      expect(recommendations.maxConcurrentOperations).toBe(0)
      expect(recommendations.enableBackgroundSync).toBe(false)
    })
  })

  describe('历史记录和统计', () => {
    it('应该记录网络状态历史', async () => {
      await service.initialize()
      service.startMonitoring()
      
      // 模拟一些状态变化
      Object.defineProperty(navigator, 'onLine', { value: false })
      window.dispatchEvent(new Event('offline'))
      
      Object.defineProperty(navigator, 'onLine', { value: true })
      window.dispatchEvent(new Event('online'))
      
      const history = service.getNetworkHistory()
      expect(history.length).toBeGreaterThan(0)
      expect(history[history.length - 1].isOnline).toBe(true)
    })

    it('应该提供网络统计信息', async () => {
      await service.initialize()
      
      // 添加一些历史记录
      const now = Date.now()
      ;(service as any).connectionHistory.push(
        { timestamp: now - 10000, latency: 100, bandwidth: 10 },
        { timestamp: now - 5000, latency: 150, bandwidth: 8 },
        { timestamp: now, latency: 120, bandwidth: 9 }
      )
      
      const stats = service.getNetworkStats()
      
      expect(stats.averageLatency).toBeGreaterThan(0)
      expect(stats.averageBandwidth).toBeGreaterThan(0)
      expect(stats.uptimePercentage).toBe(100)
    })
  })

  describe('监控控制', () => {
    it('应该能够启动和停止监控', async () => {
      await service.initialize()
      
      service.startMonitoring()
      expect((service as any).isMonitoring).toBe(true)
      
      service.stopMonitoring()
      expect((service as any).isMonitoring).toBe(false)
    })

    it('应该在停止监控时清理资源', async () => {
      await service.initialize()
      service.startMonitoring()
      
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
      
      service.stopMonitoring()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    })
  })

  describe('事件处理', () => {
    it('应该能够添加和移除事件监听器', () => {
      const mockListener = jest.fn()
      const unsubscribe = service.onNetworkChange(mockListener)
      
      expect(typeof unsubscribe).toBe('function')
      
      // 触发事件
      service['notifyListeners']({ type: 'test', isOnline: true })
      expect(mockListener).toHaveBeenCalled()
      
      // 移除监听器
      unsubscribe()
      service['notifyListeners']({ type: 'test', isOnline: true })
      expect(mockListener).toHaveBeenCalledTimes(1)
    })

    it('应该正确通知多个监听器', () => {
      const mockListener1 = jest.fn()
      const mockListener2 = jest.fn()
      
      service.onNetworkChange(mockListener1)
      service.onNetworkChange(mockListener2)
      
      const event: NetworkEvent = {
        type: 'status_change',
        isOnline: false,
        connectionType: 'none',
        timestamp: new Date(),
        quality: { level: 'offline', score: 0, stability: 0 }
      }
      
      service['notifyListeners'](event)
      
      expect(mockListener1).toHaveBeenCalledWith(event)
      expect(mockListener2).toHaveBeenCalledWith(event)
    })
  })

  describe('错误处理', () => {
    it('应该处理网络测试中的异常', async () => {
      // 模拟 fetch 抛出异常
      global.fetch = jest.fn().mockImplementation(() => {
        throw new Error('Connection timeout')
      })
      
      const result = await (service as any).testConnection('https://api.example.com/health')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection timeout')
    })

    it('应该处理无效的连接信息', async () => {
      // 模拟无效的连接信息
      Object.defineProperty(navigator.connection, 'effectiveType', { 
        value: 'invalid-type', 
        writable: true 
      })
      
      await service.initialize()
      
      const quality = service.getNetworkQuality()
      // 应该使用默认值或合理估计
      expect(quality.level).toBeDefined()
      expect(quality.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('配置管理', () => {
    it('应该能够更新监控配置', () => {
      const newConfig = {
        checkInterval: 60000,
        endpoints: ['https://custom-endpoint.com/health'],
        testTimeout: 10000,
        historySize: 100,
        enableLatencyTracking: true,
        enableBandwidthTracking: true,
        enableStabilityTracking: true
      }
      
      service.updateConfig(newConfig)
      
      // 验证配置已更新
      expect((service as any).config).toMatchObject(newConfig)
    })

    it('应该验证配置参数', () => {
      const invalidConfig = {
        checkInterval: -1000,
        testTimeout: 0
      }
      
      expect(() => service.updateConfig(invalidConfig as any)).toThrow()
    })
  })
})