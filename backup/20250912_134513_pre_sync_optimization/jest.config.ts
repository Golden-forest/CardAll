import type { Config } from 'jest'

// Jest 的自定义配置
const config: Config = {
  // 添加更多设置选项在此行下方
  testEnvironment: 'jsdom',
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/file-mock.js',
  },
  
  // 测试覆盖配置
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // 测试匹配模式
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)',
  ],
  
  // 测试路径忽略
  testPathIgnorePatterns: [
    '<rootDir>/tests/e2e/',
  ],
  
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // 转换配置
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  
  // 忽略转换
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
    '\\.css$',
    '\\.svg$',
    '\\.png$',
    '\\.jpg$',
    '\\.jpeg$',
    '\\.gif$',
  ],
  
  // 测试环境变量
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
  
  // 慢速测试阈值
  slowTestThreshold: 15,
  
  // 并行测试
  maxWorkers: '50%',
  
  // 覆盖率报告目录
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // 清除模拟调用
  clearMocks: true,
  
  // 重置模拟状态
  resetMocks: false,
  
  // 恢复模拟实现
  restoreMocks: false,
}

export default config