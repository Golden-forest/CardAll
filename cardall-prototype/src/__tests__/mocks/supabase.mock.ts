/**
 * Supabase Mock for Testing
 * 提供完整的Supabase API模拟用于单元测试
 */

// Supabase 客户端模拟
export const createMockSupabaseClient = () => {
  const mockClient = {
    from: jest.fn(),
    auth: {
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
      getSession: jest.fn(),
    },
    storage: {
      from: jest.fn(),
    },
    realtime: {
      channel: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  }

  return mockClient
}

// Supabase 查询构建器模拟
export const createMockQueryBuilder = (data: any[] = [], error: any = null) => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ data, error }),
  }

  return mockBuilder
}

// Supabase Storage 模拟
export const createMockStorage = () => {
  const mockStorage = {
    upload: jest.fn(),
    download: jest.fn(),
    getPublicUrl: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
    createSignedUrl: jest.fn(),
  }

  return mockStorage
}

// Supabase Realtime 模拟
export const createMockRealtime = () => {
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    send: jest.fn(),
    listen: jest.fn(),
  }

  const mockRealtime = {
    channel: jest.fn().mockReturnValue(mockChannel),
    channels: jest.fn().mockReturnValue([mockChannel]),
    closeAllChannels: jest.fn(),
  }

  return mockRealtime
}

// 常用测试数据
export const mockSupabaseTestData = {
  cards: [
    {
      id: 'test-card-1',
      title: 'Test Card 1',
      content: 'Test content 1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_id: 'test-user-1',
      folder_id: 'test-folder-1',
    },
    {
      id: 'test-card-2',
      title: 'Test Card 2',
      content: 'Test content 2',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      user_id: 'test-user-1',
      folder_id: 'test-folder-1',
    },
  ],
  folders: [
    {
      id: 'test-folder-1',
      name: 'Test Folder',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      user_id: 'test-user-1',
    },
  ],
  tags: [
    {
      id: 'test-tag-1',
      name: 'Test Tag',
      color: '#ff0000',
      created_at: '2024-01-01T00:00:00Z',
      user_id: 'test-user-1',
    },
  ],
  users: [
    {
      id: 'test-user-1',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ],
}

// 模拟错误响应
export const mockSupabaseErrors = {
  networkError: new Error('Network Error'),
  authError: {
    message: 'Invalid login credentials',
    status: 401,
  },
  dataError: {
    message: 'Invalid data format',
    status: 400,
  },
  notFound: {
    message: 'Not found',
    status: 404,
  },
  serverError: {
    message: 'Internal server error',
    status: 500,
  },
}

// 创建模拟的Supabase客户端实例
export const mockSupabaseClient = createMockSupabaseClient()

// 设置默认的mock行为
mockSupabaseClient.from.mockImplementation((table: string) => {
  switch (table) {
    case 'cards':
      return createMockQueryBuilder(mockSupabaseTestData.cards)
    case 'folders':
      return createMockQueryBuilder(mockSupabaseTestData.folders)
    case 'tags':
      return createMockQueryBuilder(mockSupabaseTestData.tags)
    case 'users':
      return createMockQueryBuilder(mockSupabaseTestData.users)
    default:
      return createMockQueryBuilder([])
  }
})

export default mockSupabaseClient