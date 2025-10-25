import { Card } from '@/types/card';

export interface PaginationConfig {
  pageSize: number;
  prefetchCount: number;
  maxCacheSize: number;
  enableSmartPrefetching: boolean;
  enableMemoryOptimization: boolean;
}

export interface PageInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

export interface PaginationMetrics {
  loadTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  averagePageLoadTime: number;
  prefetchAccuracy: number;
}

export class SmartPaginationManager {
  private cache = new Map<string, Card[]>();
  private prefetchQueue = new Set<number>();
  private loadingPages = new Set<number>();
  private metrics: PaginationMetrics = {
    loadTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    averagePageLoadTime: 0,
    prefetchAccuracy: 0
  };

  private totalRequests = 0;
  private cacheHits = 0;
  private prefetchHits = 0;
  private totalPrefetchAttempts = 0;
  private loadTimes: number[] = [];

  constructor(
    private config: PaginationConfig,
    private dataLoader: (page: number, pageSize: number) => Promise<Card[]>
  ) {
    this.config = {
      pageSize: 20,
      prefetchCount: 2,
      maxCacheSize: 100,
      enableSmartPrefetching: true,
      enableMemoryOptimization: true,
      ...config
    };
  }

  /**
   * 获取页面数据
   */
  async getPage(page: number): Promise<{ cards: Card[]; pageInfo: PageInfo }> {
    const startTime = performance.now();
    this.totalRequests++;

    // 检查缓存
    const cacheKey = this.getCacheKey(page, this.config.pageSize);
    const cachedData = this.cache.get(cacheKey);

    if (cachedData) {
      this.cacheHits++;
      this.updateMetrics(performance.now() - startTime, true);
      return {
        cards: cachedData,
        pageInfo: this.getPageInfo(page, this.config.pageSize)
      };
    }

    // 加载数据
    if (!this.loadingPages.has(page)) {
      this.loadingPages.add(page);

      try {
        const data = await this.dataLoader(page, this.config.pageSize);

        // 缓存数据
        this.cache.set(cacheKey, data);
        this.loadingPages.delete(page);

        // 智能预取相邻页面
        if (this.config.enableSmartPrefetching) {
          this.prefetchAdjacentPages(page);
        }

        // 内存优化
        if (this.config.enableMemoryOptimization) {
          this.optimizeMemoryUsage();
        }

        this.updateMetrics(performance.now() - startTime, false);

        return {
          cards: data,
          pageInfo: this.getPageInfo(page, this.config.pageSize)
        };
      } catch (error) {
        this.loadingPages.delete(page);
        throw error;
      }
    }

    // 如果页面正在加载，等待完成
    await this.waitForPageLoad(page);
    return this.getPage(page);
  }

  /**
   * 智能预取相邻页面
   */
  private async prefetchAdjacentPages(currentPage: number): Promise<void> {
    const pagesToPrefetch = [];

    // 预取下一页
    for (let i = 1; i <= this.config.prefetchCount; i++) {
      const nextPage = currentPage + i;
      if (!this.cache.has(this.getCacheKey(nextPage, this.config.pageSize))) {
        pagesToPrefetch.push(nextPage);
      }
    }

    // 预取上一页
    for (let i = 1; i <= this.config.prefetchCount; i++) {
      const prevPage = currentPage - i;
      if (prevPage >= 1 && !this.cache.has(this.getCacheKey(prevPage, this.config.pageSize))) {
        pagesToPrefetch.push(prevPage);
      }
    }

    // 异步预取
    pagesToPrefetch.forEach(page => {
      if (!this.prefetchQueue.has(page) && !this.loadingPages.has(page)) {
        this.prefetchQueue.add(page);
        this.prefetchPage(page);
      }
    });
  }

  /**
   * 预取指定页面
   */
  private async prefetchPage(page: number): Promise<void> {
    this.totalPrefetchAttempts++;

    try {
      const cacheKey = this.getCacheKey(page, this.config.pageSize);
      const data = await this.dataLoader(page, this.config.pageSize);

      this.cache.set(cacheKey, data);
      this.prefetchQueue.delete(page);

      // 检查预取准确性（如果用户在预取后立即访问该页面）
      if (this.loadingPages.has(page)) {
        this.prefetchHits++;
      }
    } catch (error) {
      this.prefetchQueue.delete(page);
      console.warn(`Failed to prefetch page ${page}:`, error);
    }
  }

  /**
   * 等待页面加载完成
   */
  private async waitForPageLoad(page: number): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.loadingPages.has(page)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    });
  }

  /**
   * 内存优化
   */
  private optimizeMemoryUsage(): void {
    if (this.cache.size <= this.config.maxCacheSize) return;

    // LRU缓存策略：删除最久未使用的页面
    const keysToDelete = Array.from(this.cache.keys())
      .slice(0, Math.floor(this.cache.size * 0.2)); // 删除20%的缓存

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    // 更新内存使用指标
    this.updateMemoryUsage();
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(loadTime: number, isCacheHit: boolean): void {
    this.metrics.loadTime = loadTime;
    this.loadTimes.push(loadTime);

    // 保持最近100次的加载时间
    if (this.loadTimes.length > 100) {
      this.loadTimes = this.loadTimes.slice(-100);
    }

    // 计算平均加载时间
    this.metrics.averagePageLoadTime =
      this.loadTimes.reduce((sum, time) => sum + time, 0) / this.loadTimes.length;

    // 计算缓存命中率
    this.metrics.cacheHitRate = this.totalRequests > 0
      ? this.cacheHits / this.totalRequests
      : 0;

    // 计算预取准确性
    this.metrics.prefetchAccuracy = this.totalPrefetchAttempts > 0
      ? this.prefetchHits / this.totalPrefetchAttempts
      : 0;
  }

  /**
   * 更新内存使用情况
   */
  private updateMemoryUsage(): void {
    let totalMemory = 0;

    // 估算缓存数据内存使用
    this.cache.forEach(data => {
      totalMemory += this.estimateDataSize(data);
    });

    this.metrics.memoryUsage = totalMemory;
  }

  /**
   * 估算数据大小
   */
  private estimateDataSize(data: Card[]): number {
    // 简单的内存估算：每张卡片约2KB
    return data.length * 2048;
  }

  /**
   * 获取页面信息
   */
  private getPageInfo(page: number, pageSize: number): PageInfo {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize - 1;

    return {
      currentPage: page,
      totalPages: Math.ceil(this.getTotalItems() / pageSize),
      totalItems: this.getTotalItems(),
      hasNextPage: endIndex < this.getTotalItems() - 1,
      hasPreviousPage: page > 1,
      startIndex,
      endIndex
    };
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(page: number, pageSize: number): string {
    return `${page}_${pageSize}`;
  }

  /**
   * 获取总项目数（需要子类实现或通过配置设置）
   */
  private getTotalItems(): number {
    // 这里可以通过配置或回调获取总项目数
    return this.config.maxCacheSize * this.config.pageSize;
  }

  /**
   * 预热缓存
   */
  async warmupCache(startPage: number = 1, pageCount: number = 3): Promise<void> {
    const promises = [];

    for (let i = 0; i < pageCount; i++) {
      const page = startPage + i;
      if (!this.cache.has(this.getCacheKey(page, this.config.pageSize))) {
        promises.push(this.getPage(page));
      }
    }

    await Promise.all(promises);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.prefetchQueue.clear();
    this.loadingPages.clear();
    this.resetMetrics();
  }

  /**
   * 重置指标
   */
  private resetMetrics(): void {
    this.metrics = {
      loadTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      averagePageLoadTime: 0,
      prefetchAccuracy: 0
    };
    this.totalRequests = 0;
    this.cacheHits = 0;
    this.prefetchHits = 0;
    this.totalPrefetchAttempts = 0;
    this.loadTimes = [];
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PaginationMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    cacheSize: number;
    maxCacheSize: number;
    hitRate: number;
    memoryUsage: number;
    loadingPages: number;
    prefetchQueue: number;
  } {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize,
      hitRate: this.metrics.cacheHitRate,
      memoryUsage: this.metrics.memoryUsage,
      loadingPages: this.loadingPages.size,
      prefetchQueue: this.prefetchQueue.size
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 如果减少了最大缓存大小，立即进行内存优化
    if (newConfig.maxCacheSize !== undefined && newConfig.maxCacheSize < this.config.maxCacheSize) {
      this.optimizeMemoryUsage();
    }
  }

  /**
   * 强制预取特定页面
   */
  async forcePrefetch(page: number): Promise<void> {
    if (!this.cache.has(this.getCacheKey(page, this.config.pageSize))) {
      await this.prefetchPage(page);
    }
  }

  /**
   * 获取所有缓存的页面
   */
  getCachedPages(): number[] {
    return Array.from(this.cache.keys()).map(key => {
      const [page] = key.split('_');
      return parseInt(page, 10);
    });
  }

  /**
   * 检查页面是否已缓存
   */
  isPageCached(page: number): boolean {
    return this.cache.has(this.getCacheKey(page, this.config.pageSize));
  }

  /**
   * 获取预测的用户行为模式
   */
  getPredictedNextPage(currentPage: number): number {
    // 基于历史访问模式预测下一页
    // 这里可以实现更复杂的预测算法
    const cachedPages = this.getCachedPages();
    const nextPages = cachedPages.filter(p => p > currentPage);

    if (nextPages.length > 0) {
      return Math.min(...nextPages);
    }

    return currentPage + 1;
  }
}