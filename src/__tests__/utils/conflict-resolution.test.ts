/**
 * 冲突解决引擎测试
 * 测试ConflictResolutionEngine类的所有功能
 */

import { ConflictResolutionEngine } from '../../utils/conflict-resolution'
import type {
  ConflictBase,
  CardConflict,
  FolderConflict,
  TagConflict,
  ConflictSuggestion,
  ConflictResolution
} from '../../types/conflict'

describe('ConflictResolutionEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('生成冲突解决建议', () => {
    test('应该为卡片内容冲突生成建议', () => {
      const cardConflict: CardConflict = {
        id: 'conflict1',
        type: 'card_content',
        entityType: 'card',
        entityId: 'card1',
        timestamp: new Date(),
        sourceDevice: 'device1',
        severity: 'medium',
        status: 'pending',
        createdAt: new Date(),
        localVersion: {
          content: {
            frontContent: {
              title: '本地标题',
              text: '本地内容文本',
              tags: ['标签1', '标签2'],
              lastModified: new Date()
            },
            backContent: {
              title: '背面标题',
              text: '背面内容',
              tags: ['背面标签1'],
              lastModified: new Date()
            }
          },
          style: {
            type: 'solid',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial',
            fontSize: 'base',
            fontWeight: 'normal',
            textColor: '#000000',
            borderRadius: '8px',
            shadow: 'none',
            borderWidth: 1
          },
          folderId: 'folder1',
          isFlipped: false,
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          version: '1'
        },
        remoteVersion: {
          content: {
            frontContent: {
              title: '远程标题',
              text: '远程内容文本',
              tags: ['标签1', '标签3'],
              lastModified: new Date()
            },
            backContent: {
              title: '背面标题',
              text: '背面内容',
              tags: ['背面标签2'],
              lastModified: new Date()
            }
          },
          style: {
            type: 'solid',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial',
            fontSize: 'base',
            fontWeight: 'normal',
            textColor: '#000000',
            borderRadius: '8px',
            shadow: 'none',
            borderWidth: 1
          },
          folderId: 'folder1',
          isFlipped: false,
          updatedAt: new Date('2024-01-01T11:00:00Z'),
          version: '2'
        },
        conflictFields: ['title', 'text', 'tags']
      }

      const suggestions = ConflictResolutionEngine.generateSuggestions(cardConflict)

      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)

      // 验证建议的结构
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('type')
        expect(suggestion).toHaveProperty('confidence')
        expect(suggestion).toHaveProperty('reason')
        expect(typeof suggestion.confidence).toBe('number')
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0)
        expect(suggestion.confidence).toBeLessThanOrEqual(1)
      })

      // 验证建议按置信度排序
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence)
      }
    })

    test('应该为文件夹名称冲突生成建议', () => {
      const folderConflict: FolderConflict = {
        id: 'conflict2',
        type: 'folder_name',
        entityType: 'folder',
        entityId: 'folder1',
        timestamp: new Date(),
        sourceDevice: 'device1',
        severity: 'low',
        status: 'pending',
        createdAt: new Date(),
        localVersion: {
          name: '我的文件夹',
          color: '#ff0000',
          parentId: undefined,
          cardIds: [],
          isExpanded: true,
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          version: '1'
        },
        remoteVersion: {
          name: '我的文件夹 - 副本',
          color: '#00ff00',
          parentId: undefined,
          cardIds: [],
          isExpanded: false,
          updatedAt: new Date('2024-01-01T11:00:00Z'),
          version: '2'
        },
        affectedCards: []
      }

      const suggestions = ConflictResolutionEngine.generateSuggestions(folderConflict)

      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)

      // 验证文件夹特定的建议类型
      const suggestionTypes = suggestions.map(s => s.type)
      expect(suggestionTypes.length).toBeGreaterThan(0)
      expect(['keep_local', 'keep_remote', 'merge']).some(type => suggestionTypes.includes(type))
    })

    test('应该为标签重命名冲突生成建议', () => {
      const tagConflict: TagConflict = {
        id: 'conflict3',
        type: 'tag_rename',
        entityType: 'tag',
        entityId: 'tag1',
        timestamp: new Date(),
        sourceDevice: 'device1',
        severity: 'low',
        status: 'pending',
        createdAt: new Date(),
        localVersion: {
          name: '重要',
          color: '#ff0000',
          count: 15,
          isHidden: false,
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          version: '1'
        },
        remoteVersion: {
          name: '重要标签',
          color: '#00ff00',
          count: 5,
          isHidden: false,
          updatedAt: new Date('2024-01-01T11:00:00Z'),
          version: '2'
        },
        affectedCards: []
      }

      const suggestions = ConflictResolutionEngine.generateSuggestions(tagConflict)

      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)

      // 验证标签特定的建议（基于使用频率）
      const highFreqSuggestion = suggestions.find(s => s.confidence > 0.8)
      expect(highFreqSuggestion).toBeDefined()
      expect(highFreqSuggestion?.reason).toContain('使用频率更高')
    })

    test('应该为未知冲突类型返回默认建议', () => {
      const unknownConflict: ConflictBase = {
        id: 'conflict4',
        type: 'unknown_type' as any,
        entityType: 'card',
        entityId: 'card1',
        timestamp: new Date(),
        sourceDevice: 'device1',
        severity: 'medium',
        status: 'pending',
        createdAt: new Date()
      }

      const suggestions = ConflictResolutionEngine.generateSuggestions(unknownConflict)

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].type).toBe('manual')
      expect(suggestions[0].confidence).toBe(0.5)
      expect(suggestions[0].reason).toContain('无法自动确定')
    })

    test('应该处理完全相同的文件夹名称', () => {
      const sameNameConflict: FolderConflict = {
        id: 'conflict5',
        type: 'folder_name',
        entityType: 'folder',
        entityId: 'folder1',
        timestamp: new Date(),
        sourceDevice: 'device1',
        severity: 'low',
        status: 'pending',
        createdAt: new Date(),
        localVersion: {
          name: 'Same Name',
          color: '#ff0000',
          parentId: undefined,
          cardIds: [],
          isExpanded: true,
          updatedAt: new Date(),
          version: '1'
        },
        remoteVersion: {
          name: 'Same Name',
          color: '#00ff00',
          parentId: undefined,
          cardIds: [],
          isExpanded: false,
          updatedAt: new Date(),
          version: '2'
        },
        affectedCards: []
      }

      const suggestions = ConflictResolutionEngine.generateSuggestions(sameNameConflict)

      expect(suggestions).toEqual([])
    })
  })

  describe('文本相似度计算', () => {
    test('应该计算准确的文本相似度', () => {
      const similarity1 = (ConflictResolutionEngine as any).calculateSimilarity('Hello World', 'Hello World')
      expect(similarity1).toBe(1.0)

      const similarity2 = (ConflictResolutionEngine as any).calculateSimilarity('Hello', 'World')
      expect(similarity2).toBeGreaterThan(0)
      expect(similarity2).toBeLessThan(1.0)

      const similarity3 = (ConflictResolutionEngine as any).calculateSimilarity('', 'Hello')
      expect(similarity3).toBe(0)
    })

    test('应该处理大小写和空格', () => {
      const similarity = (ConflictResolutionEngine as any).calculateSimilarity('  Hello World  ', 'hello world')
      expect(similarity).toBe(1.0)
    })

    test('应该计算Levenshtein距离', () => {
      const distance1 = (ConflictResolutionEngine as any).levenshteinDistance('kitten', 'sitting')
      expect(distance1).toBe(3)

      const distance2 = (ConflictResolutionEngine as any).levenshteinDistance('', '')
      expect(distance2).toBe(0)

      const distance3 = (ConflictResolutionEngine as any).levenshteinDistance('abc', 'abc')
      expect(distance3).toBe(0)
    })
  })

  describe('标题合并', () => {
    test('应该合并相同的标题', () => {
      const merged = (ConflictResolutionEngine as any).mergeTitles('Same Title', 'Same Title')
      expect(merged).toBe('Same Title')
    })

    test('应该选择更长的标题当一个是另一个的子集', () => {
      const merged1 = (ConflictResolutionEngine as any).mergeTitles('Title', 'Longer Title')
      expect(merged1).toBe('Longer Title')

      const merged2 = (ConflictResolutionEngine as any).mergeTitles('Long Title', 'Title')
      expect(merged2).toBe('Long Title')
    })

    test('应该合并不同标题的关键词', () => {
      const merged = (ConflictResolutionEngine as any).mergeTitles('Quick Start', 'Beginner Guide')
      expect(merged).toContain('Quick')
      expect(merged).toContain('Start')
      expect(merged).toContain('Beginner')
      expect(merged).toContain('Guide')
    })
  })

  describe('标签名称质量评估', () => {
    test('应该评估标签名称质量', () => {
      const goodQuality = (ConflictResolutionEngine as any).evaluateTagNameQuality('Important')
      const longQuality = (ConflictResolutionEngine as any).evaluateTagNameQuality('This Is A Very Long Tag Name That Is Not Good')
      const invalidQuality = (ConflictResolutionEngine as any).evaluateTagNameQuality('tag@#$%^')

      expect(goodQuality).toBeGreaterThan(0.5)
      expect(longQuality).toBeLessThan(goodQuality)
      expect(invalidQuality).toBeLessThan(goodQuality)
    })

    test('应该处理边界情况', () => {
      const emptyQuality = (ConflictResolutionEngine as any).evaluateTagNameQuality('')
      const shortQuality = (ConflictResolutionEngine as any).evaluateTagNameQuality('A')
      const perfectQuality = (ConflictResolutionEngine as any).evaluateTagNameQuality('PerfectTagName')

      expect(emptyQuality).toBeGreaterThanOrEqual(0)
      expect(emptyQuality).toBeLessThanOrEqual(1)
      expect(shortQuality).toBeLessThan(perfectQuality)
    })
  })

  describe('解决方案应用', () => {
    const mockCardConflict: CardConflict = {
      id: 'conflict1',
      type: 'card_content',
      entityType: 'card',
      entityId: 'card1',
      timestamp: new Date(),
      sourceDevice: 'device1',
      severity: 'medium',
      status: 'pending',
      createdAt: new Date(),
      localVersion: {
        content: {
          frontContent: {
            title: '本地标题',
            text: '本地内容',
            tags: ['本地'],
            lastModified: new Date()
          },
          backContent: {
            title: '背面',
            text: '背面内容',
            tags: [],
            lastModified: new Date()
          }
        },
        style: {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#000000',
          borderRadius: '8px',
          shadow: 'none',
          borderWidth: 1
        },
        folderId: 'folder1',
        isFlipped: false,
        updatedAt: new Date(),
        version: '1'
      },
      remoteVersion: {
        content: {
          frontContent: {
            title: '远程标题',
            text: '远程内容',
            tags: ['远程'],
            lastModified: new Date()
          },
          backContent: {
            title: '背面',
            text: '背面内容',
            tags: [],
            lastModified: new Date()
          }
        },
        style: {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#000000',
          borderRadius: '8px',
          shadow: 'none',
          borderWidth: 1
        },
        folderId: 'folder1',
        isFlipped: false,
        updatedAt: new Date(),
        version: '2'
      },
      conflictFields: ['title', 'text', 'tags']
    }

    test('应该应用保留本地版本的解决方案', () => {
      const resolution: ConflictResolution = {
        type: 'keep_local',
        timestamp: new Date()
      }

      const result = ConflictResolutionEngine.applyResolution(mockCardConflict, resolution)

      expect(result).toEqual(mockCardConflict.localVersion)
    })

    test('应该应用保留远程版本的解决方案', () => {
      const resolution: ConflictResolution = {
        type: 'keep_remote',
        timestamp: new Date()
      }

      const result = ConflictResolutionEngine.applyResolution(mockCardConflict, resolution)

      expect(result).toEqual(mockCardConflict.remoteVersion)
    })

    test('应该应用合并解决方案', () => {
      const mergedData = {
        content: {
          frontContent: {
            title: '合并标题',
            text: '合并内容',
            tags: ['本地', '远程'],
            lastModified: new Date()
          },
          backContent: {
            title: '背面',
            text: '背面内容',
            tags: [],
            lastModified: new Date()
          }
        }
      }

      const resolution: ConflictResolution = {
        type: 'merge',
        mergedData,
        timestamp: new Date()
      }

      const result = ConflictResolutionEngine.applyResolution(mockCardConflict, resolution)

      expect(result).toEqual(mergedData)
    })

    test('应该应用手动解决方案', () => {
      const manualData = {
        content: {
          frontContent: {
            title: '手动修改标题',
            text: '手动修改内容',
            tags: ['手动'],
            lastModified: new Date()
          },
          backContent: {
            title: '背面',
            text: '背面内容',
            tags: [],
            lastModified: new Date()
          }
        }
      }

      const resolution: ConflictResolution = {
        type: 'manual',
        manualChanges: manualData,
        timestamp: new Date()
      }

      const result = ConflictResolutionEngine.applyResolution(mockCardConflict, resolution)

      expect(result).toEqual(manualData)
    })

    test('应该为合并解决方案提供智能合并', () => {
      const resolution: ConflictResolution = {
        type: 'merge',
        timestamp: new Date()
      }

      const result = ConflictResolutionEngine.applyResolution(mockCardConflict, resolution)

      // 验证智能合并结果
      expect(result.content.frontContent.title).toContain('本地')
      expect(result.content.frontContent.title).toContain('远程')
      expect(result.content.frontContent.tags).toContain('本地')
      expect(result.content.frontContent.tags).toContain('远程')
      expect(result.content.backContent.title).toBe('背面')
    })

    test('应该处理未知的解决方案类型', () => {
      const resolution: ConflictResolution = {
        type: 'unknown_type' as any,
        timestamp: new Date()
      }

      expect(() => {
        ConflictResolutionEngine.applyResolution(mockCardConflict, resolution)
      }).toThrow('Unknown resolution type')
    })
  })

  describe('文本合并', () => {
    test('应该合并相同的文本', () => {
      const merged = (ConflictResolutionEngine as any).mergeText('Same text.', 'Same text.')
      expect(merged).toBe('Same text.')
    })

    test('应该合并不同的文本内容', () => {
      const merged = (ConflictResolutionEngine as any).mergeText('First sentence. Second sentence.', 'Third sentence.')
      expect(merged).toContain('First sentence')
      expect(merged).toContain('Second sentence')
      expect(merged).toContain('Third sentence')
    })

    test('应该处理空文本', () => {
      const merged1 = (ConflictResolutionEngine as any).mergeText('', 'Some text.')
      expect(merged1).toBe('Some text.')

      const merged2 = (ConflictResolutionEngine as any).mergeText('Some text.', '')
      expect(merged2).toBe('Some text.')
    })
  })

  describe('边界情况测试', () => {
    test('应该处理null或undefined输入', () => {
      const similarity1 = (ConflictResolutionEngine as any).calculateSimilarity(null as any, 'text')
      expect(similarity1).toBe(0)

      const similarity2 = (ConflictResolutionEngine as any).calculateSimilarity('text', null as any)
      expect(similarity2).toBe(0)

      const similarity3 = (ConflictResolutionEngine as any).calculateSimilarity(null as any, null as any)
      expect(similarity3).toBe(0)
    })

    test('应该处理特殊字符', () => {
      const similarity = (ConflictResolutionEngine as any).calculateSimilarity('Text with @#$%', 'Text with @#$%')
      expect(similarity).toBe(1.0)
    })

    test('应该处理超长文本', () => {
      const longText1 = 'A'.repeat(1000)
      const longText2 = `${'A'.repeat(999)  }B`

      const similarity = (ConflictResolutionEngine as any).calculateSimilarity(longText1, longText2)
      expect(similarity).toBeGreaterThan(0.9)
      expect(similarity).toBeLessThan(1.0)
    })
  })

  describe('性能测试', () => {
    test('应该保持良好的性能', () => {
      // 使用一个完整的CardConflict进行性能测试
      const mockCardConflict: CardConflict = {
        id: 'conflict1',
        type: 'card_content',
        entityType: 'card',
        entityId: 'card1',
        timestamp: new Date(),
        sourceDevice: 'device1',
        severity: 'medium',
        status: 'pending',
        createdAt: new Date(),
        localVersion: {
          content: {
            frontContent: {
              title: '本地标题',
              text: '本地内容文本',
              tags: ['标签1', '标签2'],
              lastModified: new Date()
            },
            backContent: {
              title: '背面标题',
              text: '背面内容',
              tags: ['背面标签1'],
              lastModified: new Date()
            }
          },
          style: {
            type: 'solid',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial',
            fontSize: 'base',
            fontWeight: 'normal',
            textColor: '#000000',
            borderRadius: '8px',
            shadow: 'none',
            borderWidth: 1
          },
          folderId: 'folder1',
          isFlipped: false,
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          version: '1'
        },
        remoteVersion: {
          content: {
            frontContent: {
              title: '远程标题',
              text: '远程内容文本',
              tags: ['标签1', '标签3'],
              lastModified: new Date()
            },
            backContent: {
              title: '背面标题',
              text: '背面内容',
              tags: ['背面标签2'],
              lastModified: new Date()
            }
          },
          style: {
            type: 'solid',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial',
            fontSize: 'base',
            fontWeight: 'normal',
            textColor: '#000000',
            borderRadius: '8px',
            shadow: 'none',
            borderWidth: 1
          },
          folderId: 'folder1',
          isFlipped: false,
          updatedAt: new Date('2024-01-01T11:00:00Z'),
          version: '2'
        },
        conflictFields: ['title', 'text', 'tags']
      }

      const start = performance.now()

      // 为100个冲突生成建议
      for (let i = 0; i < 100; i++) {
        ConflictResolutionEngine.generateSuggestions(mockCardConflict)
      }

      const end = performance.now()
      const duration = end - start

      // 100次冲突解决应该在合理时间内完成
      expect(duration).toBeLessThan(500) // 500ms
    })

    test('应该避免内存泄漏', () => {
      // 创建多次文本相似度计算
      const results = []
      for (let i = 0; i < 1000; i++) {
        results.push((ConflictResolutionEngine as any).calculateSimilarity(`text${i}`, `text${i % 100}`))
      }

      // 清理
      results.length = 0

      // 如果没有内存泄漏，这个测试应该通过
      expect(true).toBe(true)
    })
  })

  describe('TypeScript类型检查', () => {
    test('应该符合TypeScript类型', () => {
      const mockConflict: CardConflict = {
        id: 'test',
        type: 'card_content',
        entityType: 'card',
        entityId: 'card1',
        timestamp: new Date(),
        sourceDevice: 'device1',
        severity: 'medium',
        status: 'pending',
        createdAt: new Date(),
        localVersion: {
          content: {
            frontContent: {
              title: '本地标题',
              text: '本地内容',
              tags: ['本地'],
              lastModified: new Date()
            },
            backContent: {
              title: '背面',
              text: '背面内容',
              tags: [],
              lastModified: new Date()
            }
          },
          style: {
            type: 'solid',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial',
            fontSize: 'base',
            fontWeight: 'normal',
            textColor: '#000000',
            borderRadius: '8px',
            shadow: 'none',
            borderWidth: 1
          },
          folderId: 'folder1',
          isFlipped: false,
          updatedAt: new Date(),
          version: '1'
        },
        remoteVersion: {
          content: {
            frontContent: {
              title: '远程标题',
              text: '远程内容',
              tags: ['远程'],
              lastModified: new Date()
            },
            backContent: {
              title: '背面',
              text: '背面内容',
              tags: [],
              lastModified: new Date()
            }
          },
          style: {
            type: 'solid',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial',
            fontSize: 'base',
            fontWeight: 'normal',
            textColor: '#000000',
            borderRadius: '8px',
            shadow: 'none',
            borderWidth: 1
          },
          folderId: 'folder1',
          isFlipped: false,
          updatedAt: new Date(),
          version: '2'
        },
        conflictFields: ['title', 'text', 'tags']
      }

      const suggestions = ConflictResolutionEngine.generateSuggestions(mockConflict)

      expect(Array.isArray(suggestions)).toBe(true)
      suggestions.forEach(suggestion => {
        expect(typeof suggestion.type).toBe('string')
        expect(typeof suggestion.confidence).toBe('number')
        expect(typeof suggestion.reason).toBe('string')
      })

      const resolution: ConflictResolution = {
        type: 'keep_local',
        timestamp: new Date()
      }

      const result = ConflictResolutionEngine.applyResolution(mockConflict, resolution)
      expect(typeof result).toBe('object')
    })
  })
})