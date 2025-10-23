// Style trigger button for opening style selection panel

import React from 'react'
import { Palette } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface StyleTriggerButtonProps {
  onClick: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost' | 'outline'
}

export const StyleTriggerButton: React.FC<StyleTriggerButtonProps> = ({
  onClick,
  className,
  size = 'sm',
  variant = 'ghost'
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5'
  }

  const variantClasses = {
    default: 'bg-white text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50',
    ghost: 'bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900',
    outline: 'bg-transparent text-gray-600 border border-gray-300 hover:bg-white hover:text-gray-900'
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all duration-200',
        'backdrop-blur-sm hover:scale-105 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      title="Change card style"
    >
      <Palette className="w-full h-full" />
    </button>
  )
}

export default StyleTriggerButton