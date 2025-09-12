// 简化版文件系统服务，专门用于图片处理
class SimpleFileSystemService {
  private storageMode: 'filesystem' | 'indexeddb' = 'indexeddb'
  private directoryHandle: FileSystemDirectoryHandle | null = null

  // 检查是否支持File System Access API
  isFileSystemAccessSupported(): boolean {
    return 'showDirectoryPicker' in window
  }

  // 请求目录访问权限
  async requestDirectoryAccess(): Promise<boolean> {
    if (!this.isFileSystemAccessSupported()) {
      return false
    }

    try {
      this.directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      })
      this.storageMode = 'filesystem'
      console.log('File system access granted')
      return true
    } catch (error) {
      console.warn('File system access denied:', error)
      return false
    }
  }

  // 保存文件
  async saveFile(filePath: string, blob: Blob): Promise<void> {
    if (this.storageMode === 'filesystem' && this.directoryHandle) {
      await this.saveToFileSystem(filePath, blob)
    } else {
      await this.saveToIndexedDB(filePath, blob)
    }
  }

  // 获取文件URL
  async getFileUrl(filePath: string): Promise<string> {
    if (this.storageMode === 'filesystem' && this.directoryHandle) {
      return await this.getFileSystemUrl(filePath)
    } else {
      return await this.getIndexedDBUrl(filePath)
    }
  }

  // 删除文件
  async deleteFile(filePath: string): Promise<void> {
    if (this.storageMode === 'filesystem' && this.directoryHandle) {
      await this.deleteFromFileSystem(filePath)
    } else {
      await this.deleteFromIndexedDB(filePath)
    }
  }

  // 保存到文件系统
  private async saveToFileSystem(filePath: string, blob: Blob): Promise<void> {
    if (!this.directoryHandle) throw new Error('No directory handle')

    try {
      // 创建目录结构
      const pathParts = filePath.split('/')
      const fileName = pathParts.pop()!
      
      let currentDir = this.directoryHandle
      for (const part of pathParts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true })
      }

      // 创建文件
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
    } catch (error) {
      console.error('Failed to save to file system:', error)
      throw error
    }
  }

  // 从文件系统获取URL
  private async getFileSystemUrl(filePath: string): Promise<string> {
    if (!this.directoryHandle) throw new Error('No directory handle')

    try {
      const pathParts = filePath.split('/')
      const fileName = pathParts.pop()!
      
      let currentDir = this.directoryHandle
      for (const part of pathParts) {
        currentDir = await currentDir.getDirectoryHandle(part)
      }

      const fileHandle = await currentDir.getFileHandle(fileName)
      const file = await fileHandle.getFile()
      return URL.createObjectURL(file)
    } catch (error) {
      console.error('Failed to get file system URL:', error)
      throw error
    }
  }

  // 从文件系统删除
  private async deleteFromFileSystem(filePath: string): Promise<void> {
    if (!this.directoryHandle) throw new Error('No directory handle')

    try {
      const pathParts = filePath.split('/')
      const fileName = pathParts.pop()!
      
      let currentDir = this.directoryHandle
      for (const part of pathParts) {
        currentDir = await currentDir.getDirectoryHandle(part)
      }

      await currentDir.removeEntry(fileName)
    } catch (error) {
      console.error('Failed to delete from file system:', error)
      // 不抛出错误，删除失败不应该影响其他操作
    }
  }

  // 保存到IndexedDB
  private async saveToIndexedDB(filePath: string, blob: Blob): Promise<void> {
    try {
      // 使用简单的key-value存储
      const arrayBuffer = await blob.arrayBuffer()
      localStorage.setItem(`cardall-file:${filePath}`, 
        JSON.stringify({
          data: Array.from(new Uint8Array(arrayBuffer)),
          type: blob.type,
          size: blob.size
        })
      )
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error)
      throw error
    }
  }

  // 从IndexedDB获取URL
  private async getIndexedDBUrl(filePath: string): Promise<string> {
    try {
      const stored = localStorage.getItem(`cardall-file:${filePath}`)
      if (!stored) {
        throw new Error('File not found')
      }

      const { data, type } = JSON.parse(stored)
      const uint8Array = new Uint8Array(data)
      const blob = new Blob([uint8Array], { type })
      return URL.createObjectURL(blob)
    } catch (error) {
      console.error('Failed to get IndexedDB URL:', error)
      throw error
    }
  }

  // 从IndexedDB删除
  private async deleteFromIndexedDB(filePath: string): Promise<void> {
    try {
      localStorage.removeItem(`cardall-file:${filePath}`)
    } catch (error) {
      console.error('Failed to delete from IndexedDB:', error)
      // 不抛出错误
    }
  }

  // 获取存储统计
  async getStorageStats(): Promise<{
    totalImages: number
    totalSize: number
    storageMode: 'filesystem' | 'indexeddb'
  }> {
    let totalImages = 0
    let totalSize = 0

    if (this.storageMode === 'indexeddb') {
      // 统计localStorage中的文件
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cardall-file:')) {
          totalImages++
          try {
            const stored = localStorage.getItem(key)
            if (stored) {
              const { size } = JSON.parse(stored)
              totalSize += size
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      }
    }

    return {
      totalImages,
      totalSize,
      storageMode: this.storageMode
    }
  }

  // 获取当前存储模式
  getStorageMode(): 'filesystem' | 'indexeddb' {
    return this.storageMode
  }
}

// 创建文件系统服务实例
export const fileSystemService = new SimpleFileSystemService()