import { globalDOMPool, globalEventListenerPool, globalArrayPool, BatchOperationManager } from '@/utils/object-pool';

export interface MemoryOptimizationConfig {
  enableVirtualization: boolean;
  enableObjectPooling: boolean;
  enableLazyLoading: boolean;
  enableMemoryMonitoring: boolean;
  maxCacheSize: number;
  gcThreshold: number;
  monitoringInterval: number;
}

export interface MemoryMetrics {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  cacheSize: number;
  objectPoolSize: number;
  eventListenerCount: number;
  gcCount: number;
  lastGCTime: number;
  memoryPressure: 'low' | 'medium' | 'high';
}

export class MemoryOptimizationManager {
  private config: MemoryOptimizationConfig;
  private metrics: MemoryMetrics;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private batchManager: BatchOperationManager;
  private memoryPressureCallbacks: Array<(pressure: string) => void> = [];

  constructor(config: Partial<MemoryOptimizationConfig> = {}) {
    this.config = {
      enableVirtualization: true,
      enableObjectPooling: true,
      enableLazyLoading: true,
      enableMemoryMonitoring: true,
      maxCacheSize: 100,
      gcThreshold: 80, // 80%内存使用率触发GC
      monitoringInterval: 5000, // 5秒监控一次
      ...config
    };

    this.metrics = this.initializeMetrics();
    this.batchManager = new BatchOperationManager(50, 100);

    if (this.config.enableMemoryMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * 初始化内存指标
   */
  private initializeMetrics(): MemoryMetrics {
    return {
      totalMemory: this.estimateTotalMemory(),
      usedMemory: 0,
      freeMemory: 0,
      cacheSize: 0,
      objectPoolSize: 0,
      eventListenerCount: 0,
      gcCount: 0,
      lastGCTime: 0,
      memoryPressure: 'low'
    };
  }

  /**
   * 估算总内存
   */
  private estimateTotalMemory(): number {
    // 简单估算：基于设备内存或默认值
    if ('deviceMemory' in navigator) {
      return (navigator as any).deviceMemory * 1024 * 1024 * 1024; // GB to bytes
    }
    return 4 * 1024 * 1024 * 1024; // 默认4GB
  }

  /**
   * 开始内存监控
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.updateMetrics();
      this.checkMemoryPressure();
    }, this.config.monitoringInterval);
  }

  /**
   * 更新内存指标
   */
  private updateMetrics(): void {
    // 更新对象池统计
    const domPoolStats = globalDOMPool.getStats();
    const eventPoolStats = globalEventListenerPool.getStats();
    const arrayPoolStats = globalArrayPool.getStats();

    let totalPoolSize = 0;
    Object.values(domPoolStats).forEach(stats => {
      totalPoolSize += stats.totalCreated * 1024; // 估算每个对象1KB
    });
    Object.values(arrayPoolStats).forEach(stats => {
      totalPoolSize += stats.totalCreated * 512; // 估算每个数组512B
    });

    this.metrics = {
      ...this.metrics,
      usedMemory: this.estimateUsedMemory(),
      cacheSize: this.estimateCacheSize(),
      objectPoolSize: totalPoolSize,
      eventListenerCount: eventPoolStats.totalListeners,
      memoryPressure: this.calculateMemoryPressure()
    };

    this.metrics.freeMemory = this.metrics.totalMemory - this.metrics.usedMemory;
  }

  /**
   * 估算已用内存
   */
  private estimateUsedMemory(): number {
    // 使用 performance.memory 如果可用
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize;
    }

    // 否则基于对象池和缓存大小估算
    return this.metrics.cacheSize + this.metrics.objectPoolSize;
  }

  /**
   * 估算缓存大小
   */
  private estimateCacheSize(): number {
    // 这里可以遍历所有缓存并计算大小
    // 简化实现：基于配置的最大缓存大小
    return this.config.maxCacheSize * 2048; // 每个缓存项2KB
  }

  /**
   * 计算内存压力
   */
  private calculateMemoryPressure(): 'low' | 'medium' | 'high' {
    const usagePercent = (this.metrics.usedMemory / this.metrics.totalMemory) * 100;

    if (usagePercent >= this.config.gcThreshold) {
      return 'high';
    } else if (usagePercent >= this.config.gcThreshold * 0.8) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 检查内存压力并触发相应的优化
   */
  private checkMemoryPressure(): void {
    const oldPressure = this.metrics.memoryPressure;
    const newPressure = this.calculateMemoryPressure();

    if (oldPressure !== newPressure) {
      this.memoryPressureCallbacks.forEach(callback => callback(newPressure));
    }

    switch (newPressure) {
      case 'high':
        this.performAggressiveCleanup();
        break;
      case 'medium':
        this.performModerateCleanup();
        break;
      case 'low':
        // 低压力时进行预防性清理
        this.performLightCleanup();
        break;
    }
  }

  /**
   * 执行积极清理
   */
  private performAggressiveCleanup(): void {
    console.log('🔄 执行积极内存清理...');

    // 清理对象池
    globalDOMPool.clear();
    globalArrayPool.clear();

    // 清理事件监听器
    globalEventListenerPool.clear();

    // 强制垃圾回收（如果可用）
    this.forceGarbageCollection();

    this.metrics.gcCount++;
    this.metrics.lastGCTime = Date.now();

    console.log('✅ 积极内存清理完成');
  }

  /**
   * 执行中等清理
   */
  private performModerateCleanup(): void {
    console.log('🔄 执行中等内存清理...');

    // 清理50%的对象池
    this.cleanupObjectPools(0.5);

    // 执行批量清理
    this.batchManager.flush();

    console.log('✅ 中等内存清理完成');
  }

  /**
   * 执行轻度清理
   */
  private performLightCleanup(): void {
    // 清理25%的对象池
    this.cleanupObjectPools(0.25);
  }

  /**
   * 清理对象池
   */
  private cleanupObjectPools(ratio: number): void {
    // 这里可以实现更智能的清理策略
    // 例如清理最久未使用的对象
  }

  /**
   * 强制垃圾回收
   */
  private forceGarbageCollection(): void {
    // 注意：标准JavaScript中无法直接强制GC
    // 但在某些环境中可以使用特定方法
    if ('gc' in window) {
      (window as any).gc();
    }
  }

  /**
   * 获取内存指标
   */
  getMetrics(): MemoryMetrics {
    return { ...this.metrics };
  }

  /**
   * 添加内存压力回调
   */
  onMemoryPressure(callback: (pressure: string) => void): void {
    this.memoryPressureCallbacks.push(callback);
  }

  /**
   * 移除内存压力回调
   */
  removeMemoryPressureCallback(callback: (pressure: string) => void): void {
    const index = this.memoryPressureCallbacks.indexOf(callback);
    if (index > -1) {
      this.memoryPressureCallbacks.splice(index, 1);
    }
  }

  /**
   * 优化大型数据集
   */
  optimizeLargeDataset<T>(data: T[], chunkSize: number = 100): T[][] {
    if (!this.config.enableVirtualization || data.length <= chunkSize) {
      return [data];
    }

    const chunks: T[][] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * 创建优化的数组
   */
  createOptimizedArray<T>(size: number): T[] {
    if (this.config.enableObjectPooling) {
      return globalArrayPool.acquire(size);
    }
    return new Array(size);
  }

  /**
   * 释放优化的数组
   */
  releaseOptimizedArray<T>(array: T[]): void {
    if (this.config.enableObjectPooling) {
      globalArrayPool.release(array);
    }
  }

  /**
   * 创建优化的DOM元素
   */
  createOptimizedElement(tagName: string, className: string = ''): HTMLElement {
    if (this.config.enableObjectPooling) {
      return globalDOMPool.acquire(tagName, className);
    }
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    return element;
  }

  /**
   * 释放优化的DOM元素
   */
  releaseOptimizedElement(element: HTMLElement): void {
    if (this.config.enableObjectPooling) {
      globalDOMPool.release(element);
    }
  }

  /**
   * 添加优化的批量操作
   */
  addBatchOperation(operation: () => Promise<void> | void): void {
    this.batchManager.add(operation);
  }

  /**
   * 立即执行所有批量操作
   */
  async flushBatchOperations(): Promise<void> {
    await this.batchManager.flush();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 重新启动监控（如果配置改变）
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    if (this.config.enableMemoryMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    timestamp: number;
    metrics: MemoryMetrics;
    config: MemoryOptimizationConfig;
    recommendations: string[];
  } {
    const recommendations = this.generateRecommendations();

    return {
      timestamp: Date.now(),
      metrics: this.metrics,
      config: this.config,
      recommendations
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const usagePercent = (this.metrics.usedMemory / this.metrics.totalMemory) * 100;

    if (usagePercent > 90) {
      recommendations.push('内存使用率过高，建议减少缓存大小或启用更激进的清理策略');
    } else if (usagePercent > 75) {
      recommendations.push('内存使用率较高，建议优化数据结构或减少对象创建');
    }

    if (this.metrics.eventListenerCount > 1000) {
      recommendations.push('事件监听器数量过多，建议清理不用的监听器');
    }

    if (this.metrics.gcCount > 10) {
      recommendations.push('垃圾回收频繁，建议检查内存泄漏');
    }

    return recommendations;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.batchManager.clear();
    globalDOMPool.clear();
    globalEventListenerPool.clear();
    globalArrayPool.clear();

    this.memoryPressureCallbacks.length = 0;
  }
}

// 全局内存优化管理器实例
export const globalMemoryManager = new MemoryOptimizationManager();

// 开发环境下的内存监控工具
if (process.env.NODE_ENV === 'development') {
  // 暴露到全局作用域用于调试
  (window as any).memoryManager = globalMemoryManager;

  // 添加快捷键来触发内存清理
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      console.log('🧹 手动触发内存清理');
      globalMemoryManager.performAggressiveCleanup();
    }
  });
}