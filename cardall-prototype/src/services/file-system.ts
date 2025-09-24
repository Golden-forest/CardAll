import { db, DbImage } from './database'

export interface FileSystemConfig {
  baseDirectory: string
  imageDirectory: string
  tempDirectory: string
  cacheDirectory: string
}

export interface ProcessedImage {
  id: string
  fileName: string
  filePath: string
  thumbnailPath?: string
  metadata: {
    originalName: string
    size: number
    width: number
    height: number
    format: string
    compressed: boolean
  }
}

class FileSystemService {
  private config: FileSystemConfig
  private directoryHandle: FileSystemDirectoryHandle | null = null
  private isSupported: boolean

  constructor() {
    this.config = {
      baseDirectory: 'CardAll',
      imageDirectory: 'images',
      tempDirectory: 'temp',
      cacheDirectory: 'cache'
    }
    
    this.isSupported = 'showDirectoryPicker' in window
  }

  // 检查文件系统API支持
  isFileSystemAccessSupported(): boolean {
    return this.isSupported
  }

  // 请求目录访问权限
  async requestDirectoryAccess(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('File System Access API not supported, using fallback storage')
      this.saveStorageStrategy('indexeddb')
      return false
    }

    try {
      this.directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      })

      // 创建必要的子目录
      await this.ensureDirectoryStructure()
      this.saveStorageStrategy('filesystem')
      return true
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('User cancelled directory selection, using fallback storage')
      } else {
        console.error('Failed to access directory:', error)
      }
      this.saveStorageStrategy('indexeddb')
      return false
    }
  }

  // 保存存储策略到数据库
  private async saveStorageStrategy(strategy: 'filesystem' | 'indexeddb'): Promise<void> {
    try {
      await db.settings.put({
        key: 'storageStrategy',
        value: strategy,
        updatedAt: new Date(),
        scope: 'global'
      })
    } catch (error) {
      console.error('Failed to save storage strategy:', error)
    }
  }

  // 获取当前存储策略
  async getStorageStrategy(): Promise<'filesystem' | 'indexeddb'> {
    try {
      const setting = await db.settings.get('storageStrategy')
      return setting?.value || 'indexeddb'
    } catch {
      return 'indexeddb'
    }
  }

  // 确保目录结构存在
  private async ensureDirectoryStructure(): Promise<void> {
    if (!this.directoryHandle) return

    try {
      // 创建主要目录
      await this.getOrCreateDirectory(this.config.imageDirectory)
      await this.getOrCreateDirectory(this.config.tempDirectory)
      await this.getOrCreateDirectory(this.config.cacheDirectory)
      
      console.log('Directory structure created successfully')
    } catch (error) {
      console.error('Failed to create directory structure:', error)
    }
  }

  // 获取或创建目录
  private async getOrCreateDirectory(name: string): Promise<FileSystemDirectoryHandle> {
    if (!this.directoryHandle) {
      throw new Error('No directory handle available')
    }

    try {
      return await this.directoryHandle.getDirectoryHandle(name)
    } catch (error) {
      // 目录不存在，创建它
      return await this.directoryHandle.getDirectoryHandle(name, { create: true })
    }
  }

  // 获取或创建嵌套目录路径
  private async getOrCreateNestedDirectory(path: string): Promise<FileSystemDirectoryHandle> {
    if (!this.directoryHandle) {
      throw new Error('No directory handle available')
    }

    const parts = path.split('/')
    let currentHandle = this.directoryHandle

    for (const part of parts) {
      if (part) {
        try {
          currentHandle = await currentHandle.getDirectoryHandle(part)
        } catch (error) {
          currentHandle = await currentHandle.getDirectoryHandle(part, { create: true })
        }
      }
    }

    return currentHandle
  }

  // 生成文件路径
  generateImagePath(cardId: string, folderId?: string): string {
    const folderPath = folderId || 'uncategorized'
    return `${this.config.imageDirectory}/${folderPath}/${cardId}`
  }

  // 处理和保存图片
  async saveImage(
    file: File, 
    cardId: string, 
    folderId?: string
  ): Promise<ProcessedImage> {
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fileName = `${imageId}.webp`
    const imagePath = this.generateImagePath(cardId, folderId)
    const fullPath = `${imagePath}/${fileName}`

    try {
      // 处理图片（压缩和转换格式）
      const processedBlob = await this.processImage(file)
      const metadata = await this.getImageMetadata(file, processedBlob)

      if (this.isSupported && this.directoryHandle) {
        // 使用File System Access API保存
        await this.saveToFileSystem(fullPath, processedBlob)
      } else {
        // 降级到IndexedDB存储
        await this.saveToIndexedDB(fullPath, processedBlob)
      }

      // 保存图片记录到数据库
      const dbImage: DbImage = {
        id: imageId,
        cardId,
        fileName,
        filePath: fullPath,
        metadata,
        createdAt: new Date(),
        syncVersion: 1,
        pendingSync: true
      }

      await db.images.add(dbImage)

      return {
        id: imageId,
        fileName,
        filePath: fullPath,
        metadata
      }
    } catch (error) {
      console.error('Failed to save image:', error)
      throw error
    }
  }

  // 处理图片（压缩和格式转换）
  private async processImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        try {
          // 计算目标尺寸
          const maxWidth = 1920
          const maxHeight = 1080
          let { width, height } = img

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width *= ratio
            height *= ratio
          }

          canvas.width = width
          canvas.height = height

          // 绘制图片
          ctx?.drawImage(img, 0, 0, width, height)

          // 转换为WebP格式
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Failed to convert image'))
              }
            },
            'image/webp',
            0.8 // 质量设置
          )
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  // 获取图片元数据
  private async getImageMetadata(originalFile: File, processedBlob: Blob): Promise<any> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          originalName: originalFile.name,
          size: processedBlob.size,
          width: img.width,
          height: img.height,
          format: 'webp',
          compressed: true
        })
      }
      img.src = URL.createObjectURL(processedBlob)
    })
  }

  // 保存到文件系统
  private async saveToFileSystem(path: string, blob: Blob): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('No directory handle available')
    }

    const pathParts = path.split('/')
    const fileName = pathParts.pop()!
    const dirPath = pathParts.join('/')

    // 创建目录结构
    const dirHandle = await this.getOrCreateNestedDirectory(dirPath)
    
    // 创建文件
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    
    await writable.write(blob)
    await writable.close()
  }

  // 降级保存到IndexedDB
  private async saveToIndexedDB(path: string, blob: Blob): Promise<void> {
    // 将blob转换为ArrayBuffer存储在IndexedDB中
    const arrayBuffer = await blob.arrayBuffer()
    
    // 这里可以使用一个专门的表来存储文件数据
    // 暂时先用localStorage作为演示
    const base64 = await this.blobToBase64(blob)
    localStorage.setItem(`cardall_file_${path}`, base64)
  }

  // Blob转Base64
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // 获取图片
  async getImage(imagePath: string): Promise<string> {
    try {
      if (this.isSupported && this.directoryHandle) {
        return await this.getFromFileSystem(imagePath)
      } else {
        return await this.getFromIndexedDB(imagePath)
      }
    } catch (error) {
      console.error('Failed to get image:', error)
      throw error
    }
  }

  // 从文件系统获取图片
  private async getFromFileSystem(path: string): Promise<string> {
    if (!this.directoryHandle) {
      throw new Error('No directory handle available')
    }

    const pathParts = path.split('/')
    const fileName = pathParts.pop()!
    const dirPath = pathParts.join('/')

    const dirHandle = await this.getOrCreateNestedDirectory(dirPath)
    const fileHandle = await dirHandle.getFileHandle(fileName)
    const file = await fileHandle.getFile()
    
    return URL.createObjectURL(file)
  }

  // 从IndexedDB获取图片
  private async getFromIndexedDB(path: string): Promise<string> {
    const base64 = localStorage.getItem(`cardall_file_${path}`)
    if (!base64) {
      throw new Error('Image not found in storage')
    }
    return base64
  }

  // 删除图片
  async deleteImage(imagePath: string): Promise<void> {
    try {
      if (this.isSupported && this.directoryHandle) {
        await this.deleteFromFileSystem(imagePath)
      } else {
        await this.deleteFromIndexedDB(imagePath)
      }

      // 从数据库中删除记录
      await db.images.where('filePath').equals(imagePath).delete()
    } catch (error) {
      console.error('Failed to delete image:', error)
      throw error
    }
  }

  // 从文件系统删除
  private async deleteFromFileSystem(path: string): Promise<void> {
    if (!this.directoryHandle) return

    try {
      const pathParts = path.split('/')
      const fileName = pathParts.pop()!
      const dirPath = pathParts.join('/')

      const dirHandle = await this.getOrCreateNestedDirectory(dirPath)
      await dirHandle.removeEntry(fileName)
    } catch (error) {
      console.warn('Failed to delete file from filesystem:', error)
    }
  }

  // 从IndexedDB删除
  private async deleteFromIndexedDB(path: string): Promise<void> {
    localStorage.removeItem(`cardall_file_${path}`)
  }

  // 获取存储统计信息
  async getStorageStats(): Promise<{
    totalImages: number
    totalSize: number
    storageMode: 'filesystem' | 'indexeddb'
  }> {
    const images = await db.images.toArray()
    const totalSize = images.reduce((sum, img) => sum + img.metadata.size, 0)

    return {
      totalImages: images.length,
      totalSize,
      storageMode: this.isSupported && this.directoryHandle ? 'filesystem' : 'indexeddb'
    }
  }
}

// 创建文件系统服务实例
export const fileSystemService = new FileSystemService()