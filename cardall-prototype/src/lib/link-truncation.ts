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

/**
 * 检查是否为移动端
 * @returns boolean - 是否为移动端
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
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
 * 解析URL，获取域名、路径等信息
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
  try {
    // 确保URL有协议前缀，否则parse会失败
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
    const parsed = new URL(urlWithProtocol)

    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      origin: parsed.origin
    }
  } catch (error) {
    // 如果URL解析失败，返回默认值
    return {
      protocol: 'https:',
      hostname: url,
      pathname: '',
      search: '',
      hash: '',
      origin: url
    }
  }
}

/**
 * 智能截断链接
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

  const urlInfo = parseUrl(url)

  if (opts.preserveDomain) {
    // 保留域名，截断路径
    const domain = urlInfo.hostname
    const rest = url.replace(urlInfo.origin, '')

    if (domain.length >= maxLength) {
      // 域名本身就太长，直接截断
      return truncateString(domain, maxLength, opts.showEllipsis)
    }

    const remainingLength = maxLength - domain.length
    if (remainingLength > 3) {
      return domain + truncateString(rest, remainingLength, opts.showEllipsis)
    } else {
      // 剩余长度不够，只显示域名
      return truncateString(domain, maxLength, opts.showEllipsis)
    }
  } else {
    // 直接截断整个URL
    return truncateString(url, maxLength, opts.showEllipsis)
  }
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
 * 处理HTML内容中的链接，自动截断长链接
 * @param htmlContent - HTML内容
 * @param options - 截断选项
 * @returns string - 处理后的HTML内容
 */
export function processLinksInHtml(htmlContent: string, options: LinkTruncationOptions = {}): string {
  if (!htmlContent) return htmlContent

  // 创建一个临时DOM元素来解析HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent

  // 查找所有链接
  const links = tempDiv.querySelectorAll('a')

  links.forEach(link => {
    const href = link.getAttribute('href')
    const textContent = link.textContent || ''

    if (href && textContent === href) {
      // 如果链接文本就是URL本身，进行截断
      const truncatedText = truncateLink(href, options)
      link.textContent = truncatedText
    } else if (textContent && textContent.length > getMaxLengthForScreen(options)) {
      // 如果链接文本太长，进行截断
      const truncatedText = truncateString(textContent, getMaxLengthForScreen(options), options.showEllipsis)
      link.textContent = truncatedText
    }
  })

  return tempDiv.innerHTML
}

/**
 * React Hook for link truncation
 * @param options - 截断选项
 * @returns object - 截断工具函数
 */
export function useLinkTruncation(options: LinkTruncationOptions = {}) {
  const [isMobileView, setIsMobileView] = useState(() => isMobile())

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(isMobile())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    truncateLink: (url: string, customOptions?: LinkTruncationOptions) =>
      truncateLink(url, { ...options, ...customOptions }),
    truncateString: (str: string, maxLength?: number, showEllipsis?: boolean) =>
      truncateString(str, maxLength || getMaxLengthForScreen(options), showEllipsis),
    processLinksInHtml: (html: string, customOptions?: LinkTruncationOptions) =>
      processLinksInHtml(html, { ...options, ...customOptions }),
    isMobile: isMobileView,
    getMaxLength: () => getMaxLengthForScreen(options)
  }
}

// 导入React hooks（仅在客户端使用）
import { useState, useEffect } from 'react'