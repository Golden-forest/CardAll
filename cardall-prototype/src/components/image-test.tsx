import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RichTextEditorV2 } from '@/components/card/rich-text-editor-v2'
import { imageProcessor } from '@/services/image-processor'
import { fileSystemService } from '@/services/file-system-simple'
import { Upload, Image as ImageIcon, HardDrive } from 'lucide-react'

export function ImageTest() {
  const [content, setContent] = useState('<p>测试富文本编辑器的图片功能...</p>')
  const [storageStats, setStorageStats] = useState<any>(null)
  const [testCardId] = useState('test-card-001')
  const [testFolderId] = useState('test-folder-001')

  // 加载存储统计
  const loadStorageStats = async () => {
    try {
      const stats = await fileSystemService.getStorageStats()
      setStorageStats(stats)
    } catch (error) {
      console.error('Failed to load storage stats:', error)
    }
  }

  // 测试文件系统权限
  const testFileSystemAccess = async () => {
    try {
      const granted = await fileSystemService.requestDirectoryAccess()
      if (granted) {
        console.log('File system access granted')
        await loadStorageStats()
      } else {
        console.log('File system access denied, using IndexedDB fallback')
      }
    } catch (error) {
      console.error('File system test failed:', error)
    }
  }

  // 测试图片处理
  const testImageProcessing = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      if (files.length === 0) return

      try {
        console.log('Processing images...')
        const results = await imageProcessor.processImages(files, testCardId, testFolderId)
        console.log('Image processing results:', results)
        
        // 更新存储统计
        await loadStorageStats()
      } catch (error) {
        console.error('Image processing test failed:', error)
      }
    }
    
    input.click()
  }

  React.useEffect(() => {
    loadStorageStats()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">图片处理测试</h1>
        <div className="flex gap-2">
          <Button onClick={testFileSystemAccess} variant="outline" size="sm">
            <HardDrive className="h-4 w-4 mr-2" />
            测试文件系统
          </Button>
          <Button onClick={testImageProcessing} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            测试图片处理
          </Button>
          <Button onClick={loadStorageStats} variant="outline" size="sm">
            刷新统计
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 富文本编辑器测试 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                富文本编辑器 V2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditorV2
                content={content}
                onChange={setContent}
                cardId={testCardId}
                folderId={testFolderId}
                placeholder="在这里测试图片上传功能..."
                className="min-h-[300px]"
              />
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">使用说明:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 点击工具栏的"图片"按钮选择文件</li>
                  <li>• 直接拖拽图片到编辑器</li>
                  <li>• 使用 Ctrl+V 粘贴剪贴板中的图片</li>
                  <li>• 支持多张图片同时上传</li>
                  <li>• 自动转换为WebP格式并压缩</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 存储统计 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>存储统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {storageStats ? (
                <>
                  <div className="flex justify-between">
                    <span>图片数量:</span>
                    <Badge variant="secondary">{storageStats.totalImages}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>总大小:</span>
                    <Badge variant="secondary">
                      {(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>存储模式:</span>
                    <Badge variant={storageStats.storageMode === 'filesystem' ? "default" : "outline"}>
                      {storageStats.storageMode === 'filesystem' ? '文件系统' : 'IndexedDB'}
                    </Badge>
                  </div>
                </>
              ) : (
                <div>加载中...</div>
              )}
            </CardContent>
          </Card>

          {/* 功能特性 */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>功能特性</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>WebP格式转换</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>智能压缩</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>缩略图生成</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>本地文件存储</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>拖拽上传</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>粘贴上传</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 内容预览 */}
      <Card>
        <CardHeader>
          <CardTitle>内容预览 (HTML)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            {content}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}