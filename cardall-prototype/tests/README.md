# 测试配置文件

## 测试环境变量
在 `.env.test` 文件中设置测试环境特定的变量：

```bash
VITE_SUPABASE_URL=https://test.supabase.co
VITE_SUPABASE_ANON_KEY=test-anon-key
VITE_APP_ENV=test
```

## 测试目录结构

```
tests/
├── __tests__/                 # Jest 自动发现的测试文件
├── unit/                      # 单元测试
│   ├── components/           # 组件测试
│   │   ├── card/            # 卡片相关组件测试
│   │   ├── dashboard/       # 仪表板组件测试
│   │   ├── ui/              # UI 组件测试
│   │   └── accessibility/   # 可访问性组件测试
│   ├── hooks/               # 自定义 Hook 测试
│   │   ├── use-folders.ts
│   │   ├── use-tags.ts
│   │   ├── use-accessibility.ts
│   │   └── use-responsive.ts
│   ├── services/            # 服务层测试
│   │   ├── cloud-sync.ts
│   │   ├── database.ts
│   │   └── auth.ts
│   └── utils/               # 工具函数测试
│       ├── accessibility.ts
│       └── storage.ts
├── integration/              # 集成测试
│   ├── database/            # 数据库集成测试
│   ├── sync/                # 同步系统集成测试
│   └── api/                 # API 集成测试
├── e2e/                     # 端到端测试
│   ├── auth/                # 认证流程测试
│   ├── card-operations/     # 卡片操作测试
│   └── sync-workflows/      # 同步工作流测试
├── accessibility/           # 可访问性测试
├── performance/             # 性能测试
├── fixtures/                # 测试夹具和数据
│   ├── data-fixtures.ts     # 数据夹具
│   ├── mock-services.ts     # 模拟服务
│   └── test-utils.tsx       # 测试工具
└── setup/                   # 测试设置文件
    ├── jest.setup.js        # Jest 设置
    └── msw-setup.ts         # MSW 设置
```

## 测试命名约定

### 文件命名
- 组件测试: `ComponentName.test.tsx`
- Hook 测试: `useHookName.test.ts`
- 服务测试: `ServiceName.test.ts`
- 集成测试: `FeatureName.integration.test.ts`
- E2E 测试: `WorkflowName.e2e.test.ts`

### 测试命名
- 使用 `describe` 组织相关测试
- 使用 `it` 或 `test` 定义单个测试用例
- 测试名称应该描述测试的行为，而不是实现细节

```typescript
// ✅ 好的命名
describe('Card component', () => {
  it('should render with correct title', () => {
    // 测试代码
  })
  
  it('should flip when clicked', () => {
    // 测试代码
  })
})

// ❌ 避免的命名
describe('Card component', () => {
  it('should call useState with initial props', () => {
    // 测试实现细节
  })
})
```

## 测试最佳实践

### 1. 单元测试原则
- **快速**: 每个测试应该在毫秒级别完成
- **隔离**: 每个测试应该独立运行
- **可重复**: 测试结果应该是一致的
- **自我验证**: 测试应该自动通过或失败

### 2. 组件测试
- 测试渲染和用户交互
- 模拟子组件和外部依赖
- 测试可访问性属性
- 测试错误边界

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Card } from '@/components/card/flip-card'

describe('Card component', () => {
  it('should render card with title and content', () => {
    render(<Card title="Test Card" content="Test content" />)
    
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
  
  it('should flip when clicked', async () => {
    const onFlip = jest.fn()
    render(<Card title="Test Card" content="Test content" onFlip={onFlip} />)
    
    const card = screen.getByText('Test Card')
    fireEvent.click(card)
    
    await waitFor(() => {
      expect(onFlip).toHaveBeenCalled()
    })
  })
  
  it('should be accessible', async () => {
    const { container } = render(<Card title="Test Card" content="Test content" />)
    
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

### 3. Hook 测试
- 使用 `@testing-library/react-hooks`
- 测试状态变化和副作用
- 测试错误处理

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCardOperations } from '@/hooks/use-card-operations'

describe('useCardOperations hook', () => {
  it('should create card successfully', async () => {
    const { result } = renderHook(() => useCardOperations())
    
    await act(async () => {
      await result.current.createCard({ title: 'Test Card', content: 'Test content' })
    })
    
    expect(result.current.cards).toHaveLength(1)
    expect(result.current.cards[0].title).toBe('Test Card')
  })
  
  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useCardOperations())
    
    await act(async () => {
      await expect(result.current.createCard({})).rejects.toThrow()
    })
    
    expect(result.current.error).toBeDefined()
  })
})
```

### 4. 服务测试
- 模拟外部 API 调用
- 测试错误处理
- 测试数据转换

```typescript
import { cloudSyncService } from '@/services/cloud-sync'
import { mockServer } from '@/tests/fixtures/mock-services'

describe('Cloud sync service', () => {
  beforeAll(() => {
    mockServer.listen()
  })
  
  afterEach(() => {
    mockServer.resetHandlers()
  })
  
  afterAll(() => {
    mockServer.close()
  })
  
  it('should sync data successfully', async () => {
    const data = { title: 'Test Card', content: 'Test content' }
    
    await expect(cloudSyncService.syncData(data)).resolves.not.toThrow()
  })
  
  it('should handle network errors', async () => {
    mockServer.use(
      rest.post('/api/sync', (req, res, ctx) => {
        return res.networkError('Failed to connect')
      })
    )
    
    await expect(cloudSyncService.syncData({})).rejects.toThrow()
  })
})
```

### 5. 集成测试
- 测试多个组件的交互
- 测试数据流
- 测试用户流程

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CardOperationsProvider } from '@/contexts/cardall-context'
import { Dashboard } from '@/components/dashboard/dashboard-main'

describe('Card operations integration', () => {
  it('should allow creating and editing cards', async () => {
    render(
      <CardOperationsProvider>
        <Dashboard />
      </CardOperationsProvider>
    )
    
    // 创建卡片
    const createButton = screen.getByText('Create Card')
    fireEvent.click(createButton)
    
    const titleInput = screen.getByPlaceholderText('Card title')
    fireEvent.change(titleInput, { target: { value: 'Test Card' } })
    
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)
    
    // 验证卡片创建成功
    await waitFor(() => {
      expect(screen.getByText('Test Card')).toBeInTheDocument()
    })
    
    // 编辑卡片
    const card = screen.getByText('Test Card')
    fireEvent.doubleClick(card)
    
    const editInput = screen.getByDisplayValue('Test Card')
    fireEvent.change(editInput, { target: { value: 'Updated Card' } })
    
    const updateButton = screen.getByText('Update')
    fireEvent.click(updateButton)
    
    // 验证卡片更新成功
    await waitFor(() => {
      expect(screen.getByText('Updated Card')).toBeInTheDocument()
    })
  })
})
```

### 6. 可访问性测试
- 使用 `axe-core` 进行自动化测试
- 测试键盘导航
- 测试屏幕阅读器支持

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Card } from '@/components/card/flip-card'

describe('Card accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Card title="Test Card" content="Test content" />)
    
    expect(await axe(container)).toHaveNoViolations()
  })
  
  it('should be keyboard navigable', () => {
    render(<Card title="Test Card" content="Test content" />)
    
    const card = screen.getByText('Test Card')
    
    // 测试 Tab 键导航
    fireEvent.keyDown(card, { key: 'Tab' })
    expect(card).toHaveFocus()
    
    // 测试空格键激活
    fireEvent.keyDown(card, { key: ' ' })
    expect(card).toHaveAttribute('aria-expanded', 'true')
  })
  
  it('should have proper ARIA attributes', () => {
    render(<Card title="Test Card" content="Test content" />)
    
    const card = screen.getByText('Test Card')
    expect(card).toHaveAttribute('role', 'article')
    expect(card).toHaveAttribute('aria-label', 'Test Card')
  })
})
```

### 7. 性能测试
- 测试渲染性能
- 测试内存使用
- 测试大量数据处理

```typescript
import { render, screen } from '@testing-library/react'
import { CardGrid } from '@/components/card/responsive-card-grid'
import { performanceUtils } from '@/tests/test-utils'

describe('Card performance', () => {
  it('should render 100 cards efficiently', async () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({
      id: `card-${i}`,
      title: `Card ${i}`,
      content: `Content ${i}`,
    }))
    
    const renderTime = await performanceUtils.measureRenderTime(() => {
      render(<CardGrid cards={cards} />)
    })
    
    expect(renderTime).toBeLessThan(1000) // 1秒内完成渲染
  })
  
  it('should handle memory efficiently', () => {
    const { unmount } = render(<CardGrid cards={largeDataSet} />)
    
    const initialMemory = performanceUtils.measureMemoryUsage()
    unmount()
    
    const finalMemory = performanceUtils.measureMemoryUsage()
    const memoryDiff = finalMemory.used - initialMemory.used
    
    expect(memoryDiff).toBeLessThan(1024 * 1024) // 内存增长小于 1MB
  })
})
```

## 测试覆盖率目标

- **单元测试**: 80%+
- **集成测试**: 70%+
- **E2E 测试**: 核心流程 100%
- **可访问性测试**: 100% WCAG 2.1 AA 合规

## 持续集成配置

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          
      - run: npm ci
      - run: npm run test:ci
      - run: npm run build
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- card.test.tsx

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行可访问性测试
npm run test:accessibility

# 运行性能测试
npm run test:performance
```

## 调试测试

```bash
# 运行单个测试文件并显示详细输出
npm run test:debug -- card.test.tsx

# 运行测试并显示覆盖率
npm run test:coverage

# 运行测试并生成 HTML 报告
npm run test:coverage -- --coverageReporters=html
```

## 测试故障排除

### 常见问题

1. **Jest 配置问题**
   - 检查 `jest.config.ts` 配置
   - 确保 `transform` 配置正确
   - 检查 `moduleNameMapping` 配置

2. **MSW 模拟问题**
   - 确保正确启动和关闭模拟服务器
   - 检查请求路径匹配
   - 确保在测试后重置处理器

3. **测试依赖问题**
   - 确保所有测试依赖正确安装
   - 检查 TypeScript 配置
   - 确保测试文件正确导入

4. **性能问题**
   - 使用 `--runInBand` 运行性能测试
   - 考虑使用 `--maxWorkers=1` 减少并发
   - 使用 `--testTimeout` 增加超时时间

### 调试技巧

1. **使用 `console.log` 调试**
   ```typescript
   test('debug example', () => {
     console.log('Debug information')
     // 测试代码
   })
   ```

2. **使用 `--verbose` 运行测试**
   ```bash
   npm test -- --verbose
   ```

3. **使用 `--testNamePattern` 过滤测试**
   ```bash
   npm test -- --testNamePattern="should render"
   ```

4. **使用 `--onlyChanged` 只运行变更的测试**
   ```bash
   npm test -- --onlyChanged
   ```

## 测试文档

### 组件测试文档
每个组件测试应该包含：
- 组件的基本功能测试
- 用户交互测试
- 错误处理测试
- 可访问性测试
- 性能测试（如适用）

### Hook 测试文档
每个 Hook 测试应该包含：
- 初始状态测试
- 状态变化测试
- 副作用测试
- 错误处理测试
- 清理函数测试

### 服务测试文档
每个服务测试应该包含：
- 正常流程测试
- 错误处理测试
- 边界条件测试
- 数据转换测试

### 集成测试文档
每个集成测试应该包含：
- 端到端流程测试
- 数据流测试
- 错误恢复测试
- 性能测试

通过遵循这些测试配置和最佳实践，可以确保 CardAll 项目的测试覆盖率和质量。