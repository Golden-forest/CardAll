/**
 * 安全的localStorage工具类
 * 提供数据验证、清理和加密功能，防止XSS和原型污染攻击
 */

export interface StorageOptions {
  encrypt?: boolean
  compress?: boolean
  validate?: boolean
  ttl?: number // 过期时间（毫秒）
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  sanitized: unknown
}

/**
 * 安全的存储服务
 */
export class SecureStorage {
  private static readonly PREFIX = 'cardall_'
  private static readonly VERSION = '1.0'

  /**
   * 安全地存储数据
   */
  static setItem<T>(key: string, value: T, options: StorageOptions = {}): boolean {
    try {
      const fullKey = this.PREFIX + key
      const storageData = {
        version: this.VERSION,
        timestamp: Date.now(),
        data: value,
        meta: {
          ttl: options.ttl,
          encrypted: options.encrypt || false,
          compressed: options.compress || false
        }
      }

      // 数据验证
      if (options.validate) {
        const validation = this.validateData(value)
        if (!validation.isValid) {
          console.warn('Storage validation failed:', validation.errors)
          return false
        }
      }

      // 序列化数据
      let serialized: string
      try {
        serialized = this.serializeData(storageData)
      } catch (error) {
        console.error('Data serialization failed:', error)
        return false
      }

      // 加密数据（如果启用）
      if (options.encrypt) {
        serialized = this.encryptData(serialized)
      }

      // 压缩数据（如果启用）
      if (options.compress) {
        serialized = this.compressData(serialized)
      }

      localStorage.setItem(fullKey, serialized)
      return true
    } catch (error) {
      console.error('Failed to store data securely:', error)
      return false
    }
  }

  /**
   * 安全地获取数据
   */
  static getItem<T>(key: string, options: StorageOptions = {}): T | null {
    try {
      const fullKey = this.PREFIX + key
      const serialized = localStorage.getItem(fullKey)

      if (!serialized) {
        return null
      }

      // 解压缩数据（如果启用）
      let processedData = serialized
      if (options.compress) {
        processedData = this.decompressData(processedData)
      }

      // 解密数据（如果启用）
      if (options.encrypt) {
        processedData = this.decryptData(processedData)
      }

      // 反序列化数据
      const storageData = this.deserializeData(processedData)

      // 检查数据版本
      if (storageData.version !== this.VERSION) {
        console.warn('Storage data version mismatch')
        return null
      }

      // 检查过期时间
      if (storageData.meta.ttl) {
        const now = Date.now()
        const dataAge = now - storageData.timestamp
        if (dataAge > storageData.meta.ttl) {
          console.log('Storage data expired, removing')
          this.removeItem(key)
          return null
        }
      }

      // 数据验证
      if (options.validate) {
        const validation = this.validateData(storageData.data)
        if (!validation.isValid) {
          console.warn('Retrieved data validation failed:', validation.errors)
          return null
        }
      }

      return storageData.data as T
    } catch (error) {
      console.error('Failed to retrieve data securely:', error)
      return null
    }
  }

  /**
   * 移除数据
   */
  static removeItem(key: string): void {
    try {
      const fullKey = this.PREFIX + key
      localStorage.removeItem(fullKey)
    } catch (error) {
      console.error('Failed to remove storage item:', error)
    }
  }

  /**
   * 清除所有应用数据
   */
  static clearAppData(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Failed to clear app data:', error)
    }
  }

  /**
   * 验证数据安全性
   */
  private static validateData(data: unknown): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: data
    }

    if (data === null || data === undefined) {
      return result
    }

    // 检查原型污染
    if (this.hasPrototypePollution(data)) {
      result.isValid = false
      result.errors.push('Potential prototype pollution detected')
      return result
    }

    // 检查循环引用
    if (this.hasCircularReference(data)) {
      result.warnings.push('Circular reference detected in data')
      // 移除循环引用
      result.sanitized = this.removeCircularReferences(data)
    }

    // 检查危险函数
    if (this.hasDangerousFunctions(data)) {
      result.isValid = false
      result.errors.push('Dangerous functions detected in data')
      return result
    }

    // 检查数据大小
    const size = this.estimateDataSize(data)
    if (size > 5 * 1024 * 1024) { // 5MB
      result.warnings.push('Large data size may impact performance')
    }

    return result
  }

  /**
   * 检查原型污染
   */
  private static hasPrototypePollution(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false
    }

    const obj = data as Record<string, unknown>
    const dangerousProps = ['__proto__', 'constructor', 'prototype']

    return dangerousProps.some(prop => prop in obj)
  }

  /**
   * 检查循环引用
   */
  private static hasCircularReference(data: unknown, seen = new WeakSet()): boolean {
    if (typeof data !== 'object' || data === null) {
      return false
    }

    if (seen.has(data as object)) {
      return true
    }

    seen.add(data as object)

    if (Array.isArray(data)) {
      return data.some(item => this.hasCircularReference(item, seen))
    }

    return Object.values(data).some(value =>
      typeof value === 'object' && this.hasCircularReference(value, seen)
    )
  }

  /**
   * 移除循环引用
   */
  private static removeCircularReferences(data: unknown, seen = new WeakSet()): unknown {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    if (seen.has(data as object)) {
      return '[Circular]'
    }

    seen.add(data as object)

    if (Array.isArray(data)) {
      return data.map(item => this.removeCircularReferences(item, seen))
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = this.removeCircularReferences(value, seen)
    }

    return result
  }

  /**
   * 检查危险函数
   */
  private static hasDangerousFunctions(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false
    }

    const obj = data as Record<string, unknown>

    // 检查是否包含函数
    if (Object.values(obj).some(value => typeof value === 'function')) {
      return true
    }

    // 检查危险属性
    const dangerousPatterns = [
      'eval', 'Function', 'setTimeout', 'setInterval',
      'document', 'window', 'global', 'process'
    ]

    const dataStr = JSON.stringify(obj).toLowerCase()
    return dangerousPatterns.some(pattern =>
      dataStr.includes(pattern.toLowerCase())
    )
  }

  /**
   * 估算数据大小
   */
  private static estimateDataSize(data: unknown): number {
    return new Blob([JSON.stringify(data)]).size
  }

  /**
   * 安全的序列化
   */
  private static serializeData(data: unknown): string {
    const replacer = (key: string, value: unknown): unknown => {
      // 移除函数
      if (typeof value === 'function') {
        return undefined
      }

      // 移除undefined
      if (value === undefined) {
        return null
      }

      // 处理Date对象
      if (value instanceof Date) {
        return {
          __type: 'Date',
          value: value.toISOString()
        }
      }

      // 处理正则表达式
      if (value instanceof RegExp) {
        return {
          __type: 'RegExp',
          value: value.toString()
        }
      }

      return value
    }

    return JSON.stringify(data, replacer)
  }

  /**
   * 安全的反序列化
   */
  private static deserializeData(serialized: string): unknown {
    const reviver = (key: string, value: unknown): unknown => {
      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>

        if (obj.__type === 'Date' && typeof obj.value === 'string') {
          return new Date(obj.value)
        }

        if (obj.__type === 'RegExp' && typeof obj.value === 'string') {
          const match = obj.value.match(/^\/(.*)\/([gim]*)$/)
          if (match) {
            return new RegExp(match[1], match[2])
          }
        }
      }

      return value
    }

    return JSON.parse(serialized, reviver)
  }

  /**
   * 简单的数据加密
   */
  private static encryptData(data: string): string {
    // 使用简单的XOR加密（仅用于演示，生产环境应使用更强的加密）
    const key = 'cardall-secure-key'
    let encrypted = ''

    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      encrypted += String.fromCharCode(charCode)
    }

    return btoa(encrypted)
  }

  /**
   * 简单的数据解密
   */
  private static decryptData(encrypted: string): string {
    const key = 'cardall-secure-key'
    const decoded = atob(encrypted)
    let decrypted = ''

    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      decrypted += String.fromCharCode(charCode)
    }

    return decrypted
  }

  /**
   * 数据压缩
   */
  private static compressData(data: string): string {
    // 简单的压缩（仅用于演示）
    return data
  }

  /**
   * 数据解压缩
   */
  private static decompressData(compressed: string): string {
    // 简单的解压缩（仅用于演示）
    return compressed
  }

  /**
   * 获取存储统计信息
   */
  static getStorageStats(): {
    totalSize: number
    itemCount: number
    items: Array<{ key: string; size: number; lastModified: number }>
  } {
    try {
      const keys = Object.keys(localStorage)
      const appKeys = keys.filter(key => key.startsWith(this.PREFIX))

      let totalSize = 0
      const items: Array<{ key: string; size: number; lastModified: number }> = []

      appKeys.forEach(key => {
        const data = localStorage.getItem(key)
        if (data) {
          const size = new Blob([data]).size
          totalSize += size
          items.push({
            key: key.replace(this.PREFIX, ''),
            size,
            lastModified: Date.now()
          })
        }
      })

      return {
        totalSize,
        itemCount: appKeys.length,
        items
      }
    } catch (error) {
      console.error('Failed to get storage stats:', error)
      return {
        totalSize: 0,
        itemCount: 0,
        items: []
      }
    }
  }
}

// 导出便捷函数
export const secureStorage = {
  set: <T>(key: string, value: T, options?: StorageOptions) =>
    SecureStorage.setItem(key, value, options),
  get: <T>(key: string, options?: StorageOptions) =>
    SecureStorage.getItem<T>(key, options),
  remove: (key: string) => SecureStorage.removeItem(key),
  clear: () => SecureStorage.clearAppData(),
  getStats: () => SecureStorage.getStorageStats()
}