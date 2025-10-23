/**
 * 新用户引导组件
 * 提供交互式的功能介绍和操作指南
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { secureStorage } from '@/utils/secure-storage'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  content: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  position?: 'center' | 'left' | 'right' | 'bottom'
  highlight?: string // CSS selector for element to highlight
}

export interface UserOnboardingProps {
  steps: OnboardingStep[]
  onComplete?: () => void
  onSkip?: () => void
  autoShow?: boolean
  showProgress?: boolean
}

export function UserOnboarding({
  steps,
  onComplete,
  onSkip,
  autoShow = true,
  showProgress = true
}: UserOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // 检查是否已经完成引导
  useEffect(() => {
    const completed = secureStorage.get<boolean>('onboarding-completed', {
      validate: true
    })

    if (completed) {
      setIsCompleted(true)
    } else if (autoShow) {
      // 延迟显示，让用户先看到界面
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [autoShow])

  // 处理引导完成
  const handleComplete = () => {
    setIsVisible(false)
    setIsCompleted(true)
    secureStorage.set('onboarding-completed', true, {
      validate: true
    })
    onComplete?.()
  }

  // 处理跳过引导
  const handleSkip = () => {
    setIsVisible(false)
    onSkip?.()
  }

  // 下一步
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  // 上一步
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // 重新开始引导
  const restartOnboarding = () => {
    secureStorage.remove('onboarding-completed')
    setIsCompleted(false)
    setIsVisible(true)
    setCurrentStep(0)
  }

  if (isCompleted) {
    return (
      <div className=\"fixed bottom-4 right-4 z-50\">
        <Button
          variant=\"outline\"
          size=\"sm\"
          onClick={restartOnboarding}
          className=\"shadow-lg\"
        >
          <span className=\"mr-2\">💡</span>
          重新查看引导
        </Button>
      </div>
    )
  }

  if (!isVisible || !steps[currentStep]) {
    return null
  }

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <>
      {/* 背景遮罩 */}
      <div className=\"fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300\" />

      {/* 引导内容 */}
      <div className=\"fixed inset-0 z-50 flex items-center justify-center p-4\">
        <div className=\"max-w-md w-full max-h-[90vh] overflow-y-auto\">
          <Card className=\"shadow-2xl border-2 border-primary/20\">
            <CardHeader className=\"text-center\">
              {showProgress && (
                <div className=\"mb-4\">
                  <div className=\"flex justify-between text-sm text-muted-foreground mb-2\">
                    <span>步骤 {currentStep + 1} / {steps.length}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className=\"w-full bg-secondary rounded-full h-2\">
                    <div
                      className=\"bg-primary h-2 rounded-full transition-all duration-300\"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <CardTitle className=\"text-xl font-bold flex items-center justify-center gap-2\">
                <span className=\"text-2xl\">{getStepIcon(currentStep)}</span>
                {step.title}
              </CardTitle>
              <CardDescription className=\"text-base mt-2\">
                {step.description}
              </CardDescription>
            </CardHeader>

            <CardContent className=\"space-y-4\">
              {step.content}

              {/* 快捷功能提示 */}
              <div className=\"grid grid-cols-2 gap-2 text-sm\">
                <div className=\"p-2 bg-muted rounded text-center\">
                  <div className=\"font-medium\">快捷键</div>
                  <div className=\"text-muted-foreground\">Ctrl/Cmd + K</div>
                </div>
                <div className=\"p-2 bg-muted rounded text-center\">
                  <div className=\"font-medium\">搜索</div>
                  <div className=\"text-muted-foreground\">Ctrl/Cmd + F</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className=\"flex justify-between pt-4\">
                <Button
                  variant=\"outline\"
                  onClick={handleSkip}
                  className=\"text-muted-foreground\"
                >
                  跳过引导
                </Button>

                <div className=\"flex gap-2\">
                  {currentStep > 0 && (
                    <Button variant=\"outline\" onClick={handlePrevious}>
                      上一步
                    </Button>
                  )}

                  {step.action ? (
                    <Button onClick={step.action.onClick}>
                      {step.action.label}
                    </Button>
                  ) : (
                    <Button onClick={handleNext}>
                      {currentStep === steps.length - 1 ? '完成' : '下一步'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

// 获取步骤图标
function getStepIcon(stepIndex: number): string {
  const icons = ['👋', '🎯', '✨', '🚀', '💎']
  return icons[stepIndex % icons.length]
}

// 预定义的引导步骤
export const createCardOnboardingSteps = (): OnboardingStep[] => [
  {
    id: 'welcome',
    title: '欢迎使用 CardEverything',
    description: '让我们一起开始创建您的第一张知识卡片',
    content: (
      <div className=\"space-y-4 text-center\">
        <div className=\"text-4xl mb-4\">🎉</div>
        <p className=\"text-muted-foreground\">
          CardEverything 是一个强大的知识管理工具，帮助您整理、学习和分享知识。
        </p>
        <div className=\"flex justify-center gap-2\">
          <Badge variant=\"secondary\">📚 知识管理</Badge>
          <Badge variant=\"secondary\">🔄 智能同步</Badge>
          <Badge variant=\"secondary\">🎨 个性化样式</Badge>
        </div>
      </div>
    ),
    position: 'center'
  },
  {
    id: 'create-card',
    title: '创建您的第一张卡片',
    description: '点击按钮创建新卡片，开始您的知识之旅',
    content: (
      <div className=\"space-y-4\">
        <div className=\"p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800\">
          <h4 className=\"font-medium text-blue-900 dark:text-blue-100 mb-2\">
            💡 卡片包含什么？
          </h4>
          <ul className=\"text-sm text-blue-700 dark:text-blue-300 space-y-1\">
            <li>• 正面内容：问题、概念或要点</li>
            <li>• 背面内容：答案、解释或详细信息</li>
            <li>• 标签：分类和检索</li>
            <li>• 样式：个性化外观</li>
          </ul>
        </div>
        <div className=\"text-center text-sm text-muted-foreground\">
          点击右下角的 + 按钮开始创建
        </div>
      </div>
    ),
    action: {
      label: '创建第一张卡片',
      onClick: () => {
        // 触发创建卡片动作
        document.querySelector('[data-action=\"create-card\"]')?.querySelector('button')?.click()
      }
    }
  },
  {
    id: 'organize-folders',
    title: '整理您的文件夹',
    description: '使用文件夹来组织您的卡片，让知识更有条理',
    content: (
      <div className=\"space-y-4\">
        <div className=\"grid grid-cols-2 gap-4 text-center\">
          <div className=\"p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800\">
            <div className=\"text-2xl mb-2\">📁</div>
            <div className=\"font-medium text-green-900 dark:text-green-100\">项目文件夹</div>
            <div className=\"text-xs text-green-700 dark:text-green-300\">按项目分类</div>
          </div>
          <div className=\"p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800\">
            <div className=\"text-2xl mb-2\">🏷️</div>
            <div className=\"font-medium text-purple-900 dark:text-purple-100\">主题文件夹</div>
            <div className=\"text-xs text-purple-700 dark:text-purple-300\">按主题分类</div>
          </div>
        </div>
        <div className=\"text-sm text-muted-foreground text-center\">
          您可以通过拖拽将卡片移动到不同文件夹
        </div>
      </div>
    )
  },
  {
    id: 'sync-cloud',
    title: '云端同步功能',
    description: '您的数据会自动同步到云端，随时随地访问',
    content: (
      <div className=\"space-y-4\">
        <div className=\"p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800\">
          <h4 className=\"font-medium text-orange-900 dark:text-orange-100 mb-2\">
            🌐 同步功能特点
          </h4>
          <ul className=\"text-sm text-orange-700 dark:text-orange-300 space-y-1\">
            <li>• 实时同步：数据变更立即上传</li>
            <li>• 离线支持：无网络时也能使用</li>
            <li>• 多设备：在所有设备上同步</li>
            <li>• 版本控制：自动备份历史版本</li>
          </ul>
        </div>
        <div className=\"text-center text-sm text-muted-foreground\">
          状态指示器会显示当前的同步状态
        </div>
      </div>
    )
  },
  {
    id: 'ready-start',
    title: '准备开始！',
    description: '您已经了解了所有基础功能，开始使用吧！',
    content: (
      <div className=\"space-y-4 text-center\">
        <div className=\"text-4xl mb-4\">🎊</div>
        <div className=\"space-y-2\">
          <p className=\"font-medium\">恭喜您完成了引导！</p>
          <p className=\"text-sm text-muted-foreground\">
            记住，您可以随时通过右下角的按钮重新查看这个引导。
          </p>
        </div>
        <div className=\"flex justify-center gap-2 pt-2\">
          <Badge variant=\"outline\">📖 帮助文档</Badge>
          <Badge variant=\"outline\">⚙️ 设置</Badge>
          <Badge variant=\"outline\">💬 反馈</Badge>
        </div>
      </div>
    )
  }
]

// 引导控制器 Hook
export function useUserOnboarding() {
  const [isVisible, setIsVisible] = useState(false)

  const showOnboarding = () => {
    secureStorage.remove('onboarding-completed')
    setIsVisible(true)
  }

  const hideOnboarding = () => {
    setIsVisible(false)
  }

  const isOnboardingCompleted = () => {
    return secureStorage.get<boolean>('onboarding-completed', {
      validate: true
    }) ?? false
  }

  return {
    isVisible,
    showOnboarding,
    hideOnboarding,
    isOnboardingCompleted
  }
}