// 可访问性设置类型定义
export interface AccessibilitySettings {
  highContrast: boolean
  reducedMotion: boolean
  largeText: boolean
  screenReader: boolean
  keyboardOnly: boolean
  focusVisible: boolean
  announcements: boolean
  colorBlindSupport: boolean
}

// 键盘快捷键类型定义
export interface KeyboardShortcuts {
  toggleHighContrast: string[]
  toggleReducedMotion: string[]
  toggleLargeText: string[]
  toggleScreenReader: string[]
  toggleFocusVisible: string[]
  toggleAnnouncements: string[]
  toggleColorBlind: string[]
  showShortcuts: string[]
}

// 上下文类型定义
export interface AccessibilityContextType {
  settings: AccessibilitySettings
  updateSetting: (key: keyof AccessibilitySettings, value: boolean) => void
  toggleSetting: (key: keyof AccessibilitySettings) => void
  resetSettings: () => void
  announce: (message: string) => void
  isInitialized: boolean
}

// 默认设置
export const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  screenReader: false,
  keyboardOnly: false,
  focusVisible: true,
  announcements: true,
  colorBlindSupport: false
}

// 默认快捷键
export const defaultShortcuts: KeyboardShortcuts = {
  toggleHighContrast: ['Alt', 'H'],
  toggleReducedMotion: ['Alt', 'R'],
  toggleLargeText: ['Alt', 'L'],
  toggleScreenReader: ['Alt', 'S'],
  toggleFocusVisible: ['Alt', 'F'],
  toggleAnnouncements: ['Alt', 'A'],
  toggleColorBlind: ['Alt', 'C'],
  showShortcuts: ['Alt', '?']
}