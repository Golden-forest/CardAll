/**
 * 智能链接截断工具函数
 * 根据屏幕尺寸和容器宽度动态计算截断长度
 */

export interface LinkTruncationOptions {
  maxLength?: number
  maxLengthMobile?: number
  maxLengthDesktop?: number
  showEllipsis?: boolean
  preserveDomain?: boolean
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: LinkTruncationOptions = {
  maxLength: 50,
  maxLengthMobile: 25,
  maxLengthDesktop: 45,
  showEllipsis: true,
  preserveDomain: true
}

// 性能优化：缓存计算结果
const urlCache = new Map<string, ReturnType<typeof parseUrl>>()
const linkTruncationCache = new Map<string, string>()
const screenCache = {
  isMobile: false,
  lastCheck: 0,
  debounceTime: 100
}

// 性能优化：预编译正则表达式
const URL_REGEX = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/g
const LINK_REGEX = /<a\s+href=/i

// 导入React hooks（仅在客户端使用）
import { useState, useEffect, useCallback } from 'react'

/**
 * 检查是否为移动端（性能优化：带缓存和防抖）
 * @returns boolean - 是否为移动端
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false

  const now = Date.now()
  // 防抖：减少频繁的窗口尺寸检查
  if (now - screenCache.lastCheck < screenCache.debounceTime) {
    return screenCache.isMobile
  }

  screenCache.isMobile = window.innerWidth < 768
  screenCache.lastCheck = now
  return screenCache.isMobile
}

/**
 * 获取当前屏幕尺寸下的最大长度
 * @param options - 配置选项
 * @returns number - 最大长度
 */
export function getMaxLengthForScreen(options: LinkTruncationOptions = {}): number {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (isMobile()) {
    return opts.maxLengthMobile || opts.maxLength || DEFAULT_OPTIONS.maxLengthMobile!
  }

  return opts.maxLengthDesktop || opts.maxLength || DEFAULT_OPTIONS.maxLengthDesktop!
}

/**
 * 解析URL，获取域名、路径等信息（性能优化：带缓存）
 * @param url - URL字符串
 * @returns object - 解析后的URL信息
 */
export function parseUrl(url: string): {
  protocol: string
  hostname: string
  pathname: string
  search: string
  hash: string
  origin: string
} {
  // 缓存检查：避免重复解析相同的URL
  if (urlCache.has(url)) {
    return urlCache.get(url)!
  }

  try {
    // 确保URL有协议前缀，否则parse会失败
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
    const parsed = new URL(urlWithProtocol)

    const result = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      origin: parsed.origin
    }

    // 缓存结果（限制缓存大小防止内存泄漏）
    if (urlCache.size < 1000) {
      urlCache.set(url, result)
    }

    return result
  } catch (error) {
    // 如果URL解析失败，返回默认值
    const fallbackResult = {
      protocol: 'https:',
      hostname: url,
      pathname: '',
      search: '',
      hash: '',
      origin: url
    }

    // 缓存失败结果
    if (urlCache.size < 1000) {
      urlCache.set(url, fallbackResult)
    }

    return fallbackResult
  }
}

/**
 * 智能截断链接（性能优化：带缓存）
 * @param url - 原始URL
 * @param options - 截断选项
 * @returns string - 截断后的URL
 */
export function truncateLink(url: string, options: LinkTruncationOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const maxLength = getMaxLengthForScreen(opts)

  if (!url || url.length <= maxLength) {
    return url
  }

  // 创建缓存键，包含URL和所有影响结果的参数
  const cacheKey = `${url}|${maxLength}|${opts.showEllipsis}|${opts.preserveDomain}`

  // 缓存检查
  if (linkTruncationCache.has(cacheKey)) {
    return linkTruncationCache.get(cacheKey)!
  }

  const urlInfo = parseUrl(url)
  let result: string

  if (opts.preserveDomain) {
    // 保留域名，截断路径
    const domain = urlInfo.hostname
    const rest = url.replace(urlInfo.origin, '')

    if (domain.length >= maxLength) {
      // 域名本身就太长，直接截断
      result = truncateString(domain, maxLength, opts.showEllipsis)
    } else {
      const remainingLength = maxLength - domain.length
      if (remainingLength > 3) {
        result = domain + truncateString(rest, remainingLength, opts.showEllipsis)
      } else {
        // 剩余长度不够，只显示域名
        result = truncateString(domain, maxLength, opts.showEllipsis)
      }
    }
  } else {
    // 直接截断整个URL
    result = truncateString(url, maxLength, opts.showEllipsis)
  }

  // 缓存结果（限制缓存大小防止内存泄漏）
  if (linkTruncationCache.size < 2000) {
    linkTruncationCache.set(cacheKey, result)
  }

  return result
}

/**
 * 简单字符串截断
 * @param str - 原始字符串
 * @param maxLength - 最大长度
 * @param showEllipsis - 是否显示省略号
 * @returns string - 截断后的字符串
 */
export function truncateString(str: string, maxLength: number, showEllipsis: boolean = true): string {
  if (!str || str.length <= maxLength) {
    return str
  }

  if (showEllipsis && maxLength > 3) {
    return str.substring(0, maxLength - 3) + '...'
  } else if (showEllipsis && maxLength <= 3) {
    return '.'.repeat(maxLength)
  } else {
    return str.substring(0, maxLength)
  }
}

/**
 * 处理HTML内容中的链接，自动截断长链接（性能优化版）
 * @param htmlContent - HTML内容
 * @param options - 截断选项
 * @returns string - 处理后的HTML内容
 */
export function processLinksInHtml(htmlContent: string, options: LinkTruncationOptions = {}): string {
  if (!htmlContent) return htmlContent

  // 性能优化：预计算最大长度，避免重复计算
  const maxLength = getMaxLengthForScreen(options)

  // 性能优化：检查是否需要处理，避免不必要的DOM操作
  if (!LINK_REGEX.test(htmlContent)) {
    return htmlContent
  }

  let result = htmlContent

  // 性能优化：使用轻量级字符串处理替代DOM操作（适用于简单情况）
  if (htmlContent.includes('<a href=')) {
    try {
      // 创建一个临时DOM元素来解析HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent

      // 查找所有链接
      const links = tempDiv.querySelectorAll('a')

      // 批量处理优化：预先收集所有需要修改的链接
      const linksToProcess: Array<{
        element: HTMLAnchorElement
        href: string | null
        textContent: string
        newText: string
      }> = []

      // 收集需要处理的链接
      links.forEach(link => {
        const href = link.getAttribute('href')
        const textContent = link.textContent || ''

        let newText = textContent
        let shouldProcess = false

        if (href && textContent === href) {
          // 如果链接文本就是URL本身，进行截断
          newText = truncateLink(href, options)
          shouldProcess = true
        } else if (textContent.length > maxLength) {
          // 如果链接文本太长，进行截断
          newText = truncateString(textContent, maxLength, options.showEllipsis!)
          shouldProcess = true
        }

        if (shouldProcess && newText !== textContent) {
          linksToProcess.push({
            element: link,
            href,
            textContent,
            newText
          })
        }
      })

      // 批量应用修改，减少DOM重排
      linksToProcess.forEach(({ element, newText }) => {
        element.textContent = newText
      })

      result = tempDiv.innerHTML
    } catch (error) {
      console.warn('Error processing HTML links:', error)
      // 降级处理：返回原始内容
      return htmlContent
    }
  }

  return result
}

/**
 * 清理缓存，防止内存泄漏
 * 可以在页面卸载或内存压力大时调用
 */
export function clearLinkTruncationCache(): void {
  urlCache.clear()
  linkTruncationCache.clear()
  screenCache.lastCheck = 0
}

/**
 * 获取缓存统计信息，用于性能监控
 */
export function getCacheStats() {
  return {
    urlCache: {
      size: urlCache.size,
      maxSize: 1000
    },
    linkTruncationCache: {
      size: linkTruncationCache.size,
      maxSize: 2000
    },
    screenCache: {
      lastCheck: screenCache.lastCheck,
      isMobile: screenCache.isMobile
    }
  }
}

/**
 * React Hook for link truncation（性能优化版）
 * @param options - 截断选项
 * @returns object - 截断工具函数
 */
export function useLinkTruncation(options: LinkTruncationOptions = {}) {
  const [isMobileView, setIsMobileView] = useState(() => isMobile())

  useEffect(() => {
    // 性能优化：使用防抖的resize事件处理
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setIsMobileView(isMobile())
      }, 150) // 150ms防抖延迟
    }

    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // 性能优化：使用useCallback缓存函数
  const truncateLinkCallback = useCallback((url: string, customOptions?: LinkTruncationOptions) => {
    return truncateLink(url, { ...options, ...customOptions })
  }, [options])

  const truncateStringCallback = useCallback((str: string, maxLength?: number, showEllipsis?: boolean) => {
    return truncateString(str, maxLength || getMaxLengthForScreen(options), showEllipsis)
  }, [options])

  const processLinksInHtmlCallback = useCallback((html: string, customOptions?: LinkTruncationOptions) => {
    return processLinksInHtml(html, { ...options, ...customOptions })
  }, [options])

  const getMaxLengthCallback = useCallback(() => {
    return getMaxLengthForScreen(options)
  }, [options])

  return {
    truncateLink: truncateLinkCallback,
    truncateString: truncateStringCallback,
    processLinksInHtml: processLinksInHtmlCallback,
    isMobile: isMobileView,
    getMaxLength: getMaxLengthCallback,
    clearCache: clearLinkTruncationCache,
    getCacheStats
  }
}