// Animation components and utilities for style selection

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../../lib/utils'

// Animation variants
export const panelVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
      staggerChildren: 0.05
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.2
    }
  }
}

export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
}

export const stylePreviewVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: 10
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 25
    }
  }
}

// Animated backdrop component
export const AnimatedBackdrop: React.FC<{
  onClick: () => void
  className?: string
}> = ({ onClick, className }) => (
  <motion.div
    variants={backdropVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    className={cn("absolute inset-0 bg-black/10 backdrop-blur-[2px]", className)}
    onClick={onClick}
  />
)

// Animated panel container
export const AnimatedPanel: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <motion.div
    variants={panelVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    className={cn(
      "relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-md w-full mx-4",
      className
    )}
  >
    {children}
  </motion.div>
)

// Animated style grid
export const AnimatedStyleGrid: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <motion.div
    className={cn("grid grid-cols-2 gap-3 mb-6", className)}
    initial="hidden"
    animate="visible"
    variants={{
      visible: {
        transition: {
          staggerChildren: 0.05
        }
      }
    }}
  >
    {children}
  </motion.div>
)

// Animated style preview wrapper
export const AnimatedStylePreview: React.FC<{
  children: React.ReactNode
  isSelected?: boolean
  className?: string
}> = ({ children, isSelected, className }) => (
  <motion.div
    variants={stylePreviewVariants}
    className={cn("relative", className)}
    whileHover={{ 
      scale: 1.02,
      transition: { duration: 0.2 }
    }}
    whileTap={{ 
      scale: 0.98,
      transition: { duration: 0.1 }
    }}
    animate={isSelected ? {
      scale: 1.05,
      transition: { duration: 0.2 }
    } : {
      scale: 1,
      transition: { duration: 0.2 }
    }}
  >
    {children}
  </motion.div>
)

// Style application animation
export const StyleApplicationAnimation: React.FC<{
  isVisible: boolean
  children: React.ReactNode
}> = ({ isVisible, children }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg"
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)

// Success checkmark animation
export const SuccessCheckmark: React.FC = () => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ 
      type: 'spring',
      stiffness: 400,
      damping: 20,
      delay: 0.1
    }}
    className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center"
  >
    <motion.svg
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="w-6 h-6 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <motion.path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </motion.svg>
  </motion.div>
)