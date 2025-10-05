import { fileSystemService } from './file-system-simple'

export interface ImageFilePaths {
  filePaths: {
    original: string
    webp: string
    thumbnail: string
  }
}

export interface ImageProcessingOptions {
  quality: number
  maxWidth: number
  maxHeight: number
  thumbnailSize: number
  format: 'webp' | 'jpeg' | 'png'
}

export interface ProcessedImageResult {
  success: boolean
  originalUrl: string
  webpUrl?: string
  thumbnailUrl?: string
  error?: string
}

export class ImageProcessorService {
  private defaultOptions: ImageProcessingOptions = {
    quality: 0.8,
    maxWidth: 1920,
    maxHeight: 1080,
    thumbnailSize: 200,
    format: 'webp'
  }

  // 处理单个图片文件
  async processImage(
    file: File,
    cardId: string,
    folderId?: string,
    options?: Partial<ImageProcessingOptions>
  ): Promise<ProcessedImageResult> {
    const opts = { ...this.defaultOptions, ...options }

    try {
      // 1. 创建图片元素
      const img = await this.createImageFromFile(file)

      // 2. 计算目标尺寸
      const { width, height } = this.calculateTargetSize(
        img.width,
        img.height,
        opts.maxWidth,
        opts.maxHeight
      )

      // 3. 生成WebP格式的主图片
      const webpBlob = await this.convertToWebP(img, width, height, opts.quality)

      // 4. 生成缩略图
      const thumbnailBlob = await this.generateThumbnail(img, opts.thumbnailSize)

      // 5. 生成唯一ID和文件路径
      const imageId = this.generateImageId()
      const filePaths = this.generateFilePaths(imageId, cardId, folderId)

      // 6. 保存文件到文件系统
      await this.saveImageFiles(webpBlob, thumbnailBlob, filePaths)

      // 7. 返回处理结果
      return {
        success: true,
        originalUrl: URL.createObjectURL(file),
        webpUrl: URL.createObjectURL(webpBlob),
        thumbnailUrl: URL.createObjectURL(thumbnailBlob),
        id: imageId,
        filePaths,
        metadata: {
          originalName: file.name,
          originalSize: file.size,
          processedSize: webpBlob.size,
          thumbnailSize: thumbnailBlob.size,
          width,
          height,
          format: opts.format,
          quality: opts.quality
        }
      }
    } catch (error) {
      console.error("图片处理失败:", error)
      return {
        success: false,
        originalUrl: URL.createObjectURL(file),
        error: error instanceof Error ? error.message : "未知错误"
      }
    }
  }

  // 批量处理图片
  async processImages(
    files: File[],
    cardId: string,
    folderId?: string,
    options?: Partial<ImageProcessingOptions>
  ): Promise<ProcessedImageResult[]> {
    const results: ProcessedImageResult[] = []

    for (const file of files) {
      try {
        const result = await this.processImage(file, cardId, folderId, options)
        results.push(result)
      } catch (error) {
        console.error("批量处理图片失败:", error)
        results.push({
          success: false,
          originalUrl: URL.createObjectURL(file),
          error: error instanceof Error ? error.message : "未知错误"
        })
      }
    }

    return results
  }

  // 从文件创建图片元素
  private createImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('无法加载图片文件'))
      }

      img.src = url
    })
  }

  // 计算目标尺寸（保持宽高比）
  private calculateTargetSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight }

    // 如果图片尺寸超过最大限制,按比例缩放
    if (width > maxWidth || height > maxHeight) {
      const widthRatio = maxWidth / width
      const heightRatio = maxHeight / height

      const ratio = Math.min(widthRatio, heightRatio)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    return { width, height }
  }

  // 转换为WebP格式
  private async convertToWebP(
    img: HTMLImageElement,
    width: number,
    height: number,
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('WebP转换失败'))
          }
        },
        'image/webp',
        quality
      )
    })
  }

  // 生成缩略图
  private async generateThumbnail(
    img: HTMLImageElement,
    size: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const { width, height } = this.calculateThumbnailSize(img.width, img.height, size)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('缩略图生成失败'))
          }
        },
        'image/webp',
        0.8
      )
    })
  }

  // 计算缩略图尺寸
  private calculateThumbnailSize(
    originalWidth: number,
    originalHeight: number,
    targetSize: number
  ): { width: number; height: number } {
    const ratio = Math.min(targetSize / originalWidth, targetSize / originalHeight)
    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    }
  }

  // 生成图片ID
  private generateImageId(): string {
    return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  // 生成文件路径
  private generateFilePaths(imageId: string, cardId: string, folderId?: string): {
    original: string
    webp: string
    thumbnail: string
  } {
    const basePath = folderId
      ? 'images/' + folderId + '/' + cardId
      : 'images/uncategorized/' + cardId

    return {
      original: basePath + '/' + imageId + '_original.webp',
      webp: basePath + '/' + imageId + '.webp',
      thumbnail: basePath + '/thumbnails/' + imageId + '_thumb.webp'
    }
  }

  // 保存图片文件
  private async saveImageFiles(
    webpBlob: Blob,
    thumbnailBlob: Blob,
    filePaths: { webp: string; thumbnail: string }
  ): Promise<void> {
    try {
      // 保存主图片
      await fileSystemService.saveFile(filePaths.webp, webpBlob)

      // 保存缩略图
      await fileSystemService.saveFile(filePaths.thumbnail, thumbnailBlob)
    } catch (error) {
      console.error("保存图片失败:", error)
      throw error
    }
  }

  // 删除图片文件
  async deleteImageFiles(filePaths: { webp: string; thumbnail: string }): Promise<void> {
    try {
      await Promise.all([
        fileSystemService.deleteFile(filePaths.webp),
        fileSystemService.deleteFile(filePaths.thumbnail)
      ])
    } catch (error) {
      console.error("删除图片失败:", error)
      throw error
    }
  }

  // 获取图片URL（用于显示）
  async getImageUrl(filePath: string): Promise<string> {
    try {
      const blob = await fileSystemService.getFile(filePath)
      return URL.createObjectURL(blob)
    } catch (error) {
      console.error("获取图片URL失败:", error)
      throw error
    }
  }

  // 批量删除图片
  async deleteImages(filePathsList: { webp: string; thumbnail: string }[]): Promise<void> {
    const deletePromises = filePathsList.map(filePaths =>
      this.deleteImageFiles(filePaths)
    )

    try {
      await Promise.all(deletePromises)
    } catch (error) {
      console.error("批量删除图片失败:", error)
      throw error
    }
  }

  // 清理临时URL
  cleanupUrls(urls: string[]): void {
    urls.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch (error) {
        console.warn("清理URL失败:", error)
      }
    })
  }
}

// 创建单例实例
export const imageProcessorService = new ImageProcessorService()