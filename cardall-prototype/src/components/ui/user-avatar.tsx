import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  user?: {
    username?: string
    email?: string
    avatar_url?: string
  } | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
  showHoverEffect?: boolean
}

// 预定义的渐变色组合
const gradientColors = [
  'from-violet-500 to-pink-500', // 主要颜色，与Logo保持一致
  'from-blue-500 to-purple-600',
  'from-green-500 to-teal-600', 
  'from-orange-500 to-red-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
  'from-yellow-500 to-orange-600',
  'from-purple-500 to-pink-600',
  'from-teal-500 to-green-600',
  'from-red-500 to-pink-600',
  'from-cyan-500 to-blue-600'
]

// 根据字符串生成一致的索引
function getGradientIndex(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash) % gradientColors.length
}

// 提取首字母
function getInitial(user?: { username?: string; email?: string } | null): string {
  if (!user) return '?'
  
  // 优先使用username
  if (user.username) {
    return user.username.charAt(0).toUpperCase()
  }
  
  // 其次使用email的第一个字符
  if (user.email) {
    return user.email.charAt(0).toUpperCase()
  }
  
  return '?'
}

// 获取用于生成颜色的字符串
function getColorSeed(user?: { username?: string; email?: string } | null): string {
  if (!user) return 'anonymous'
  return user.username || user.email || 'anonymous'
}

export function UserAvatar({ 
  user, 
  size = 'md', 
  className, 
  onClick,
  showHoverEffect = true 
}: UserAvatarProps) {
  const initial = getInitial(user)
  const colorSeed = getColorSeed(user)
  const gradientIndex = getGradientIndex(colorSeed)
  const gradientClass = gradientColors[gradientIndex]
  
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm', 
    lg: 'h-10 w-10 text-base'
  }
  
  const avatarClass = cn(
    sizeClasses[size],
    showHoverEffect && onClick && 'cursor-pointer transition-transform hover:scale-105',
    className
  )
  
  const fallbackClass = cn(
    'bg-gradient-to-br text-white font-semibold flex items-center justify-center',
    gradientClass,
    showHoverEffect && onClick && 'transition-all duration-200 hover:shadow-md'
  )

  return (
    <Avatar className={avatarClass} onClick={onClick}>
      <AvatarImage 
        src={user?.avatar_url} 
        alt={user?.username || user?.email || 'User'} 
      />
      <AvatarFallback className={fallbackClass}>
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}