/**
 * 高级内存泄漏检测器
 * 使用 WeakMap, FinalizationRegistry 和其他现代 API 来检测内存泄漏
 */
export export export class AdvancedMemoryLeakDetector {
  private leaks = new Map<string, MemoryLeakInfo>();
  private objectRegistry = new FinalizationRegistry((heldValue: string) => {
    this.onObjectCollected(heldValue);
  });

  private weakRefs = new WeakMap<object, string>();
  private objectSizes = new WeakMap<object, number>();
  private stackTraces = new Map<string, string>();

  private detectionTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private config = {
      detectionInterval: 30000, // 30秒检测一次
      reportInterval: 300000, // 5分钟报告一次
      minLeakAge: 60000, // 1分钟以上的对象才认为是泄漏
      enableStackTrace: true,
      maxTrackedObjects: 10000
    }
  ) {}

  /**
   * 启动检测器
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🔍 内存泄漏检测器已启动');

    // 定期检测内存泄漏
    this.detectionTimer = setInterval(() => {
      this.detectLeaks();
    }, this.config.detectionInterval);

    // 页面卸载时生成最终报告
    window.addEventListener('beforeunload', () => {
      this.generateFinalReport();
    });
  }

  /**
   * 停止检测器
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }

    console.log('🔍 内存泄漏检测器已停止');
  }

  /**
   * 跟踪对象
   */
  trackObject<T extends object>(
    obj: T,
    type: string,
    metadata: { size?: number; location?: string } = {}
  ): void {
    if (!this.isRunning || this.weakRefs.size >= this.config.maxTrackedObjects) {
      return;
    }

    const id = this.generateObjectId();
    const size = metadata.size || this.estimateObjectSize(obj);
    const location = metadata.location || this.getCurrentLocation();

    // 创建弱引用
    const weakRef = new WeakRef(obj);
    this.weakRefs.set(obj, id);

    // 存储对象大小
    this.objectSizes.set(obj, size);

    // 注册最终化回调
    this.objectRegistry.register(obj, id, weakRef);

    // 记录对象信息
    const leakInfo: MemoryLeakInfo = {
      id,
      type,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      size,
      location
    };

    if (this.config.enableStackTrace) {
      leakInfo.stackTrace = this.captureStackTrace();
    }

    this.leaks.set(id, leakInfo);

    // 定期访问对象以保持活跃（用于检测真正的泄漏）
    this.scheduleObjectAccess(id, obj);
  }

  /**
   * 跟踪 DOM 元素
   */
  trackDOMElement(
    element: HTMLElement,
    type: string,
    metadata: { size?: number; location?: string } = {}
  ): void {
    this.trackObject(element, type, {
      size: metadata.size || this.estimateElementSize(element),
      location: metadata.location || `${element.tagName.toLowerCase()}#${element.id || 'unnamed'}`
    });

    // 监听元素移除事件
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.removedNodes.length > 0) {
          mutation.removedNodes.forEach((node) => {
            if (node === element || node.contains(element)) {
              this.onDOMElementRemoved(element, id);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * 跟踪事件监听器
   */
  trackEventListener(
    target: EventTarget,
    event: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions
  ): void {
    this.trackObject(listener, 'event-listener', {
      location: `${event} event listener`
    });

    // 包装原始监听器
    const wrappedListener = (...args: any[]) => {
      try {
        if (typeof listener === 'function') {
          listener(...args);
        } else {
          listener.handleEvent(args[0]);
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
    };

    // 添加原始监听器
    target.addEventListener(event, listener, options);

    // 跟踪目标对象
    this.trackObject(target, 'event-target', {
      location: `${event} event target`
    });
  }

  /**
   * 对象被垃圾回收时的回调
   */
  private onObjectCollected(objectId: string): void {
    const leakInfo = this.leaks.get(objectId);
    if (leakInfo) {
      const lifetime = Date.now() - leakInfo.createdAt;

      console.log(`🗑️ 对象已回收: ${leakInfo.type} (ID: ${objectId}, 存活时间: ${lifetime}ms)`);

      this.leaks.delete(objectId);
      this.stackTraces.delete(objectId);
    }
  }

  /**
   * DOM 元素被移除时的回调
   */
  private onDOMElementRemoved(element: HTMLElement, elementId: string): void {
    const leakInfo = this.leaks.get(elementId);
    if (leakInfo) {
      const lifetime = Date.now() - leakInfo.createdAt;

      console.log(`🗑️ DOM 元素已移除: ${leakInfo.type} (ID: ${elementId}, 存活时间: ${lifetime}ms)`);

      this.leaks.delete(elementId);
      this.stackTraces.delete(elementId);
    }
  }

  /**
   * 检测内存泄漏
   */
  private detectLeaks(): void {
    const now = Date.now();
    const detectedLeaks: MemoryLeakInfo[] = [];

    this.leaks.forEach((leakInfo, id) => {
      const age = now - leakInfo.createdAt;

      // 检查是否为潜在泄漏
      if (age > this.config.minLeakAge) {
        // 检查对象是否仍然存在
        const obj = this.getObjectById(id);
        if (obj) {
          // 对象仍然存在,可能是泄漏
          detectedLeaks.push(leakInfo);
        }
      }
    });

    if (detectedLeaks.length > 0) {
      console.warn(`🚨 检测到 ${detectedLeaks.length} 个潜在内存泄漏`);
      detectedLeaks.forEach(leak => {
        console.warn(`  - ${leak.type} (ID: ${leak.id}, 大小: ${leak.size} bytes, 存活时间: ${now - leak.createdAt}ms)`);
        if (leak.stackTrace) {
          console.warn(`    创建位置: ${leak.stackTrace}`);
        }
      });

      // 生成报告
      this.generateLeakReport(detectedLeaks);
    }
  }

  /**
   * 通过 ID 获取对象
   */
  private getObjectById(id: string): object | null {
    // 这里需要遍历 WeakMap 来查找对象
    // 由于 WeakMap 不可遍历,我们需要其他方法
    // 这是一个简化的实现
    return null;
  }

  /**
   * 定期访问对象
   */
  private scheduleObjectAccess(id: string, obj: object): void {
    // 随机时间后访问对象以保持引用
    const delay = Math.random() * 30000 + 10000; // 10-40秒

    setTimeout(() => {
      const leakInfo = this.leaks.get(id);
      if (leakInfo) {
        leakInfo.lastAccessed = Date.now();

        // 继续下一次访问
        this.scheduleObjectAccess(id, obj);
      }
    }, delay);
  }

  /**
   * 生成泄漏报告
   */
  private generateLeakReport(detectedLeaks: MemoryLeakInfo[]): void {
    const totalMemory = detectedLeaks.reduce((sum, leak) => sum + leak.size, 0);
    const topLeaks = detectedLeaks
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    const report: MemoryLeakReport = {
      timestamp: Date.now(),
      totalLeaks: detectedLeaks.length,
      totalMemory,
      leaks: detectedLeaks,
      topLeaks,
      recommendations: this.generateLeakRecommendations(detectedLeaks)
    };

    console.group('📊 内存泄漏报告');
    console.log(`总泄漏数量: ${report.totalLeaks}`);
    console.log(`总泄漏内存: ${this.formatBytes(report.totalMemory)}`);
    console.log('主要泄漏:');
    report.topLeaks.forEach((leak, index) => {
      console.log(`${index + 1}. ${leak.type} - ${this.formatBytes(leak.size)} (存活时间: ${Date.now() - leak.createdAt}ms)`);
    });
    console.log('建议:', report.recommendations);
    console.groupEnd();

    // 可以发送到服务器或保存到本地存储
    this.saveReport(report);
  }

  /**
   * 生成最终报告
   */
  private generateFinalReport(): void {
    const report = this.generateComprehensiveReport();
    console.log('📋 最终内存泄漏报告:', report);
    this.saveReport(report);
  }

  /**
   * 生成综合报告
   */
  generateComprehensiveReport(): MemoryLeakReport {
    const now = Date.now();
    const allLeaks = Array.from(this.leaks.values());
    const totalMemory = allLeaks.reduce((sum, leak) => sum + leak.size, 0);
    const topLeaks = allLeaks
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    return {
      timestamp: now,
      totalLeaks: allLeaks.length,
      totalMemory,
      leaks: allLeaks,
      topLeaks,
      recommendations: this.generateLeakRecommendations(allLeaks)
    };
  }

  /**
   * 生成泄漏建议
   */
  private generateLeakRecommendations(leaks: MemoryLeakInfo[]): string[] {
    const recommendations: string[] = [];

    if (leaks.length === 0) {
      recommendations.push('✅ 未检测到明显的内存泄漏');
      return recommendations;
    }

    // 按类型统计
    const typeCount = new Map<string, number>();
    leaks.forEach(leak => {
      typeCount.set(leak.type, (typeCount.get(leak.type) || 0) + 1);
    });

    // 分析常见泄漏类型
    const sortedTypes = Array.from(typeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    sortedTypes.forEach(([type, count]) => {
      if (type === 'event-listener') {
        recommendations.push(`发现 ${count} 个未清理的事件监听器,建议在组件卸载时移除监听器`);
      } else if (type === 'dom-element') {
        recommendations.push(`发现 ${count} 个未清理的 DOM 元素,建议在组件卸载时清理 DOM`);
      } else if (type === 'timer') {
        recommendations.push(`发现 ${count} 个未清理的定时器,建议在组件卸载时清除定时器`);
      } else {
        recommendations.push(`发现 ${count} 个 ${type} 类型的泄漏,建议检查相关代码`);
      }
    });

    // 总量建议
    const totalMemory = leaks.reduce((sum, leak) => sum + leak.size, 0);
    if (totalMemory > 10 * 1024 * 1024) { // 10MB
      recommendations.push('内存泄漏总量较大,建议优先处理大内存对象的泄漏');
    }

    return recommendations;
  }

  /**
   * 保存报告
   */
  private saveReport(report: MemoryLeakReport): void {
    try {
      const reports = this.getStoredReports();
      reports.push(report);

      // 只保留最近20个报告
      if (reports.length > 20) {
        reports.splice(0, reports.length - 20);
      }

      localStorage.setItem('memory-leak-reports', JSON.stringify(reports));
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  /**
   * 获取存储的报告
   */
  private getStoredReports(): MemoryLeakReport[] {
    try {
      const stored = localStorage.getItem('memory-leak-reports');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * 获取历史报告
   */
  getHistoricalReports(): MemoryLeakReport[] {
    return this.getStoredReports();
  }

  /**
   * 清除历史报告
   */
  clearHistoricalReports(): void {
    localStorage.removeItem('memory-leak-reports');
  }

  /**
   * 获取当前统计信息
   */
  getStatistics(): {
    trackedObjects: number;
    totalMemory: number;
    averageLifetime: number;
    topTypes: Array<{ type: string; count: number }>;
  } {
    const leaks = Array.from(this.leaks.values());
    const totalMemory = leaks.reduce((sum, leak) => sum + leak.size, 0);
    const averageLifetime = leaks.length > 0
      ? leaks.reduce((sum, leak) => sum + (Date.now() - leak.createdAt), 0) / leaks.length
      : 0;

    const typeCount = new Map<string, number>();
    leaks.forEach(leak => {
      typeCount.set(leak.type, (typeCount.get(leak.type) || 0) + 1);
    });

    const topTypes = Array.from(typeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      trackedObjects: this.leaks.size,
      totalMemory,
      averageLifetime,
      topTypes
    };
  }

  /**
   * 手动触发垃圾回收（仅用于测试）
   */
  forceGarbageCollection(): void {
    if ('gc' in window) {
      (window as any).gc();
      console.log('🗑️ 手动触发垃圾回收');
    } else {
      console.log('⚠️ 当前环境不支持手动垃圾回收');
    }
  }

  /**
   * 辅助方法
   */
  private generateObjectId(): string {
    return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateObjectSize(obj: any): number {
    // 简化的对象大小估算
    const json = JSON.stringify(obj);
    return json.length * 2; // UTF-16 编码,每个字符2字节
  }

  private estimateElementSize(element: HTMLElement): number {
    // 估算 DOM 元素大小
    const html = element.outerHTML;
    return html.length * 2;
  }

  private getCurrentLocation(): string {
    const stack = new Error().stack || '';
    const lines = stack.split('\n');
    if (lines.length > 3) {
      return lines[3].trim();
    }
    return 'unknown';
  }

  private captureStackTrace(): string {
    const stack = new Error().stack || '';
    return stack.split('\n').slice(3, 8).join('\n');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stop();
    this.leaks.clear();
    this.weakRefs = new WeakMap();
    this.objectSizes = new WeakMap();
    this.stackTraces.clear();
  }
}

// 全局内存泄漏检测器实例
export const globalMemoryLeakDetector = new AdvancedMemoryLeakDetector();

// 开发环境下自动启动
if (process.env.NODE_ENV === 'development') {
  globalMemoryLeakDetector.start();
  (window as any).memoryLeakDetector = globalMemoryLeakDetector;

  console.log('🔍 内存泄漏检测器已启动（开发模式）');
  console.log('使用方法:');
  console.log('  memoryLeakDetector.trackObject(obj, "type") - 跟踪对象');
  console.log('  memoryLeakDetector.generateComprehensiveReport() - 生成报告');
  console.log('  memoryLeakDetector.forceGarbageCollection() - 强制GC');
}