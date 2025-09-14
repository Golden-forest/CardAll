/**
 * 可访问性增强组件
 * 提供屏幕阅读器支持、键盘导航和高对比度模式
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { secureStorage } from '@/utils/secure-storage'

export interface AccessibilitySettings {
  highContrast: boolean
  largeText: boolean
  reducedMotion: boolean
  screenReaderOptimized: boolean
  keyboardNavigation: boolean
  colorBlindSupport: boolean
}

export interface AccessibilityEnhancementsProps {
  children: React.ReactNode
  settings?: Partial<AccessibilitySettings>
  onSettingsChange?: (settings: AccessibilitySettings) => void
}

export function AccessibilityEnhancements({
  children,
  settings: initialSettings,
  onSettingsChange
}: AccessibilityEnhancementsProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReaderOptimized: false,
    keyboardNavigation: false,
    colorBlindSupport: false,
    ...initialSettings
  })

  const [showPanel, setShowPanel] = useState(false)
  const [focusedElement, setFocusedElement] = useState<string | null>(null)

  // 加载保存的设置
  useEffect(() => {
    const savedSettings = secureStorage.get<AccessibilitySettings>('accessibility-settings', {
      validate: true
    })

    if (savedSettings) {
      setSettings(prev => ({ ...prev, ...savedSettings }))
    }
  }, [])

  // 应用设置到文档
  useEffect(() => {
    const root = document.documentElement

    // 高对比度模式
    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    // 大字体模式
    if (settings.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }

    // 减少动画
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }

    // 色盲支持
    if (settings.colorBlindSupport) {
      root.classList.add('color-blind-support')
    } else {
      root.classList.remove('color-blind-support')
    }

    // 屏幕阅读器优化
    if (settings.screenReaderOptimized) {
      root.setAttribute('role', 'application')
      root.setAttribute('aria-label', 'CardEverything 知识卡片管理应用')
    } else {
      root.removeAttribute('role')
      root.removeAttribute('aria-label')
    }

    // 键盘导航提示
    if (settings.keyboardNavigation) {
      setupKeyboardNavigation()
    }

    // 保存设置
    secureStorage.set('accessibility-settings', settings, {
      validate: true
    })

    onSettingsChange?.(settings)
  }, [settings, onSettingsChange])

  // 设置键盘导航
  const setupKeyboardNavigation = () => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + Shift + A 显示/隐藏无障碍面板
      if (event.altKey && event.shiftKey && event.key === 'A') {
        event.preventDefault()
        setShowPanel(prev => !prev)
      }

      // 快捷键导航
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault()
            focusElement('search')
            break
          case 'n':
            event.preventDefault()
            focusElement('create-card')
            break
          case 'f':
            event.preventDefault()
            focusElement('folders')
            break
          case 't':
            event.preventDefault()
            focusElement('tags')
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }

  // 聚焦到指定元素
  const focusElement = (elementId: string) => {
    const element = document.querySelector(`[data-accessible-id=\"${elementId}\"]`)
    if (element instanceof HTMLElement) {
      element.focus()
      setFocusedElement(elementId)
      setTimeout(() => setFocusedElement(null), 2000)
    }
  }

  // 更新设置
  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // 重置设置
  const resetSettings = () => {
    const defaultSettings: AccessibilitySettings = {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      screenReaderOptimized: false,
      keyboardNavigation: false,
      colorBlindSupport: false
    }
    setSettings(defaultSettings)
    secureStorage.remove('accessibility-settings')
  }

  return (
    <>
      {/* 无障碍设置按钮 */}
      <Button
        variant=\"ghost\"
        size=\"sm\"
        onClick={() => setShowPanel(!showPanel)}
        className=\"fixed bottom-4 left-4 z-40 shadow-lg\"
        aria-label=\"无障碍设置\"
        aria-expanded={showPanel}
        aria-controls=\"accessibility-panel\"
      >
        <span className=\"mr-2\">♿</span>
        无障碍
      </Button>

      {/* 键盘导航提示 */}
      {settings.keyboardNavigation && focusedElement && (
        <div className=\"fixed top-4 right-4 z-50 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-4 py-2 rounded-lg shadow-lg animate-pulse\">
          已聚焦到: {getReadableElementName(focusedElement)}
        </div>
      )}

      {/* 快捷键提示 */}
      {settings.keyboardNavigation && (
        <div className=\"fixed bottom-4 left-20 z-40 bg-muted text-muted-foreground text-xs px-2 py-1 rounded\">
          快捷键: Ctrl+K 搜索 | Ctrl+N 新建 | Ctrl+F 文件夹 | Ctrl+T 标签
        </div>
      )}

      {/* 无障碍设置面板 */}
      {showPanel && (
        <>
          {/* 背景遮罩 */}
          <div
            className=\"fixed inset-0 bg-black bg-opacity-50 z-40\"
            onClick={() => setShowPanel(false)}
            role=\"presentation\"
            aria-hidden=\"true\"
          />

          {/* 设置面板 */}
          <div
            id=\"accessibility-panel\"
            className=\"fixed top-4 right-4 z-50 w-96 max-h-[80vh] overflow-y-auto\"
            role=\"dialog\"
            aria-modal=\"true\"
            aria-labelledby=\"accessibility-title\"
          >
            <Card className=\"shadow-2xl\">
              <CardHeader>
                <CardTitle id=\"accessibility-title\" className=\"flex items-center gap-2\">
                  <span className=\"text-2xl\">♿</span>
                  无障碍设置
                </CardTitle>
              </CardHeader>

              <CardContent className=\"space-y-6\">
                {/* 视觉辅助 */}
                <div className=\"space-y-4\">
                  <h3 className=\"font-medium flex items-center gap-2\">
                    👁️ 视觉辅助
                  </h3>

                  <div className=\"space-y-3\">
                    <label className=\"flex items-center justify-between cursor-pointer\">
                      <span className=\"text-sm\">高对比度模式</span>
                      <input
                        type=\"checkbox\"
                        checked={settings.highContrast}
                        onChange={(e) => updateSetting('highContrast', e.target.checked)}
                        className=\"w-4 h-4\"
                        aria-describedby=\"high-contrast-desc\"
                      />
                    </label>
                    <p id=\"high-contrast-desc\" className=\"text-xs text-muted-foreground\">
                      提高文本和背景的对比度，便于阅读
                    </p>

                    <label className=\"flex items-center justify-between cursor-pointer\">
                      <span className=\"text-sm\">大字体模式</span>
                      <input
                        type=\"checkbox\"
                        checked={settings.largeText}
                        onChange={(e) => updateSetting('largeText', e.target.checked)}
                        className=\"w-4 h-4\"
                        aria-describedby=\"large-text-desc\"
                      />
                    </label>
                    <p id=\"large-text-desc\" className=\"text-xs text-muted-foreground\">
                      增大字体大小，提高可读性
                    </p>

                    <label className=\"flex items-center justify-between cursor-pointer\">
                      <span className=\"text-sm\">色盲友好模式</span>
                      <input
                        type=\"checkbox\"
                        checked={settings.colorBlindSupport}
                        onChange={(e) => updateSetting('colorBlindSupport', e.target.checked)}
                        className=\"w-4 h-4\"
                        aria-describedby=\"color-blind-desc\"
                      />
                    </label>
                    <p id=\"color-blind-desc\" className=\"text-xs text-muted-foreground\">
                      使用色盲友好的配色方案
                    </p>
                  </div>
                </div>

                {/* 动画和交互 */}
                <div className=\"space-y-4\">
                  <h3 className=\"font-medium flex items-center gap-2\">
                    🎭 动画和交互
                  </h3>

                  <div className=\"space-y-3\">
                    <label className=\"flex items-center justify-between cursor-pointer\">
                      <span className=\"text-sm\">减少动画</span>
                      <input
                        type=\"checkbox\"
                        checked={settings.reducedMotion}
                        onChange={(e) => updateSetting('reducedMotion', e.target.checked)}
                        className=\"w-4 h-4\"
                        aria-describedby=\"reduced-motion-desc\"
                      />
                    </label>
                    <p id=\"reduced-motion-desc\" className=\"text-xs text-muted-foreground\">
                      减少或移除动画效果，防止晕眩
                    </p>
                  </div>
                </div>

                {/* 辅助技术 */}
                <div className=\"space-y-4\">
                  <h3 className=\"font-medium flex items-center gap-2\">
                    🦯 辅助技术
                  </h3>

                  <div className=\"space-y-3\">
                    <label className=\"flex items-center justify-between cursor-pointer\">
                      <span className=\"text-sm\">屏幕阅读器优化</span>
                      <input
                        type=\"checkbox\"
                        checked={settings.screenReaderOptimized}
                        onChange={(e) => updateSetting('screenReaderOptimized', e.target.checked)}
                        className=\"w-4 h-4\"
                        aria-describedby=\"screen-reader-desc\"
                      />
                    </label>
                    <p id=\"screen-reader-desc\" className=\"text-xs text-muted-foreground\">
                      优化屏幕阅读器的兼容性
                    </p>

                    <label className=\"flex items-center justify-between cursor-pointer\">
                      <span className=\"text-sm\">键盘导航增强</span>
                      <input
                        type=\"checkbox\"
                        checked={settings.keyboardNavigation}
                        onChange={(e) => updateSetting('keyboardNavigation', e.target.checked)}
                        className=\"w-4 h-4\"
                        aria-describedby=\"keyboard-nav-desc\"
                      />
                    </label>
                    <p id=\"keyboard-nav-desc\" className=\"text-xs text-muted-foreground\">
                      启用键盘快捷键和导航提示
                    </p>
                  </div>
                </div>

                {/* 快捷键参考 */}
                {settings.keyboardNavigation && (
                  <div className=\"space-y-3\">
                    <h3 className=\"font-medium flex items-center gap-2\">
                      ⌨️ 键盘快捷键
                    </h3>
                    <div className=\"grid grid-cols-1 gap-2 text-sm\">
                      <div className=\"flex justify-between p-2 bg-muted rounded\">
                        <span>搜索</span>
                        <kbd className=\"px-2 py-1 bg-background border rounded text-xs\">Ctrl/Cmd + K</kbd>
                      </div>
                      <div className=\"flex justify-between p-2 bg-muted rounded\">
                        <span>新建卡片</span>
                        <kbd className=\"px-2 py-1 bg-background border rounded text-xs\">Ctrl/Cmd + N</kbd>
                      </div>
                      <div className=\"flex justify-between p-2 bg-muted rounded\">
                        <span>文件夹</span>
                        <kbd className=\"px-2 py-1 bg-background border rounded text-xs\">Ctrl/Cmd + F</kbd>
                      </div>
                      <div className=\"flex justify-between p-2 bg-muted rounded\">
                        <span>标签</span>
                        <kbd className=\"px-2 py-1 bg-background border rounded text-xs\">Ctrl/Cmd + T</kbd>
                      </div>
                      <div className=\"flex justify-between p-2 bg-muted rounded\">
                        <span>无障碍面板</span>
                        <kbd className=\"px-2 py-1 bg-background border rounded text-xs\">Alt + Shift + A</kbd>
                      </div>
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className=\"flex gap-2 pt-4 border-t\">
                  <Button variant=\"outline\" onClick={resetSettings} className=\"flex-1\">
                    重置设置
                  </Button>
                  <Button onClick={() => setShowPanel(false)} className=\"flex-1\">
                    完成
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 应用设置到子组件 */}
      <div
        className={`accessibility-root ${
          settings.highContrast ? 'high-contrast' : ''
        } ${settings.largeText ? 'large-text' : ''} ${
          settings.reducedMotion ? 'reduced-motion' : ''
        } ${settings.colorBlindSupport ? 'color-blind-support' : ''}`}
        data-accessible-settings={JSON.stringify(settings)}
      >
        {children}
      </div>
    </>
  )
}

// 获取可读的元素名称
function getReadableElementName(elementId: string): string {
  const names: Record<string, string> = {
    'search': '搜索框',
    'create-card': '创建卡片按钮',
    'folders': '文件夹列表',
    'tags': '标签列表'
  }
  return names[elementId] || elementId
}

// 无障碍属性 Hook
export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings | null>(null)

  useEffect(() => {
    const savedSettings = secureStorage.get<AccessibilitySettings>('accessibility-settings', {
      validate: true
    })
    setSettings(savedSettings)
  }, [])

  const getA11yProps = (props: {
    role?: string
    label?: string
    describedBy?: string
    tabIndex?: number
  }) => {
    const a11yProps: Record<string, string | number> = {}

    if (props.role) a11yProps['role'] = props.role
    if (props.label) a11yProps['aria-label'] = props.label
    if (props.describedBy) a11yProps['aria-describedby'] = props.describedBy
    if (props.tabIndex !== undefined) a11yProps['tabIndex'] = props.tabIndex

    // 如果启用了屏幕阅读器优化，添加额外的ARIA属性
    if (settings?.screenReaderOptimized) {
      a11yProps['aria-live'] = 'polite'
    }

    return a11yProps
  }

  return {
    settings,
    getA11yProps,
    isHighContrast: settings?.highContrast ?? false,
    isLargeText: settings?.largeText ?? false,
    isReducedMotion: settings?.reducedMotion ?? false
  }
}