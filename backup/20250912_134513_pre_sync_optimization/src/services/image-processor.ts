import { fileSystemService } from './file-system-simple'

export interface ProcessedImageResult {
  id: string
  originalFile: File
  webpBlob: Blob
  thumbnailBlob: Blob
  metadata: {
    originalName: string
    originalSize: number
    processedSize: number
    thumbnailSize: number
    width: number
    height: number
    format: string
    quality: number
  }
  filePaths: {
    original: string
    webp: string
    thumbnail: string
  }
}

export interface ImageProcessingOptions {
  quality: number // 0.1 - 1.0
  maxWidth: number
  maxHeight: number
  thumbnailSize: number
  format: 'webp' | 'jpeg' | 'png'
}

class ImageProcessorService {
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
        id: imageId,
        originalFile: file,
        webpBlob,
        thumbnailBlob,
        metadata: {
          originalName: file.name,
          originalSize: file.size,
          processedSize: webpBlob.size,
          thumbnailSize: thumbnailBlob.size,
          width,
          height,
          format: opts.format,
          quality: opts.quality
        },
        filePaths
      }
    } catch (error) {
      console.error('Image processing failed:', error)
      throw new Error(`图片处理失败: ${error instanceof Error ? error.message : '未知错误'}`)
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
        console.error(`Failed to process image ${file.name}:`, error)
        // 继续处理其他图片，不中断整个流程
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
    
    // 如果图片尺寸超过最大限制，按比例缩放
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
  private convertToWebP(
    img: HTMLImageElement, 
    width: number, 
    height: number, 
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'))
        return
      }
      
      canvas.width = width
      canvas.height = height
      
      // 绘制图片到canvas
      ctx.drawImage(img, 0, 0, width, height)
      
      // 转换为WebP格式
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
  private generateThumbnail(img: HTMLImageElement, size: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'))
        return
      }
      
      // 计算缩略图尺寸（正方形，居中裁剪）
      const { width, height } = this.calculateThumbnailSize(img.width, img.height, size)
      
      canvas.width = size
      canvas.height = size
      
      // 居中绘制
      const offsetX = (size - width) / 2
      const offsetY = (size - height) / 2
      
      ctx.drawImage(img, offsetX, offsetY, width, height)
      
      // 转换为WebP格式
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('缩略图生成失败'))
          }
        },
        'image/webp',
        0.7 // 缩略图使用较低质量以减小文件大小
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
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 生成文件路径
  private generateFilePaths(imageId: string, cardId: string, folderId?: string): {
    original: string
    webp: string
    thumbnail: string
  } {
    const basePath = folderId 
      ? `images/${folderId}/${cardId}` 
      : `images/uncategorized/${cardId}`
    
    return {
      original: `${basePath}/${imageId}_original.webp`,
      webp: `${basePath}/${imageId}.webp`,
      thumbnail: `${basePath}/thumbnails/${imageId}_thumb.webp`
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
      console.error('Failed to save image files:', error)
      throw new Error('图片文件保存失败')
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
      console.error('Failed to delete image files:', error)
      // 删除失败不抛出错误，避免影响其他操作
    }
  }

  // 获取图片URL（用于显示）
  async getImageUrl(filePath: string): Promise<string> {
    try {
      return await fileSystemService.getFileUrl(filePath)
    } catch (error) {
      console.error('Failed to get image URL:', error)
      // 返回占位符图片
      return '/placeholder.svg?height=200&width=200'
    }
  }

  // 检查浏览器WebP支持
  isWebPSupported(): Promise<boolean> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      
      canvas.toBlob(
        (blob) => resolve(blob !== null),
        'image/webp'
      )
    })
  }
}

// 创建图片处理服务实例
export const imageProcessor = new ImageProcessorService()