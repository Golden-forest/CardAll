import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, X, Camera, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScreenshotPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  previewUrl: string | null
  fileName: string
  isDownloading?: boolean
}

export function ScreenshotPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  previewUrl,
  fileName,
  isDownloading = false
}: ScreenshotPreviewModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleConfirm = () => {
    setIsAnimating(true)
    // 延迟执行下载，让动画播放
    setTimeout(() => {
      onConfirm()
      setIsAnimating(false)
    }, 800)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Screenshot Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {fileName}.png
              </Badge>
              <Badge variant="outline" className="text-xs">
                High Quality
              </Badge>
            </div>
          </div>

          {/* Preview Image */}
          <div className="relative bg-checkered rounded-lg overflow-hidden border">
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className={cn(
                    "w-full h-auto max-h-[60vh] object-contain transition-all duration-300",
                    isAnimating && "scale-95 opacity-80"
                  )}
                />
                
                {/* Download Animation Overlay */}
                {isAnimating && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full p-6 shadow-lg animate-pulse">
                      <div className="relative">
                        <Download className="h-8 w-8 text-blue-600 animate-bounce" />
                        <Sparkles className="h-4 w-4 text-purple-500 absolute -top-1 -right-1 animate-spin" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <Camera className="h-12 w-12 mx-auto opacity-50" />
                  <p>Loading preview...</p>
                </div>
              </div>
            )}
          </div>

          {/* Download Status */}
          {isDownloading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              Preparing download...
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isAnimating || isDownloading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isAnimating || isDownloading || !previewUrl}
            className={cn(
              "relative overflow-hidden",
              isAnimating && "bg-gradient-to-r from-blue-500 to-purple-600"
            )}
          >
            {isAnimating ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* 添加棋盘背景样式 */
const checkeredStyle = `
.bg-checkered {
  background-image: 
    linear-gradient(45deg, #f1f5f9 25%, transparent 25%), 
    linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #f1f5f9 75%), 
    linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
`

// 将样式注入到文档中
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = checkeredStyle
  document.head.appendChild(styleElement)
}