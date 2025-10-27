/**
 * 批量链接处理器 - 性能优化工具
 * 用于优化大量链接同时处理时的性能
 */

import { processLinksInHtml, LinkTruncationOptions, clearLinkTruncationCache } from './link-truncation'

export interface BatchProcessOptions {
  batchSize?: number
  enableCache?: boolean
  throttleDelay?: number
  useWebWorker?: boolean
  onProgress?: (processed: number, total: number) => void
  onComplete?: (results: string[]) => void
  onError?: (error: Error, index: number) => void
}

export interface BatchProcessor {
  process(contents: string[], options?: BatchProcessOptions): Promise<string[]>
  clearCache(): void
  getStats(): {
    processedCount: number
    cacheHits: number
    averageProcessTime: number
  }
}

/**
 * 高性能批量链接处理器
 */
class HighPerformanceBatchProcessor implements BatchProcessor {
  private processCount = 0
  private cacheHits = 0
  private totalProcessTime = 0
  private cache = new Map<string, string>()
  private readonly maxCacheSize = 500

  async process(
    contents: string[],
    options: BatchProcessOptions = {}
  ): Promise<string[]> {
    const {
      batchSize = 10,
      enableCache = true,
      throttleDelay = 0,
      onProgress,
      onComplete,
      onError
    } = options

    const results: string[] = []
    const startTime = performance.now()

    try {
      // 分批处理，避免阻塞主线程
      for (let i = 0; i < contents.length; i += batchSize) {
        const batch = contents.slice(i, Math.min(i + batchSize, contents.length))

        // 并行处理当前批次
        const batchPromises = batch.map(async (content, batchIndex) => {
          const globalIndex = i + batchIndex

          try {
            const startTime = performance.now()
            let result: string

            // 缓存检查
            const cacheKey = this.generateCacheKey(content)
            if (enableCache && this.cache.has(cacheKey)) {
              result = this.cache.get(cacheKey)!
              this.cacheHits++
            } else {
              result = processLinksInHtml(content)

              // 更新缓存
              if (enableCache) {
                this.updateCache(cacheKey, result)
              }
            }

            const endTime = performance.now()
            this.totalProcessTime += (endTime - startTime)
            this.processCount++

            // 进度回调
            if (onProgress) {
              onProgress(globalIndex + 1, contents.length)
            }

            return result
          } catch (error) {
            if (onError) {
              onError(error as Error, globalIndex)
            }
            console.warn(`Error processing content at index ${globalIndex}:`, error)
            return content // 返回原始内容作为降级处理
          }
        })

        // 等待当前批次完成
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        // 节流处理，避免阻塞UI
        if (throttleDelay > 0 && i + batchSize < contents.length) {
          await this.throttle(throttleDelay)
        }
      }

      const totalTime = performance.now() - startTime

      if (onComplete) {
        onComplete(results)
      }

      return results
    } catch (error) {
      console.error('Batch processing failed:', error)
      throw error
    }
  }

  private generateCacheKey(content: string): string {
    // 使用简单的哈希函数生成缓存键
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return hash.toString(36)
  }

  private updateCache(key: string, value: string): void {
    // LRU缓存管理
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  private throttle(delay: number): Promise<void> {
    return new Promise(resolve => {
      const channel = new MessageChannel()
      channel.port2.onmessage = () => resolve()
      channel.port1.postMessage(null)

      // 使用setTimeout作为降级方案
      setTimeout(() => {
        channel.port1.close()
        channel.port2.close()
        resolve()
      }, delay)
    })
  }

  clearCache(): void {
    this.cache.clear()
    clearLinkTruncationCache()
    this.processCount = 0
    this.cacheHits = 0
    this.totalProcessTime = 0
  }

  getStats() {
    return {
      processedCount: this.processCount,
      cacheHits: this.cacheHits,
      averageProcessTime: this.processCount > 0 ? this.totalProcessTime / this.processCount : 0
    }
  }
}

/**
 * Web Worker批量处理器（用于非常大的数据集）
 */
export class WebWorkerBatchProcessor implements BatchProcessor {
  private worker: Worker | null = null
  private processCount = 0
  private cacheHits = 0
  private totalProcessTime = 0

  constructor() {
    this.initWorker()
  }

  private initWorker(): void {
    try {
      // 创建内联Worker代码
      const workerCode = `
        self.onmessage = function(e) {
          const { id, content, options } = e.data

          try {
            // 简化的链接处理逻辑（Worker中无法访问完整DOM）
            const result = content.replace(
              /(https?:\\/\\/[^\\s<>"]+|www\\.[^\\s<>"]+)/g,
              '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>'
            )

            self.postMessage({ id, result, success: true })
          } catch (error) {
            self.postMessage({ id, error: error.message, success: false })
          }
        }
      `

      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      this.worker = new Worker(workerUrl)
    } catch (error) {
      console.warn('Web Worker initialization failed, falling back to main thread:', error)
      this.worker = null
    }
  }

  async process(
    contents: string[],
    options: BatchProcessOptions = {}
  ): Promise<string[]> {
    const { batchSize = 5, onProgress, onComplete } = options

    if (!this.worker) {
      // 降级到主线程处理
      const fallbackProcessor = new HighPerformanceBatchProcessor()
      return fallbackProcessor.process(contents, options)
    }

    return new Promise((resolve, reject) => {
      const results: string[] = []
      let completed = 0
      const startTime = performance.now()

      const handleMessage = (e: MessageEvent) => {
        const { id, result, error, success } = e.data

        if (success) {
          results[id] = result
          this.processCount++
        } else {
          console.error(`Worker error for item ${id}:`, error)
          results[id] = contents[id] // 降级处理
        }

        completed++

        if (onProgress) {
          onProgress(completed, contents.length)
        }

        if (completed === contents.length) {
          this.worker!.removeEventListener('message', handleMessage)

          const totalTime = performance.now() - startTime
          this.totalProcessTime += totalTime

          if (onComplete) {
            onComplete(results)
          }

          resolve(results)
        }
      }

      this.worker.addEventListener('message', handleMessage)

      // 分批发送到Worker
      for (let i = 0; i < contents.length; i += batchSize) {
        const batch = contents.slice(i, Math.min(i + batchSize, contents.length))

        setTimeout(() => {
          batch.forEach((content, batchIndex) => {
            const globalIndex = i + batchIndex
            this.worker!.postMessage({
              id: globalIndex,
              content,
              options
            })
          })
        }, (i / batchSize) * 10) // 轻微的延迟以避免阻塞
      }
    })
  }

  clearCache(): void {
    this.processCount = 0
    this.cacheHits = 0
    this.totalProcessTime = 0
  }

  getStats() {
    return {
      processedCount: this.processCount,
      cacheHits: this.cacheHits,
      averageProcessTime: this.processCount > 0 ? this.totalProcessTime / this.processCount : 0
    }
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

/**
 * 智能批量处理器 - 根据数据量自动选择最佳处理策略
 */
export class SmartBatchProcessor implements BatchProcessor {
  private mainThreadProcessor: HighPerformanceBatchProcessor
  private webWorkerProcessor: WebWorkerBatchProcessor | null = null

  constructor() {
    this.mainThreadProcessor = new HighPerformanceBatchProcessor()

    // 只在支持的浏览器中初始化Web Worker
    if (typeof Worker !== 'undefined' && typeof URL !== 'undefined') {
      try {
        this.webWorkerProcessor = new WebWorkerBatchProcessor()
      } catch (error) {
        console.warn('Web Worker not available:', error)
      }
    }
  }

  async process(
    contents: string[],
    options: BatchProcessOptions = {}
  ): Promise<string[]> {
    // 智能选择处理策略
    const shouldUseWebWorker =
      this.webWorkerProcessor &&
      contents.length > 20 &&
      !options.useWebWorker?.false

    if (shouldUseWebWorker) {
      console.log(`Using Web Worker for ${contents.length} items`)
      return this.webWorkerProcessor!.process(contents, options)
    } else {
      console.log(`Using main thread for ${contents.length} items`)
      return this.mainThreadProcessor.process(contents, options)
    }
  }

  clearCache(): void {
    this.mainThreadProcessor.clearCache()
    this.webWorkerProcessor?.clearCache()
  }

  getStats() {
    const mainThreadStats = this.mainThreadProcessor.getStats()
    const webWorkerStats = this.webWorkerProcessor?.getStats() || {
      processedCount: 0,
      cacheHits: 0,
      averageProcessTime: 0
    }

    return {
      processedCount: mainThreadStats.processedCount + webWorkerStats.processedCount,
      cacheHits: mainThreadStats.cacheHits + webWorkerStats.cacheHits,
      averageProcessTime: mainThreadStats.processedCount > 0 || webWorkerStats.processedCount > 0
        ? (mainThreadStats.averageProcessTime + webWorkerStats.averageProcessTime) / 2
        : 0
    }
  }

  destroy(): void {
    this.webWorkerProcessor?.destroy()
  }
}

// 导出单例实例
export const batchLinkProcessor = new SmartBatchProcessor()

// 便捷函数
export async function processMultipleLinks(
  contents: string[],
  options?: BatchProcessOptions
): Promise<string[]> {
  return batchLinkProcessor.process(contents, options)
}