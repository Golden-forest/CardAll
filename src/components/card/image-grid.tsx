import React, { useCallback } from 'react'
import { ImageData } from '@/types/card'

interface ImageGridProps {
  images: ImageData[]
}

function ImageGridComponent({ images }: ImageGridProps) {
  const displayImages = images.slice(0, 4)
  const imageCount = displayImages.length

  // Dynamic grid layout based on image count
  const getGridClassName = useCallback((count: number) => {
    switch (count) {
      case 1:
        return "flex justify-center" // Single image centered
      case 2:
        return "grid grid-cols-2 gap-2" // Two columns
      case 3:
        return "grid grid-cols-2 gap-2" // Two columns with special handling for 3rd image
      case 4:
      default:
        return "grid grid-cols-2 gap-2" // Standard 2x2 grid
    }
  }, [])

  // Dynamic image container styles
  const getImageContainerClassName = useCallback((count: number, index: number) => {
    const baseClasses = "relative aspect-video rounded-md overflow-hidden bg-muted transition-all duration-200 hover:scale-[1.02]"
    
    if (count === 1) {
      // Single image: center and limit max width
      return `${baseClasses} max-w-xs w-full`
    }
    
    if (count === 3 && index === 2) {
      // Third image in 3-image layout: span both columns and center
      return `${baseClasses} col-span-2 max-w-xs mx-auto`
    }
    
    return baseClasses
  }, [])

  return (
    <div className={getGridClassName(imageCount)}>
      {displayImages.map((image: ImageData, index: number) => (
        <div 
          key={index} 
          className={getImageContainerClassName(imageCount, index)}
        >
          <img
            src={image.url}
            alt={image.alt || `Image ${index + 1}`}
            className="w-full h-full object-cover transition-transform duration-200"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  )
}

export const ImageGrid = React.memo(ImageGridComponent)