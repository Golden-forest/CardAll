// 测试相关的类型定义

// 扩展 Jest 类型
declare namespace jest {
  interface Matchers<R> {
    /**
     * 检查元素是否通过可访问性测试
     */
    toHaveNoViolations(): R
    
    /**
     * 检查元素是否具有特定的 ARIA 属性
     */
    toHaveAriaAttribute(attr: string, value?: string): R
    
    /**
     * 检查元素是否可被聚焦
     */
    toBeFocusable(): R
    
    /**
     * 检查元素是否具有特定的角色
     */
    toHaveRole(role: string): R
  }
}

// 测试工具函数类型
export interface TestHelpers {
  /**
   * 创建模拟的用户数据
   */
  createMockUser: (overrides?: Partial<User>) => User
  
  /**
   * 创建模拟的卡片数据
   */
  createMockCard: (overrides?: Partial<Card>) => Card
  
  /**
   * 创建模拟的文件夹数据
   */
  createMockFolder: (overrides?: Partial<Folder>) => Folder
  
  /**
   * 创建模拟的标签数据
   */
  createMockTag: (overrides?: Partial<Tag>) => Tag
  
  /**
   * 等待特定时间
   */
  waitFor: (ms: number) => Promise<void>
  
  /**
   * 等待元素出现
   */
  waitForElement: (selector: string) => Promise<Element>
  
  /**
   * 模拟网络请求
   */
  mockNetworkRequest: (url: string, response: any, options?: RequestInit) => void
  
  /**
   * 模拟网络错误
   */
  mockNetworkError: (url: string, error: Error) => void
  
  /**
   * 清除所有网络模拟
   */
  clearNetworkMocks: () => void
}

// 测试夹具类型
export interface TestFixtures {
  /**
   * 基础用户数据
   */
  user: User
  
  /**
   * 基础卡片数据
   */
  card: Card
  
  /**
   * 基础文件夹数据
   */
  folder: Folder
  
  /**
   * 基础标签数据
   */
  tag: Tag
  
  /**
   * 模拟的 Supabase 客户端
   */
  mockSupabase: any
  
  /**
   * 模拟的 Dexie 数据库
   */
  mockDexie: any
}

// 测试环境配置类型
export interface TestEnvironment {
  /**
   * 测试环境 URL
   */
  url: string
  
  /**
   * 测试环境超时时间
   */
  timeout: number
  
  /**
   * 是否启用详细日志
   */
  verbose: boolean
  
  /**
   * 是否启用可访问性测试
   */
  enableAccessibility: boolean
  
  /**
   * 是否启用性能测试
   */
  enablePerformance: boolean
}

// 测试结果类型
export interface TestResult {
  /**
   * 测试名称
   */
  name: string
  
  /**
   * 测试状态
   */
  status: 'passed' | 'failed' | 'skipped' | 'pending'
  
  /**
   * 测试耗时
   */
  duration: number
  
  /**
   * 测试错误信息
   */
  error?: Error
  
  /**
   * 测试覆盖率
   */
  coverage?: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
}

// 性能测试类型
export interface PerformanceMetrics {
  /**
   * 渲染时间
   */
  renderTime: number
  
  /**
   * 内存使用
   */
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  
  /**
   * 组件重新渲染次数
   */
  reRenders: number
  
  /**
   * DOM 操作次数
   */
  domOperations: number
}

// E2E 测试类型
export interface E2ETestConfig {
  /**
   * 测试浏览器
   */
  browser: 'chromium' | 'firefox' | 'webkit'
  
  /**
   * 测试视口大小
   */
  viewport: {
    width: number
    height: number
  }
  
  /**
   * 测试设备类型
   */
  device?: 'desktop' | 'mobile' | 'tablet'
  
  /**
   * 测试地理位置
   */
  geolocation?: {
    latitude: number
    longitude: number
  }
  
  /**
   * 测试权限
   */
  permissions?: {
    notifications?: 'granted' | 'denied' | 'prompt'
    geolocation?: 'granted' | 'denied' | 'prompt'
    camera?: 'granted' | 'denied' | 'prompt'
  }
}

// 可访问性测试类型
export interface AccessibilityTest {
  /**
   * WCAG 2.1 AA 合规性
   */
  wcagCompliance: {
    passed: number
    failed: number
    violations: AxeViolation[]
  }
  
  /**
   * 键盘导航测试
   */
  keyboardNavigation: {
    canAccessAllElements: boolean
    hasVisibleFocus: boolean
    tabOrder: string[]
  }
  
  /**
   * 屏幕阅读器测试
   */
  screenReader: {
    hasProperLabels: boolean
    hasProperRoles: boolean
    hasProperStates: boolean
  }
  
  /**
   * 颜色对比度测试
   */
  colorContrast: {
    textElements: ContrastResult[]
    interactiveElements: ContrastResult[]
  }
}

// 辅助类型
export interface ContrastResult {
  element: string
  contrastRatio: number
  passes: boolean
  threshold: number
}

export interface AxeViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  nodes: AxeNode[]
}

export interface AxeNode {
  html: string
  target: string[]
  failureSummary: string
  any: AxeCheck[]
  all: AxeCheck[]
  none: AxeCheck[]
}

export interface AxeCheck {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  message: string
  data: any
}