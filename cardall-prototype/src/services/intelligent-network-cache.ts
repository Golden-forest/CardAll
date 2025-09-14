/**
 * 智能网络缓存系统
 * 支持多级缓存、预测性预加载和智能重试机制
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
  size: number;
  priority: 'low' | 'medium' | 'high';
}

export interface CacheConfig {
  maxMemorySize: number; // 最大内存使用 (bytes)
  maxDiskSize: number; // 最大磁盘使用 (bytes)
  defaultTTL: number; // 默认TTL (ms)
  enableCompression: boolean;
  enablePredictivePrefetch: boolean;
  enableSmartRetry: boolean;
  retryAttempts: number;
  retryDelay: number;
  cacheLevels: {
    memory: boolean;
    disk: boolean;
    network: boolean;
  };
}

export interface CacheMetrics {
  memoryUsage: number;
  diskUsage: number;
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheHits: number;
  averageResponseTime: number;
  retryCount: number;
  prefetchAccuracy: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition: (error: any) => boolean;
}

export class IntelligentNetworkCache {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private prefetchQueue = new Set<string>();
  private retryQueue = new Array<{ url: string; attempt: number; timestamp: number }>();

  private metrics: CacheMetrics = {
    memoryUsage: 0,
    diskUsage: 0,
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    cacheHits: 0,
    averageResponseTime: 0,
    retryCount: 0,
    prefetchAccuracy: 0
  };

  private totalPrefetchAttempts = 0;
  private successfulPrefetches = 0;

  constructor(
    private config: CacheConfig,
    private fetchFn: (url: string, options?: RequestInit) => Promise<any>
  ) {
    this.initializeCache();
    this.startMaintenance();
  }

  /**
   * 初始化缓存
   */
  private async initializeCache(): Promise<void> {
    if (this.config.cacheLevels.disk) {
      await this.loadDiskCache();
    }
  }

  /**
   * 获取数据
   */
  async get<T>(url: string, options?: RequestInit & { forceRefresh?: boolean }): Promise<T> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    // 检查内存缓存
    if (!options?.forceRefresh) {
      const memoryEntry = this.getFromMemoryCache<T>(url);
      if (memoryEntry) {
        this.metrics.cacheHits++;
        this.updateMetrics(performance.now() - startTime, true);
        return memoryEntry.data;
      }
    }

    // 检查磁盘缓存
    if (!options?.forceRefresh && this.config.cacheLevels.disk) {
      const diskEntry = await this.getFromDiskCache<T>(url);
      if (diskEntry) {
        // 升级到内存缓存
        this.setMemoryCache(url, diskEntry);
        this.metrics.cacheHits++;
        this.updateMetrics(performance.now() - startTime, true);
        return diskEntry.data;
      }
    }

    // 去重相同请求
    if (this.pendingRequests.has(url)) {
      const data = await this.pendingRequests.get(url);
      this.updateMetrics(performance.now() - startTime, true);
      return data;
    }

    // 发起网络请求
    const requestPromise = this.fetchWithRetry(url, options);
    this.pendingRequests.set(url, requestPromise);

    try {
      const data = await requestPromise;
      this.pendingRequests.delete(url);

      // 缓存结果
      await this.setCache(url, data);

      // 智能预取相关资源
      if (this.config.enablePredictivePrefetch) {
        this.predictivePrefetch(url, data);
      }

      this.updateMetrics(performance.now() - startTime, false);
      return data;
    } catch (error) {
      this.pendingRequests.delete(url);
      throw error;
    }
  }

  /**
   * 带重试的获取
   */
  private async fetchWithRetry(url: string, options?: RequestInit): Promise<any> {
    let lastError: any;
    const retryConfig: RetryConfig = {
      maxAttempts: this.config.retryAttempts,
      baseDelay: this.config.retryDelay,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryCondition: (error) => {
        // 重试网络错误和5xx状态码
        return error instanceof TypeError ||
               (error.status >= 500 && error.status < 600) ||
               error.status === 429; // Too Many Requests
      }
    };

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.fetchFn(url, options);

        if (!response.ok) {
          throw {
            status: response.status,
            message: response.statusText,
            response
          };
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        this.metrics.retryCount++;

        if (attempt === retryConfig.maxAttempts || !retryConfig.retryCondition(error)) {
          throw error;
        }

        // 计算延迟时间
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        // 添加随机抖动
        const jitter = delay * 0.1 * Math.random();
        const totalDelay = delay + jitter;

        console.log(`🔄 重试请求 (${attempt}/${retryConfig.maxAttempts}): ${url}，延迟 ${totalDelay.toFixed(0)}ms`);

        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }

    throw lastError;
  }

  /**
   * 从内存缓存获取
   */
  private getFromMemoryCache<T>(url: string): CacheEntry<T> | null {
    const entry = this.memoryCache.get(url);
    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(url);
      return null;
    }

    // 更新访问信息
    entry.hitCount++;
    entry.lastAccessed = Date.now();

    return entry;
  }

  /**
   * 从磁盘缓存获取
   */
  private async getFromDiskCache<T>(url: string): Promise<CacheEntry<T> | null> {
    try {
      const cacheKey = this.getCacheKey(url);
      const cachedData = localStorage.getItem(cacheKey);

      if (!cachedData) return null;

      const entry: CacheEntry<T> = JSON.parse(cachedData);

      // 检查是否过期
      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return entry;
    } catch (error) {
      console.warn('从磁盘缓存读取失败:', error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  private async setCache<T>(url: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: this.config.defaultTTL,
      hitCount: 0,
      lastAccessed: Date.now(),
      size: this.estimateDataSize(data),
      priority: this.calculatePriority(url, data)
    };

    // 内存缓存
    this.setMemoryCache(url, entry);

    // 磁盘缓存
    if (this.config.cacheLevels.disk) {
      await this.setDiskCache(url, entry);
    }

    // 内存管理
    this.manageMemoryUsage();
  }

  /**
   * 设置内存缓存
   */
  private setMemoryCache<T>(url: string, entry: CacheEntry<T>): void {
    this.memoryCache.set(url, entry);
  }

  /**
   * 设置磁盘缓存
   */
  private async setDiskCache<T>(url: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(url);
      const serialized = JSON.stringify(entry);

      if (this.config.enableCompression) {
        // 这里可以添加压缩逻辑
      }

      localStorage.setItem(cacheKey, serialized);
    } catch (error) {
      console.warn('写入磁盘缓存失败:', error);
    }
  }

  /**
   * 预测性预取
   */
  private predictivePrefetch(currentUrl: string, currentData: any): void {
    // 基于当前URL和数据预测相关资源
    const relatedUrls = this.predictRelatedResources(currentUrl, currentData);

    relatedUrls.forEach(url => {
      if (!this.memoryCache.has(url) && !this.prefetchQueue.has(url)) {
        this.prefetchQueue.add(url);
        this.prefetchResource(url);
      }
    });
  }

  /**
   * 预测相关资源
   */
  private predictRelatedResources(url: string, data: any): string[] {
    const relatedUrls: string[] = [];

    // 解析URL模式
    const urlPattern = this.analyzeUrlPattern(url);

    // 基于数据内容预测
    if (data && Array.isArray(data)) {
      // 如果是数组数据，预取下一页
      const nextPage = this.extractNextPage(url);
      if (nextPage) {
        relatedUrls.push(nextPage);
      }
    }

    // 基于历史访问模式预测
    const historicalPredictions = this.getHistoricalPredictions(url);
    relatedUrls.push(...historicalPredictions);

    return relatedUrls.slice(0, 3); // 限制预取数量
  }

  /**
   * 分析URL模式
   */
  private analyzeUrlPattern(url: string): {
    baseUrl: string;
    hasPagination: boolean;
    hasParameters: boolean;
  } {
    try {
      const urlObj = new URL(url);
      const hasPagination = urlObj.searchParams.has('page') || urlObj.searchParams.has('offset');
      const hasParameters = urlObj.searchParams.size > 0;

      return {
        baseUrl: `${urlObj.origin}${urlObj.pathname}`,
        hasPagination,
        hasParameters
      };
    } catch {
      return {
        baseUrl: url,
        hasPagination: false,
        hasParameters: false
      };
    }
  }

  /**
   * 提取下一页URL
   */
  private extractNextPage(currentUrl: string): string | null {
    try {
      const urlObj = new URL(currentUrl);
      const currentPage = parseInt(urlObj.searchParams.get('page') || '1');

      if (!isNaN(currentPage)) {
        urlObj.searchParams.set('page', (currentPage + 1).toString());
        return urlObj.toString();
      }

      const offset = parseInt(urlObj.searchParams.get('offset') || '0');
      if (!isNaN(offset)) {
        urlObj.searchParams.set('offset', (offset + 50).toString());
        return urlObj.toString();
      }
    } catch (error) {
      console.warn('解析下一页URL失败:', error);
    }

    return null;
  }

  /**
   * 获取历史预测
   */
  private getHistoricalPredictions(url: string): string[] {
    // 基于历史访问模式预测
    // 这里可以实现更复杂的预测算法
    return [];
  }

  /**
   * 预取资源
   */
  private async prefetchResource(url: string): Promise<void> {
    this.totalPrefetchAttempts++;

    try {
      // 使用较低的优先级预取
      await this.get(url, { priority: 'low' });
      this.successfulPrefetches++;
    } catch (error) {
      console.debug(`预取失败: ${url}`, error);
    } finally {
      this.prefetchQueue.delete(url);
    }
  }

  /**
   * 计算优先级
   */
  private calculatePriority(url: string, data: any): 'low' | 'medium' | 'high' {
    // 基于URL模式和数据大小计算优先级
    const size = this.estimateDataSize(data);
    const urlPattern = this.analyzeUrlPattern(url);

    if (urlPattern.hasPagination) return 'medium';
    if (size > 1024 * 1024) return 'low'; // 大文件低优先级
    if (url.includes('static') || url.includes('assets')) return 'low';

    return 'high';
  }

  /**
   * 估算数据大小
   */
  private estimateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // UTF-16编码
    } catch {
      return 1024; // 默认1KB
    }
  }

  /**
   * 内存管理
   */
  private manageMemoryUsage(): void {
    if (this.metrics.memoryUsage <= this.config.maxMemorySize) return;

    // LRU清理策略
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = entries.slice(0, Math.floor(entries.length * 0.2)); // 清理20%
    toRemove.forEach(([url]) => {
      this.memoryCache.delete(url);
    });

    this.updateMetrics();
  }

  /**
   * 加载磁盘缓存
   */
  private async loadDiskCache(): Promise<void> {
    try {
      // 清理过期缓存
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));

      cacheKeys.forEach(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const entry = JSON.parse(cached);
            if (Date.now() - entry.timestamp > entry.ttl) {
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('加载磁盘缓存失败:', error);
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(responseTime?: number, isCacheHit?: boolean): void {
    if (responseTime !== undefined) {
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) /
        this.metrics.totalRequests;
    }

    this.metrics.hitRate = this.metrics.totalRequests > 0
      ? this.metrics.cacheHits / this.metrics.totalRequests
      : 0;

    this.metrics.missRate = 1 - this.metrics.hitRate;

    this.metrics.prefetchAccuracy = this.totalPrefetchAttempts > 0
      ? this.successfulPrefetches / this.totalPrefetchAttempts
      : 0;

    // 更新内存使用
    this.metrics.memoryUsage = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    // 更新磁盘使用（简化计算）
    this.metrics.diskUsage = Object.keys(localStorage)
      .filter(key => key.startsWith('cache_'))
      .reduce((sum, key) => sum + (localStorage.getItem(key)?.length || 0) * 2, 0);
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(url: string): string {
    return `cache_${btoa(url).replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  /**
   * 开始维护任务
   */
  private startMaintenance(): void {
    // 定期清理过期缓存
    setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次

    // 定期更新指标
    setInterval(() => {
      this.updateMetrics();
    }, 5000); // 每5秒更新指标
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();

    // 清理内存缓存
    this.memoryCache.forEach((entry, url) => {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(url);
      }
    });

    // 清理磁盘缓存
    if (this.config.cacheLevels.disk) {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_')) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const entry = JSON.parse(cached);
              if (now - entry.timestamp > entry.ttl) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            localStorage.removeItem(key);
          }
        }
      });
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    memoryEntries: number;
    diskEntries: number;
    pendingRequests: number;
    prefetchQueue: number;
    retryQueue: number;
  } {
    const diskEntries = Object.keys(localStorage)
      .filter(key => key.startsWith('cache_')).length;

    return {
      memoryEntries: this.memoryCache.size,
      diskEntries,
      pendingRequests: this.pendingRequests.size,
      prefetchQueue: this.prefetchQueue.size,
      retryQueue: this.retryQueue.length
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.memoryCache.clear();
    this.pendingRequests.clear();
    this.prefetchQueue.clear();
    this.retryQueue.length = 0;

    // 清理磁盘缓存
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });

    this.resetMetrics();
  }

  /**
   * 重置指标
   */
  private resetMetrics(): void {
    this.metrics = {
      memoryUsage: 0,
      diskUsage: 0,
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      retryCount: 0,
      prefetchAccuracy: 0
    };
    this.totalPrefetchAttempts = 0;
    this.successfulPrefetches = 0;
  }

  /**
   * 预热缓存
   */
  async warmupCache(urls: string[]): Promise<void> {
    const promises = urls.map(url => this.get(url).catch(error => {
      console.warn(`预热缓存失败: ${url}`, error);
    }));

    await Promise.all(promises);
  }

  /**
   * 强制预取
   */
  async forcePrefetch(url: string): Promise<void> {
    await this.prefetchResource(url);
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 默认配置
export const defaultCacheConfig: CacheConfig = {
  maxMemorySize: 50 * 1024 * 1024, // 50MB
  maxDiskSize: 200 * 1024 * 1024, // 200MB
  defaultTTL: 30 * 60 * 1000, // 30分钟
  enableCompression: true,
  enablePredictivePrefetch: true,
  enableSmartRetry: true,
  retryAttempts: 3,
  retryDelay: 1000,
  cacheLevels: {
    memory: true,
    disk: true,
    network: true
  }
};

// 创建缓存实例
export function createNetworkCache(
  fetchFn: (url: string, options?: RequestInit) => Promise<any>,
  config: Partial<CacheConfig> = {}
): IntelligentNetworkCache {
  return new IntelligentNetworkCache(
    { ...defaultCacheConfig, ...config },
    fetchFn
  );
}