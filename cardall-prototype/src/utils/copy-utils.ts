/**
 * 复制功能相关的工具函数
 */

/**
 * 清理HTML标签，提取纯文本内容，保持换行格式
 * @param html HTML字符串
 * @returns 纯文本字符串，保持原有换行
 */
export function stripHtmlTags(html: string): string {
  if (!html) return ''
  
  try {
    // 使用DOMParser解析HTML
    const doc = new DOMParser().parseFromString(html, 'text/html')
    
    // 移除所有图片标签
    const images = doc.querySelectorAll('img')
    images.forEach(img => img.remove())
    
    // 在提取文本之前，先处理换行相关的HTML元素
    // 将 <br> 标签替换为换行符
    const brElements = doc.querySelectorAll('br')
    brElements.forEach(br => {
      br.replaceWith('\n')
    })
    
    // 将块级元素（p, div, h1-h6等）的结束标签替换为换行符
    const blockElements = doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote')
    blockElements.forEach(element => {
      // 在元素后添加换行符
      element.insertAdjacentText('afterend', '\n')
    })
    
    // 获取纯文本内容
    let textContent = doc.body.textContent || doc.body.innerText || ''
    
    // 清理多余的空白字符，但保持换行
    textContent = textContent
      .replace(/[ \t]+/g, ' ') // 将多个空格和制表符替换为单个空格
      .replace(/[ \t]*\n[ \t]*/g, '\n') // 清理换行符前后的空格
      .replace(/\n{3,}/g, '\n\n') // 将3个或更多连续换行替换为2个换行
      .trim()
    
    return textContent
  } catch (error) {
    console.warn('Failed to parse HTML, falling back to regex cleanup:', error)
    
    // 降级处理：使用正则表达式清理HTML标签，保持换行
    return html
      .replace(/<img[^>]*>/gi, '') // 移除图片标签
      .replace(/<br\s*\/?>/gi, '\n') // 将 <br> 替换为换行符
      .replace(/<\/?(p|div|h[1-6]|li|blockquote)[^>]*>/gi, '\n') // 将块级元素替换为换行符
      .replace(/<[^>]*>/g, '') // 移除剩余的HTML标签
      .replace(/&nbsp;/g, ' ') // 替换HTML实体
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ') // 清理多余空格
      .replace(/[ \t]*\n[ \t]*/g, '\n') // 清理换行符前后的空格
      .replace(/\n{3,}/g, '\n\n') // 限制连续换行
      .trim()
  }
}

/**
 * 格式化卡片内容为复制文本
 * @param title 卡片标题
 * @param htmlContent 卡片HTML内容
 * @returns 格式化的纯文本
 */
export function formatCardContentForCopy(title: string, htmlContent: string): string {
  const cleanTitle = stripHtmlTags(title)
  const cleanContent = stripHtmlTags(htmlContent)
  
  // 使用当前格式：标题\n\n内容
  return `${cleanTitle}\n\n${cleanContent}`
}

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<boolean> 复制是否成功
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // 使用现代剪贴板API
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // 降级处理：使用传统方法
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      return successful
    }
  } catch (error) {
    console.error('Failed to copy text to clipboard:', error)
    return false
  }
}