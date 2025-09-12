import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DragStatusIndicatorProps {
  isDragging: boolean
  isSnapping: boolean
  snapDirection?: 'top' | 'bottom' | 'left' | 'right'
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export function DragStatusIndicator({
  isDragging,
  isSnapping,
  snapDirection,
  position = 'top-right'
}: DragStatusIndicatorProps) {
  const getPositionClasses = () => {
    const positions = {
      'top-left': 'top-4 left-4',
      'top-right': 'top-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-right': 'bottom-4 right-4'
    }
    return positions[position]
  }

  return (
    <AnimatePresence>
      {(isDragging || isSnapping) && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={cn(
            'fixed z-50 pointer-events-none',
            getPositionClasses()
          )}
        >
          <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-2xl flex items-center space-x-3 min-w-[200px]">
            {/* Status Icon */}
            <motion.div
              animate={{ 
                rotate: isDragging ? [0, 360] : 0,
                scale: isSnapping ? [1, 1.2, 1] : 1
              }}
              transition={{ 
                duration: isDragging ? 2 : 0.5,
                repeat: isDragging ? Infinity : 0,
                ease: "linear"
              }}
              className="text-2xl"
            >
              {isSnapping ? '🧲' : '📦'}
            </motion.div>
            
            {/* Status Text */}
            <div className="flex-1">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm font-medium"
              >
                {isSnapping ? 'Magnetic Snap Mode' : 'Dragging'}
              </motion.div>
              
              {isSnapping && snapDirection && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-gray-300 mt-1"
                >
                  Direction: {snapDirection}
                </motion.div>
              )}
            </div>
            
            {/* Activity Indicator */}
            <motion.div
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-2 h-2 bg-green-400 rounded-full"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}