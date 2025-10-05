import { domToPng } from 'modern-screenshot'

/**
 * 清理文件名，移除特殊字符，保留空格
 * @param title 原始标题
 * @param maxLength 最大长度，默认30
 * @returns 清理后的文件名
 */
export function sanitizeFileName(title: string, maxLength: number = 30): string {
  if (!title || title.trim() === '') {
    return 'untitled-card'
  }
  
  // 移除特殊字符，保留中文、英文、数字、空格、连字符、下划线
  let cleanTitle = title
    .replace(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\uf900-\ufaff\u3300-\u33ff-]/g, '')
    .replace(/\s+/g, ' ') // 将多个空格替换为单个空格
    .trim()
  
  // 如果清理后为空，使用默认名称
  if (!cleanTitle) {
    return 'untitled-card'
  }
  
  // 截取指定长度
  if (cleanTitle.length > maxLength) {
    cleanTitle = cleanTitle.substring(0, maxLength).trim()
  }
  
  return cleanTitle
}

/**
 * 截图配置选项
 */
export interface ScreenshotOptions {
  /** 输出质量，默认1.0 */
  quality?: number
  /** 像素比，默认2（高清） */
  pixelRatio?: number
  /** 背景色，默认透明 */
  backgroundColor?: string
  /** 是否包含样式，默认true */
  includeStyles?: boolean
}

/**
 * 截图元素并返回blob
 * @param element 要截图的DOM元素
 * @param options 截图选项
 * @returns Promise<Blob>
 */
export async function captureElementAsBlob(
  element: HTMLElement, 
  options: ScreenshotOptions = {}
): Promise<Blob> {
  const {
    quality = 1.0,
    pixelRatio = 2,
    backgroundColor = 'transparent',
    includeStyles = true
  } = options

  try {
    // 使用 modern-screenshot 进行截图
    const dataUrl = await domToPng(element, {
      quality,
      pixelRatio,
      backgroundColor,
      style: includeStyles ? undefined : {},
      // 确保截图包含所有样式和阴影
      filter: (node) => {
        // 排除一些不需要的元素，比如工具提示、下拉菜单等
        if (node instanceof HTMLElement) {
          const classList = node.classList
          return !classList.contains('tooltip') && 
                 !classList.contains('dropdown-menu') &&
                 !classList.contains('popover')
        }
        return true
      }
    })

    // 将 data URL 转换为 Blob
    const response = await fetch(dataUrl)
    return await response.blob()
  } catch (error) {
    console.error('Screenshot capture failed:', error)
    throw new Error('Failed to capture screenshot')
  }
}

/**
 * 下载blob为文件
 * @param blob 文件blob
 * @param fileName 文件名（不含扩展名）
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.png`
  
  // 触发下载
  document.body.appendChild(link)
  link.click()
  
  // 清理
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 截图卡片元素
 * @param cardElement 卡片DOM元素
 * @param cardTitle 卡片标题
 * @param options 截图选项
 * @returns Promise<{ blob: Blob, fileName: string }>
 */
export async function screenshotCard(
  cardElement: HTMLElement,
  cardTitle: string,
  options: ScreenshotOptions = {}
): Promise<{ blob: Blob, fileName: string }> {
  const fileName = sanitizeFileName(cardTitle)
  const blob = await captureElementAsBlob(cardElement, {
    quality: 1.0,
    pixelRatio: 2,
    backgroundColor: 'transparent',
    ...options
  })
  
  return { blob, fileName }
}