import { useState, useCallback } from 'react'
import { screenshotCard, downloadBlob } from '@/utils/screenshot-utils'

interface UseScreenshotOptions {
  onSuccess?: (fileName: string) => void
  onError?: (error: Error) => void
}

export function useScreenshot(options: UseScreenshotOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [previewData, setPreviewData] = useState<{
    blob: Blob
    fileName: string
    previewUrl: string
  } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const captureScreenshot = useCallback(async (
    cardElement: HTMLElement,
    cardTitle: string
  ) => {
    setIsCapturing(true)
    setError(null)

    try {
      // 截图
      const { blob, fileName } = await screenshotCard(cardElement, cardTitle)
      
      // 创建预览URL
      const previewUrl = URL.createObjectURL(blob)
      
      setPreviewData({ blob, fileName, previewUrl })
      setShowPreview(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Screenshot failed')
      setError(error.message)
      options.onError?.(error)
    } finally {
      setIsCapturing(false)
    }
  }, [options])

  const confirmDownload = useCallback(async () => {
    if (!previewData) return

    setIsDownloading(true)
    
    try {
      // 添加一点延迟让动画播放
      await new Promise(resolve => setTimeout(resolve, 500))
      
      downloadBlob(previewData.blob, previewData.fileName)
      options.onSuccess?.(previewData.fileName)
      
      // 关闭预览
      setShowPreview(false)
      
      // 清理预览数据
      setTimeout(() => {
        if (previewData.previewUrl) {
          URL.revokeObjectURL(previewData.previewUrl)
        }
        setPreviewData(null)
      }, 100)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Download failed')
      setError(error.message)
      options.onError?.(error)
    } finally {
      setIsDownloading(false)
    }
  }, [previewData, options])

  const cancelPreview = useCallback(() => {
    setShowPreview(false)
    
    // 清理预览数据
    setTimeout(() => {
      if (previewData?.previewUrl) {
        URL.revokeObjectURL(previewData.previewUrl)
      }
      setPreviewData(null)
    }, 100)
  }, [previewData])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // 状态
    isCapturing,
    isDownloading,
    showPreview,
    previewData,
    error,
    
    // 方法
    captureScreenshot,
    confirmDownload,
    cancelPreview,
    clearError
  }
}