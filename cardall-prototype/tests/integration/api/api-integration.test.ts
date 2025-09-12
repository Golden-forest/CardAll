// API集成测试
import { cloudSyncService } from '@/services/cloud-sync'
import { mockServer } from '@/tests/fixtures/mock-services'
import { mockDataUtils } from '@/tests/test-utils'

// 设置测试环境
beforeAll(() => {
  mockServer.listen()
})

beforeEach(() => {
  mockServer.resetHandlers()
})

afterAll(() => {
  mockServer.close()
})

describe('API Integration', () => {
  describe('卡片API集成', () => {
    it('应该能够创建卡片', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              ...cardData,
              id: 'new-card-id',
              created_at: new Date().toISOString(),
            })
          )
        })
      )
      
      const result = await cloudSyncService.createCard(cardData)
      
      expect(result).toBeDefined()
      expect(result.id).toBe('new-card-id')
      expect(result.title).toBe(cardData.title)
    })

    it('应该能够获取卡片列表', async () => {
      const cards = mockDataUtils.generateCards(5)
      
      // 模拟成功响应
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(cards)
          )
        })
      )
      
      const result = await cloudSyncService.getCards()
      
      expect(result).toHaveLength(5)
      expect(result[0].title).toBe(cards[0].title)
    })

    it('应该能够更新卡片', async () => {
      const cardId = 'test-card-id'
      const updateData = { title: 'Updated Title' }
      
      // 模拟成功响应
      mockServer.use(
        rest.patch(`https://test.supabase.co/rest/v1/cards?id=eq.${cardId}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              id: cardId,
              title: 'Updated Title',
              updated_at: new Date().toISOString(),
            })
          )
        })
      )
      
      const result = await cloudSyncService.updateCard(cardId, updateData)
      
      expect(result).toBeDefined()
      expect(result.id).toBe(cardId)
      expect(result.title).toBe('Updated Title')
    })

    it('应该能够删除卡片', async () => {
      const cardId = 'test-card-id'
      
      // 模拟成功响应
      mockServer.use(
        rest.delete(`https://test.supabase.co/rest/v1/cards?id=eq.${cardId}`, (req, res, ctx) => {
          return res(ctx.status(204))
        })
      )
      
      await expect(cloudSyncService.deleteCard(cardId)).resolves.not.toThrow()
    })

    it('应该能够按条件查询卡片', async () => {
      const cards = [
        mockDataUtils.generateTestCard({ title: 'React Card' }),
        mockDataUtils.generateTestCard({ title: 'Vue Card' }),
        mockDataUtils.generateTestCard({ title: 'Angular Card' }),
      ]
      
      // 模拟搜索响应
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          const url = new URL(req.url)
          const search = url.searchParams.get('title')
          
          if (search) {
            const filtered = cards.filter(card => 
              card.title.toLowerCase().includes(search.toLowerCase())
            )
            return res(ctx.status(200), ctx.json(filtered))
          }
          
          return res(ctx.status(200), ctx.json(cards))
        })
      )
      
      // 搜索包含"React"的卡片
      const reactCards = await cloudSyncService.searchCards({ title: 'React' })
      expect(reactCards).toHaveLength(1)
      expect(reactCards[0].title).toBe('React Card')
      
      // 获取所有卡片
      const allCards = await cloudSyncService.getCards()
      expect(allCards).toHaveLength(3)
    })
  })

  describe('文件夹API集成', () => {
    it('应该能够创建文件夹', async () => {
      const folderData = mockDataUtils.generateTestFolder()
      
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/folders', (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              ...folderData,
              id: 'new-folder-id',
              created_at: new Date().toISOString(),
            })
          )
        })
      )
      
      const result = await cloudSyncService.createFolder(folderData)
      
      expect(result).toBeDefined()
      expect(result.id).toBe('new-folder-id')
      expect(result.name).toBe(folderData.name)
    })

    it('应该能够获取文件夹层次结构', async () => {
      const folders = [
        mockDataUtils.generateTestFolder({ name: 'Root', parentId: null }),
        mockDataUtils.generateTestFolder({ name: 'Sub', parentId: 'folder-1' }),
        mockDataUtils.generateTestFolder({ name: 'Deep', parentId: 'folder-2' }),
      ]
      
      // 模拟成功响应
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/folders', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(folders))
        })
      )
      
      const result = await cloudSyncService.getFolders()
      
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Root')
      expect(result[1].parentId).toBe('folder-1')
    })

    it('应该能够移动文件夹', async () => {
      const folderId = 'test-folder-id'
      const newParentId = 'new-parent-id'
      
      // 模拟成功响应
      mockServer.use(
        rest.patch(`https://test.supabase.co/rest/v1/folders?id=eq.${folderId}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              id: folderId,
              parent_id: newParentId,
              updated_at: new Date().toISOString(),
            })
          )
        })
      )
      
      const result = await cloudSyncService.moveFolder(folderId, newParentId)
      
      expect(result).toBeDefined()
      expect(result.parentId).toBe(newParentId)
    })
  })

  describe('标签API集成', () => {
    it('应该能够创建标签', async () => {
      const tagData = mockDataUtils.generateTestTag()
      
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/tags', (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              ...tagData,
              id: 'new-tag-id',
              created_at: new Date().toISOString(),
            })
          )
        })
      )
      
      const result = await cloudSyncService.createTag(tagData)
      
      expect(result).toBeDefined()
      expect(result.id).toBe('new-tag-id')
      expect(result.name).toBe(tagData.name)
    })

    it('应该能够获取标签列表', async () => {
      const tags = mockDataUtils.generateTags(10)
      
      // 模拟成功响应
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/tags', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(tags))
        })
      )
      
      const result = await cloudSyncService.getTags()
      
      expect(result).toHaveLength(10)
      expect(result[0].name).toBe(tags[0].name)
    })

    it('应该能够为卡片添加标签', async () => {
      const cardId = 'test-card-id'
      const tagId = 'test-tag-id'
      
      // 模拟成功响应
      mockServer.use(
        rest.post(`https://test.supabase.co/rest/v1/card_tags`, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              card_id: cardId,
              tag_id: tagId,
              created_at: new Date().toISOString(),
            })
          )
        })
      )
      
      const result = await cloudSyncService.addTagToCard(cardId, tagId)
      
      expect(result).toBeDefined()
      expect(result.cardId).toBe(cardId)
      expect(result.tagId).toBe(tagId)
    })

    it('应该能够从卡片移除标签', async () => {
      const cardId = 'test-card-id'
      const tagId = 'test-tag-id'
      
      // 模拟成功响应
      mockServer.use(
        rest.delete(`https://test.supabase.co/rest/v1/card_tags?card_id=eq.${cardId}&tag_id=eq.${tagId}`, (req, res, ctx) => {
          return res(ctx.status(204))
        })
      )
      
      await expect(cloudSyncService.removeTagFromCard(cardId, tagId)).resolves.not.toThrow()
    })
  })

  describe('认证API集成', () => {
    it('应该能够注册用户', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      }
      
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/auth/v1/signup', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              user: {
                id: 'test-user-id',
                email: userData.email,
                created_at: new Date().toISOString(),
              },
              session: {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600,
              },
            })
          )
        })
      )
      
      const result = await cloudSyncService.signUp(userData)
      
      expect(result).toBeDefined()
      expect(result.user.id).toBe('test-user-id')
      expect(result.user.email).toBe(userData.email)
      expect(result.session.access_token).toBe('test-access-token')
    })

    it('应该能够登录用户', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      }
      
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/auth/v1/token?grant_type=password', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              user: {
                id: 'test-user-id',
                email: loginData.email,
                created_at: new Date().toISOString(),
              },
              session: {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600,
              },
            })
          )
        })
      )
      
      const result = await cloudSyncService.signIn(loginData)
      
      expect(result).toBeDefined()
      expect(result.user.id).toBe('test-user-id')
      expect(result.session.access_token).toBe('test-access-token')
    })

    it('应该能够刷新访问令牌', async () => {
      const refreshToken = 'test-refresh-token'
      
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/auth/v1/token?grant_type=refresh_token', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
              expires_in: 3600,
            })
          )
        })
      )
      
      const result = await cloudSyncService.refreshToken(refreshToken)
      
      expect(result).toBeDefined()
      expect(result.access_token).toBe('new-access-token')
      expect(result.refresh_token).toBe('new-refresh-token')
    })

    it('应该能够登出用户', async () => {
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/auth/v1/logout', (req, res, ctx) => {
          return res(ctx.status(200))
        })
      )
      
      await expect(cloudSyncService.signOut()).resolves.not.toThrow()
    })
  })

  describe('文件上传API集成', () => {
    it('应该能够上传图片', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      // 模拟成功响应
      mockServer.use(
        rest.post('https://test.supabase.co/storage/v1/object/card-images/test.jpg', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              Key: 'test.jpg',
              Location: 'https://test.supabase.co/storage/v1/object/public/card-images/test.jpg',
            })
          )
        })
      )
      
      const result = await cloudSyncService.uploadImage(file)
      
      expect(result).toBeDefined()
      expect(result.Key).toBe('test.jpg')
      expect(result.Location).toContain('test.jpg')
    })

    it('应该能够删除图片', async () => {
      const fileName = 'test.jpg'
      
      // 模拟成功响应
      mockServer.use(
        rest.delete('https://test.supabase.co/storage/v1/object/card-images/test.jpg', (req, res, ctx) => {
          return res(ctx.status(200))
        })
      )
      
      await expect(cloudSyncService.deleteImage(fileName)).resolves.not.toThrow()
    })

    it('应该能够获取图片URL', async () => {
      const fileName = 'test.jpg'
      
      // 模拟成功响应
      mockServer.use(
        rest.get('https://test.supabase.co/storage/v1/object/public/card-images/test.jpg', (req, res) => {
          return res(
            200,
            { 'Content-Type': 'image/jpeg' },
            'test-image-data'
          )
        })
      )
      
      const result = await cloudSyncService.getImageUrl(fileName)
      
      expect(result).toBeDefined()
      expect(result).toContain('test.jpg')
    })
  })

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      // 模拟网络错误
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res) => {
          return res.networkError('Network error')
        })
      )
      
      await expect(cloudSyncService.createCard(cardData)).rejects.toThrow('Network error')
    })

    it('应该处理认证错误', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      // 模拟认证错误
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ error: 'Unauthorized' })
          )
        })
      )
      
      await expect(cloudSyncService.createCard(cardData)).rejects.toThrow('Unauthorized')
    })

    it('应该处理服务器错误', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      // 模拟服务器错误
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ error: 'Internal server error' })
          )
        })
      )
      
      await expect(cloudSyncService.createCard(cardData)).rejects.toThrow('Internal server error')
    })

    it('应该处理验证错误', async () => {
      const invalidCard = {
        ...mockDataUtils.generateTestCard(),
        title: '', // 无效的标题
      }
      
      // 模拟验证错误
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(422),
            ctx.json({ 
              error: 'Validation error',
              details: { title: 'Title is required' }
            })
          )
        })
      )
      
      await expect(cloudSyncService.createCard(invalidCard)).rejects.toThrow('Validation error')
    })

    it('应该处理速率限制', async () => {
      const cardData = mockDataUtils.generateTestCard()
      
      // 模拟速率限制
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({ error: 'Rate limit exceeded' })
          )
        })
      )
      
      await expect(cloudSyncService.createCard(cardData)).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('请求优化', () => {
    it('应该支持请求缓存', async () => {
      const cards = mockDataUtils.generateCards(5)
      
      // 模拟成功响应
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(cards))
        })
      )
      
      // 第一次请求
      const result1 = await cloudSyncService.getCards()
      expect(result1).toHaveLength(5)
      
      // 第二次请求（应该使用缓存）
      const result2 = await cloudSyncService.getCards()
      expect(result2).toHaveLength(5)
      expect(result2).toEqual(result1)
    })

    it('应该支持请求去重', async () => {
      const cards = mockDataUtils.generateCards(5)
      
      // 模拟成功响应
      mockServer.use(
        rest.get('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(cards))
        })
      )
      
      // 并发发起相同的请求
      const [result1, result2] = await Promise.all([
        cloudSyncService.getCards(),
        cloudSyncService.getCards(),
      ])
      
      expect(result1).toHaveLength(5)
      expect(result2).toHaveLength(5)
      expect(result1).toEqual(result2)
    })

    it('应该支持请求重试', async () => {
      const cardData = mockDataUtils.generateTestCard()
      let requestCount = 0
      
      // 模拟第一次失败，第二次成功
      mockServer.use(
        rest.post('https://test.supabase.co/rest/v1/cards', (req, res, ctx) => {
          requestCount++
          if (requestCount === 1) {
            return res(ctx.status(500), ctx.json({ error: 'Server error' }))
          }
          return res(
            ctx.status(201),
            ctx.json({
              ...cardData,
              id: 'new-card-id',
              created_at: new Date().toISOString(),
            })
          )
        })
      )
      
      // 配置重试
      await cloudSyncService.configure({
        maxRetries: 3,
        retryDelay: 100,
      })
      
      const result = await cloudSyncService.createCard(cardData)
      
      expect(result).toBeDefined()
      expect(result.id).toBe('new-card-id')
      expect(requestCount).toBe(2) // 第一次失败，第二次成功
    })
  })
})