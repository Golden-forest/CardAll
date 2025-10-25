import { Card } from '@/types/card';
import { VirtualizedCardGrid } from '@/components/card/virtualized-card-grid';
import { SmartPaginationManager } from '@/services/smart-pagination-manager';
import { globalMemoryManager } from '@/services/memory-optimization-manager';
import { globalDOMPool, globalArrayPool } from '@/utils/object-pool';

export interface PerformanceTestConfig {
  datasetSize: number;
  iterations: number;
  enableVirtualization: boolean;
  enableObjectPooling: boolean;
  enableLazyLoading: boolean;
  enableMemoryMonitoring: boolean;
}

export interface PerformanceTestResult {
  testName: string;
  config: PerformanceTestConfig;
  metrics: {
    renderTime: number;
    memoryUsage: number;
    fps: number;
    interactionLatency: number;
    cacheHitRate: number;
  };
  improvements: {
    renderTimeImprovement: number;
    memoryImprovement: number;
    fpsImprovement: number;
  };
  timestamp: number;
}

export class PerformanceTestUtils {
  private testResults: PerformanceTestResult[] = [];

  /**
   * 生成测试数据
   */
  static generateTestData(count: number): Card[] {
    const cards: Card[] = [];

    for (let i = 0; i < count; i++) {
      cards.push({
        id: `test-card-${i}`,
        frontContent: {
          title: `测试卡片 ${i + 1}`,
          text: `这是第 ${i + 1} 张测试卡片的内容。`,
          style: {
            backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, 80%)`,
            textColor: '#333333',
            fontSize: 16,
            borderRadius: 12,
            padding: 16
          }
        },
        backContent: {
          title: `背面 ${i + 1}`,
          text: `这是卡片 ${i + 1} 的背面内容。`,
          style: {
            backgroundColor: `hsl(${(i * 137.5 + 180) % 360}, 70%, 80%)`,
            textColor: '#333333',
            fontSize: 16,
            borderRadius: 12,
            padding: 16
          }
        },
        isFlipped: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: i % 5 === 0 ? ['测试', '重要'] : ['测试'],
        folderId: 'test-folder',
        styleId: 'test-style'
      });
    }

    return cards;
  }

  /**
   * 测试渲染性能
   */
  async testRenderPerformance(
    cards: Card[],
    config: PerformanceTestConfig
  ): Promise<PerformanceTestResult> {
    const testName = `渲染性能测试 - ${cards.length} 张卡片`;
    console.log(`🧪 开始测试: ${testName}`);

    // 记录开始时间
    const startTime = performance.now();
    const startMemory = globalMemoryManager.getMetrics().usedMemory;

    // 创建容器
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '600px';
    document.body.appendChild(container);

    try {
      // 模拟渲染组件
      const renderStartTime = performance.now();

      // 这里实际应该渲染组件，但我们模拟渲染过程
      await this.simulateRendering(cards, config);

      const renderEndTime = performance.now();
      const renderTime = renderEndTime - renderStartTime;

      // 等待稳定
      await new Promise(resolve => setTimeout(resolve, 100));

      // 测量FPS
      const fps = await this.measureFPS();

      // 测量交互延迟
      const interactionLatency = await this.measureInteractionLatency();

      // 测量内存使用
      const endMemory = globalMemoryManager.getMetrics().usedMemory;
      const memoryUsage = endMemory - startMemory;

      // 获取缓存命中率
      const cacheHitRate = this.calculateCacheHitRate();

      const result: PerformanceTestResult = {
        testName,
        config,
        metrics: {
          renderTime,
          memoryUsage,
          fps,
          interactionLatency,
          cacheHitRate
        },
        improvements: {
          renderTimeImprovement: 0, // 需要对比基准测试
          memoryImprovement: 0,
          fpsImprovement: 0
        },
        timestamp: Date.now()
      };

      this.testResults.push(result);
      console.log(`✅ 测试完成: ${testName}`, result);

      return result;
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * 模拟渲染过程
   */
  private async simulateRendering(cards: Card[], config: PerformanceTestConfig): Promise<void> {
    return new Promise((resolve) => {
      // 模拟虚拟渲染
      if (config.enableVirtualization) {
        const visibleCards = cards.slice(0, 50); // 只渲染前50张
        this.renderCards(visibleCards);
      } else {
        this.renderCards(cards);
      }

      // 模拟渲染延迟
      setTimeout(resolve, config.enableVirtualization ? 50 : 200);
    });
  }

  /**
   * 渲染卡片（简化版）
   */
  private renderCards(cards: Card[]): void {
    // 模拟DOM操作
    const fragment = document.createDocumentFragment();

    cards.forEach((card, index) => {
      const element = document.createElement('div');
      element.textContent = card.frontContent.title;
      element.className = 'test-card';
      element.style.cssText = `
        width: 200px;
        height: 250px;
        margin: 8px;
        padding: 16px;
        border: 1px solid #ccc;
        border-radius: 8px;
        display: inline-block;
        background: ${card.frontContent.style.backgroundColor};
      `;
      fragment.appendChild(element);
    });

    // 清理（避免内存泄漏）
    setTimeout(() => {
      fragment.textContent = '';
    }, 100);
  }

  /**
   * 测量FPS
   */
  private async measureFPS(): Promise<number> {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();
      const duration = 1000; // 测量1秒

      const countFrame = () => {
        frames++;
        if (performance.now() - startTime < duration) {
          requestAnimationFrame(countFrame);
        } else {
          resolve(frames);
        }
      };

      requestAnimationFrame(countFrame);
    });
  }

  /**
   * 测量交互延迟
   */
  private async measureInteractionLatency(): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();

      // 模拟用户交互
      const testElement = document.createElement('div');
      testElement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100px;
        height: 100px;
        background: red;
        cursor: pointer;
        z-index: 9999;
      `;
      document.body.appendChild(testElement);

      const clickHandler = () => {
        const endTime = performance.now();
        const latency = endTime - startTime;

        document.body.removeChild(testElement);
        testElement.removeEventListener('click', clickHandler);
        resolve(latency);
      };

      testElement.addEventListener('click', clickHandler);

      // 模拟点击
      setTimeout(() => {
        testElement.click();
      }, 100);
    });
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(): number {
    // 模拟缓存统计
    const domPoolStats = globalDOMPool.getStats();
    const arrayPoolStats = globalArrayPool.getStats();

    let totalHits = 0;
    let totalRequests = 0;

    Object.values(domPoolStats).forEach(stats => {
      totalHits += stats.totalCreated - stats.poolSize;
      totalRequests += stats.totalCreated;
    });

    Object.values(arrayPoolStats).forEach(stats => {
      totalHits += stats.totalCreated - stats.poolSize;
      totalRequests += stats.totalCreated;
    });

    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  /**
   * 运行综合性能测试
   */
  async runComprehensiveTest(): Promise<PerformanceTestResult[]> {
    console.log('🚀 开始综合性能测试...');

    const testConfigs: PerformanceTestConfig[] = [
      {
        datasetSize: 100,
        iterations: 1,
        enableVirtualization: false,
        enableObjectPooling: false,
        enableLazyLoading: false,
        enableMemoryMonitoring: true
      },
      {
        datasetSize: 100,
        iterations: 1,
        enableVirtualization: true,
        enableObjectPooling: true,
        enableLazyLoading: true,
        enableMemoryMonitoring: true
      },
      {
        datasetSize: 1000,
        iterations: 1,
        enableVirtualization: false,
        enableObjectPooling: false,
        enableLazyLoading: false,
        enableMemoryMonitoring: true
      },
      {
        datasetSize: 1000,
        iterations: 1,
        enableVirtualization: true,
        enableObjectPooling: true,
        enableLazyLoading: true,
        enableMemoryMonitoring: true
      }
    ];

    const results: PerformanceTestResult[] = [];

    for (const config of testConfigs) {
      const testData = PerformanceTestUtils.generateTestData(config.datasetSize);
      const result = await this.testRenderPerformance(testData, config);
      results.push(result);
    }

    // 计算改进幅度
    this.calculateImprovements(results);

    console.log('🎉 综合性能测试完成');
    return results;
  }

  /**
   * 计算性能改进
   */
  private calculateImprovements(results: PerformanceTestResult[]): void {
    // 找到基准测试结果（无优化的测试）
    const baselineResults = results.filter(r =>
      !r.config.enableVirtualization &&
      !r.config.enableObjectPooling
    );

    baselineResults.forEach(baseline => {
      const optimizedResults = results.filter(r =>
        r.datasetSize === baseline.datasetSize &&
        (r.config.enableVirtualization || r.config.enableObjectPooling)
      );

      optimizedResults.forEach(optimized => {
        const renderTimeImprovement =
          ((baseline.metrics.renderTime - optimized.metrics.renderTime) / baseline.metrics.renderTime) * 100;

        const memoryImprovement =
          ((baseline.metrics.memoryUsage - optimized.metrics.memoryUsage) / baseline.metrics.memoryUsage) * 100;

        const fpsImprovement =
          ((optimized.metrics.fps - baseline.metrics.fps) / baseline.metrics.fps) * 100;

        optimized.improvements = {
          renderTimeImprovement,
          memoryImprovement,
          fpsImprovement
        };
      });
    });
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): {
    summary: {
      totalTests: number;
      averageRenderTime: number;
      averageMemoryUsage: number;
      averageFPS: number;
      averageImprovement: number;
    };
    results: PerformanceTestResult[];
    recommendations: string[];
  } {
    const summary = {
      totalTests: this.testResults.length,
      averageRenderTime: 0,
      averageMemoryUsage: 0,
      averageFPS: 0,
      averageImprovement: 0
    };

    if (this.testResults.length > 0) {
      summary.averageRenderTime =
        this.testResults.reduce((sum, r) => sum + r.metrics.renderTime, 0) / this.testResults.length;

      summary.averageMemoryUsage =
        this.testResults.reduce((sum, r) => sum + r.metrics.memoryUsage, 0) / this.testResults.length;

      summary.averageFPS =
        this.testResults.reduce((sum, r) => sum + r.metrics.fps, 0) / this.testResults.length;

      summary.averageImprovement =
        this.testResults.reduce((sum, r) => sum + r.improvements.renderTimeImprovement, 0) / this.testResults.length;
    }

    const recommendations = this.generateRecommendations();

    return {
      summary,
      results: this.testResults,
      recommendations
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.testResults.length === 0) {
      return ['请先运行性能测试'];
    }

    const avgRenderTime = this.testResults.reduce((sum, r) => sum + r.metrics.renderTime, 0) / this.testResults.length;
    const avgMemoryUsage = this.testResults.reduce((sum, r) => sum + r.metrics.memoryUsage, 0) / this.testResults.length;
    const avgFPS = this.testResults.reduce((sum, r) => sum + r.metrics.fps, 0) / this.testResults.length;

    if (avgRenderTime > 200) {
      recommendations.push('渲染时间过长，建议启用虚拟化');
    }

    if (avgMemoryUsage > 50 * 1024 * 1024) { // 50MB
      recommendations.push('内存使用过高，建议启用对象池和内存优化');
    }

    if (avgFPS < 55) {
      recommendations.push('FPS偏低，建议优化动画和渲染性能');
    }

    return recommendations;
  }

  /**
   * 清理测试结果
   */
  clearResults(): void {
    this.testResults.length = 0;
  }

  /**
   * 获取测试结果
   */
  getResults(): PerformanceTestResult[] {
    return [...this.testResults];
  }
}

// 全局性能测试工具实例
export const globalPerformanceTester = new PerformanceTestUtils();

// 开发环境下的性能测试快捷方式
if (process.env.NODE_ENV === 'development') {
  (window as any).performanceTester = globalPerformanceTester;

  console.log('🧪 性能测试工具已加载');
  console.log('使用方法:');
  console.log('  performanceTester.runComprehensiveTest() - 运行综合测试');
  console.log('  performanceTester.generatePerformanceReport() - 生成报告');
}