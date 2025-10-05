import React, { useState, useEffect, useCallback } from 'react'
import { ImageData } from '@/types/card'
import { Button } from '@/components/ui/button'
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download,
  ChevronLeft,
  ChevronRight,
  Fullscreen,
  Minimize
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageZoomModalProps {
  images: ImageData[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
}

interface TransformState {
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
}

export function ImageZoomModal({ 
  images, 
  initialIndex = 0, 
  isOpen, 
  onClose 
}: ImageZoomModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
  })
  const [isFullscreen, setIsFullscreen] = useState(false)

  const currentImage = images[currentIndex]

  // 重置变换
  const resetTransform = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0
    }))
  }, [])

  // 缩放
  const zoomIn = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 5)
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, 0.1)
    }))
  }, [])

  // 旋转
  const rotate = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360
    }))
  }, [])

  // 上一张
  const previousImage = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
    resetTransform()
  }, [images.length, resetTransform])

  // 下一张
  const nextImage = useCallback(() => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
    resetTransform()
  }, [images.length, resetTransform])

  // 下载图片
  const downloadImage = useCallback(async () => {
    if (!currentImage) return
    
    try {
      const response = await fetch(currentImage.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = currentImage.alt || `image-${currentIndex + 1}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }, [currentImage, currentIndex])

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }, [])

  // 键盘快捷键
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          previousImage()
          break
        case 'ArrowRight':
          nextImage()
          break
        case '+':
        case '=':
          zoomIn()
          break
        case '-':
        case '_':
          zoomOut()
          break
        case 'r':
        case 'R':
          rotate()
          break
        case ' ':
          e.preventDefault()
          nextImage()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, previousImage, nextImage, zoomIn, zoomOut, rotate, toggleFullscreen])

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }, [zoomIn, zoomOut])

  // 拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (transform.scale <= 1) return
    
    setTransform(prev => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.offsetX,
      dragStartY: e.clientY - prev.offsetY
    }))
  }, [transform.scale])

  // 拖拽中
  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!transform.isDragging) return
    
    setTransform(prev => ({
      ...prev,
      offsetX: e.clientX - prev.dragStartX,
      offsetY: e.clientY - prev.dragStartY
    }))
  }, [transform.isDragging])

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      isDragging: false
    }))
  }, [])

  if (!isOpen || !currentImage) return null

  const transformStyle = {
    transform: `scale(${transform.scale}) rotate(${transform.rotation}deg) translate(${transform.offsetX}px, ${transform.offsetY}px)`,
    transition: transform.isDragging ? 'none' : 'transform 0.3s ease',
    cursor: transform.scale > 1 ? 'grab' : 'default'
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      {/* 顶部控制栏 */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center space-x-2 text-white">
          <span className="text-sm">
            {currentIndex + 1} / {images.length}
          </span>
          <span className="text-sm text-gray-300 truncate max-w-md">
            {currentImage.alt || `Image ${currentIndex + 1}`}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-white hover:text-white hover:bg-white/20"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Fullscreen className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadImage}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 主图片区域 */}
      <div 
        className="flex items-center justify-center h-screen"
        onMouseDown={handleDragStart}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onWheel={handleWheel}
      >
        <img
          src={currentImage.url}
          alt={currentImage.alt || `Image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain select-none"
          style={transformStyle}
          draggable={false}
        />
      </div>

      {/* 左右切换按钮 */}
      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="lg"
            onClick={previousImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-white hover:bg-white/20 h-12 w-12 rounded-full"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={nextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-white hover:bg-white/20 h-12 w-12 rounded-full"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* 底部工具栏 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center p-4 bg-gradient-to-t from-black/50 to-transparent">
        <div className="flex items-center space-x-2 bg-black/50 rounded-lg p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={transform.scale <= 0.1}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-white text-sm min-w-[60px] text-center">
            {Math.round(transform.scale * 100)}%
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={transform.scale >= 5}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-white/30 mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={rotate}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={resetTransform}
            className="text-white hover:text-white hover:bg-white/20"
          >
            重置
          </Button>
        </div>
      </div>

      {/* 缩略图导航 */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex space-x-2 bg-black/50 rounded-lg p-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index)
                resetTransform()
              }}
              className={cn(
                "w-12 h-12 rounded overflow-hidden border-2 transition-all",
                index === currentIndex 
                  ? "border-white scale-110" 
                  : "border-transparent hover:border-white/50"
              )}
            >
              <img
                src={image.url}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* 快捷键提示 */}
      <div className="absolute top-20 right-4 bg-black/50 text-white text-xs rounded p-2 space-y-1">
        <div>←/→: 切换图片</div>
        <div>+/-: 缩放</div>
        <div>R: 旋转</div>
        <div>空格: 下一张</div>
        <div>F: 全屏</div>
        <div>ESC: 关闭</div>
      </div>
    </div>
  )
}