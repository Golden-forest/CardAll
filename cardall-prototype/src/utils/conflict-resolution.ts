import type {
  ConflictBase,
  CardConflict,
  FolderConflict,
  TagConflict,
  ConflictSuggestion,
  ConflictResolution
} from '../types/conflict'

export class ConflictResolutionEngine {
  /**
   * 生成冲突解决建议
   */
  static generateSuggestions(conflict: ConflictBase): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []

    switch (conflict.type) {
      case 'card_content':
        suggestions.push(...this.generateCardContentSuggestions(conflict as CardConflict))
        break
      case 'folder_name':
        suggestions.push(...this.generateFolderNameSuggestions(conflict as FolderConflict))
        break
      case 'tag_rename':
        suggestions.push(...this.generateTagRenameSuggestions(conflict as TagConflict))
        break
      default:
        suggestions.push(this.getDefaultSuggestion())
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 卡片内容冲突建议
   */
  private static generateCardContentSuggestions(conflict: CardConflict): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []
    const { localVersion, remoteVersion } = conflict

    // 1. 内容相似度分析
    const titleSimilarity = this.calculateSimilarity(
      localVersion.content.frontContent.title,
      remoteVersion.content.frontContent.title
    )
    const textSimilarity = this.calculateSimilarity(
      localVersion.content.frontContent.text,
      remoteVersion.content.frontContent.text
    )

    // 2. 时间戳分析
    const timeDiff = Math.abs(
      localVersion.updatedAt.getTime() - remoteVersion.updatedAt.getTime()
    )
    const isRecentConflict = timeDiff < 5 * 60 * 1000 // 5分钟内

    // 3. 内容长度分析
    const localLength = localVersion.content.frontContent.text.length
    const remoteLength = remoteVersion.content.frontContent.text.length
    const lengthRatio = Math.max(localLength, remoteLength) / Math.min(localLength, remoteLength)

    // 高相似度且时间接近，建议合并
    if (titleSimilarity > 0.8 && textSimilarity > 0.6 && isRecentConflict) {
      suggestions.push({
        type: 'merge',
        confidence: 0.9,
        reason: '内容高度相似，建议智能合并保留最佳内容',
        preview: {
          mergedTitle: this.mergeTitles(localVersion.content.frontContent.title, remoteVersion.content.frontContent.title),
          mergedLength: Math.max(localLength, remoteLength)
        }
      })
    }

    // 远程版本更新很多，建议保留远程
    if (remoteVersion.updatedAt.getTime() > localVersion.updatedAt.getTime() && 
        lengthRatio > 2 && 
        remoteLength > localLength) {
      suggestions.push({
        type: 'keep_remote',
        confidence: 0.8,
        reason: '远程版本内容更丰富且更新时间更近'
      })
    }

    // 本地版本包含独特标签，建议保留本地
    const localTags = new Set(localVersion.content.frontContent.tags)
    const remoteTags = new Set(remoteVersion.content.frontContent.tags)
    const uniqueLocalTags = [...localTags].filter(tag => !remoteTags.has(tag))
    
    if (uniqueLocalTags.length > 0 && uniqueLocalTags.length / localTags.size > 0.3) {
      suggestions.push({
        type: 'keep_local',
        confidence: 0.7,
        reason: '本地版本包含独特标签，可能包含重要分类信息'
      })
    }

    // 默认建议保留最新版本
    const latestVersion = localVersion.updatedAt.getTime() > remoteVersion.updatedAt.getTime() ? 'local' : 'remote'
    suggestions.push({
      type: latestVersion === 'local' ? 'keep_local' : 'keep_remote',
      confidence: 0.6,
      reason: `保留最新版本（${latestVersion === 'local' ? '本地' : '远程'}设备）`
    })

    return suggestions
  }

  /**
   * 文件夹名称冲突建议
   */
  private static generateFolderNameSuggestions(conflict: FolderConflict): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []
    const { localVersion, remoteVersion } = conflict

    const localName = localVersion.name.toLowerCase()
    const remoteName = remoteVersion.name.toLowerCase()

    // 名称完全相同，不需要处理
    if (localName === remoteName) {
      return []
    }

    // 相似度高，建议合并
    const similarity = this.calculateSimilarity(localVersion.name, remoteVersion.name)
    if (similarity > 0.8) {
      suggestions.push({
        type: 'merge',
        confidence: 0.9,
        reason: '文件夹名称相似，建议统一命名'
      })
    }

    // 一个是另一个的子集，建议保留更完整的
    if (localName.includes(remoteName) || remoteName.includes(localName)) {
      const longerName = localVersion.name.length > remoteVersion.name.length ? 'local' : 'remote'
      suggestions.push({
        type: longerName === 'local' ? 'keep_local' : 'keep_remote',
        confidence: 0.8,
        reason: '保留更具描述性的文件夹名称'
      })
    }

    // 按时间戳建议保留最新
    const latestVersion = localVersion.updatedAt.getTime() > remoteVersion.updatedAt.getTime() ? 'local' : 'remote'
    suggestions.push({
      type: latestVersion === 'local' ? 'keep_local' : 'keep_remote',
      confidence: 0.6,
      reason: `保留最新修改的版本（${latestVersion === 'local' ? '本地' : '远程'}）`
    })

    return suggestions
  }

  /**
   * 标签重命名冲突建议
   */
  private static generateTagRenameSuggestions(conflict: TagConflict): ConflictSuggestion[] {
    const suggestions: ConflictSuggestion[] = []
    const { localVersion, remoteVersion } = conflict

    // 分析使用频率
    const usageRatio = localVersion.count / Math.max(remoteVersion.count, 1)

    // 使用频率差异大，建议保留高频使用的
    if (usageRatio > 2) {
      suggestions.push({
        type: 'keep_local',
        confidence: 0.9,
        reason: `本地标签使用频率更高（${localVersion.count}次 vs ${remoteVersion.count}次）`
      })
    } else if (usageRatio < 0.5) {
      suggestions.push({
        type: 'keep_remote',
        confidence: 0.9,
        reason: `远程标签使用频率更高（${remoteVersion.count}次 vs ${localVersion.count}次）`
      })
    }

    // 名称质量分析
    const localQuality = this.evaluateTagNameQuality(localVersion.name)
    const remoteQuality = this.evaluateTagNameQuality(remoteVersion.name)

    if (Math.abs(localQuality - remoteQuality) > 0.3) {
      const betterVersion = localQuality > remoteQuality ? 'local' : 'remote'
      suggestions.push({
        type: betterVersion === 'local' ? 'keep_local' : 'keep_remote',
        confidence: 0.8,
        reason: `${betterVersion === 'local' ? '本地' : '远程'}标签名称质量更好`
      })
    }

    // 按时间戳建议
    const latestVersion = localVersion.updatedAt.getTime() > remoteVersion.updatedAt.getTime() ? 'local' : 'remote'
    suggestions.push({
      type: latestVersion === 'local' ? 'keep_local' : 'keep_remote',
      confidence: 0.6,
      reason: `保留最新修改的版本`
    })

    return suggestions
  }

  /**
   * 计算文本相似度（简化版）
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0

    // 转换为小写并去除空格
    const clean1 = text1.toLowerCase().trim()
    const clean2 = text2.toLowerCase().trim()

    if (clean1 === clean2) return 1.0

    // 计算编辑距离相似度
    const maxLength = Math.max(clean1.length, clean2.length)
    if (maxLength === 0) return 1.0

    const distance = this.levenshteinDistance(clean1, clean2)
    return 1 - (distance / maxLength)
  }

  /**
   * 计算Levenshtein距离
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i += 1) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j += 1) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * 合并标题
   */
  private static mergeTitles(title1: string, title2: string): string {
    if (title1 === title2) return title1
    
    // 如果一个标题是另一个的扩展，选择更长的
    if (title1.includes(title2) && title1.length > title2.length) return title1
    if (title2.includes(title1) && title2.length > title1.length) return title2
    
    // 合并两个标题的关键词
    const words1 = new Set(title1.toLowerCase().split(/\s+/))
    const words2 = new Set(title2.toLowerCase().split(/\s+/))
    const allWords = new Set([...words1, ...words2])
    
    // 重新组合，保留原有顺序
    const title1Words = title1.split(/\s+/)
    const title2Words = title2.split(/\s+/)
    const mergedWords: string[] = []
    
    // 添加第一个标题的词汇
    title1Words.forEach(word => {
      if (!mergedWords.includes(word) && allWords.has(word.toLowerCase())) {
        mergedWords.push(word)
      }
    })
    
    // 添加第二个标题的独特词汇
    title2Words.forEach(word => {
      if (!mergedWords.includes(word) && allWords.has(word.toLowerCase())) {
        mergedWords.push(word)
      }
    })
    
    return mergedWords.join(' ')
  }

  /**
   * 评估标签名称质量
   */
  private static evaluateTagNameQuality(tagName: string): number {
    let score = 0.5 // 基础分数

    // 长度评分
    if (tagName.length >= 3 && tagName.length <= 20) score += 0.2
    if (tagName.length > 30) score -= 0.1

    // 字符评分
    const hasValidChars = /^[a-zA-Z0-9\u4e00-\u9fff\s\-_]+$/.test(tagName)
    if (hasValidChars) score += 0.2

    // 大小写评分
    if (tagName === tagName.toLowerCase() || 
        /^[A-Z][a-z]+([A-Z][a-z]*)*$/.test(tagName)) {
      score += 0.1
    }

    // 特殊字符评分
    const specialChars = tagName.match(/[^a-zA-Z0-9\u4e00-\u9fff\s]/g)
    if (specialChars && specialChars.length > 2) score -= 0.1

    return Math.max(0, Math.min(1, score))
  }

  /**
   * 默认建议
   */
  private static getDefaultSuggestion(): ConflictSuggestion {
    return {
      type: 'manual',
      confidence: 0.5,
      reason: '无法自动确定最佳解决方案，建议手动处理'
    }
  }

  /**
   * 应用解决方案
   */
  static applyResolution(
    conflict: ConflictBase, 
    resolution: ConflictResolution
  ): any {
    switch (resolution.type) {
      case 'keep_local':
        return this.getLocalVersion(conflict)
      
      case 'keep_remote':
        return this.getRemoteVersion(conflict)
      
      case 'merge':
        return this.mergeVersions(conflict, resolution.mergedData)
      
      case 'manual':
        return resolution.mergedData || resolution.manualChanges
      
      default:
        throw new Error(`Unknown resolution type: ${resolution.type}`)
    }
  }

  /**
   * 获取本地版本
   */
  private static getLocalVersion(conflict: ConflictBase): any {
    if (conflict.entityType === 'card') {
      const cardConflict = conflict as CardConflict
      return cardConflict.localVersion
    }
    return (conflict as any).localVersion
  }

  /**
   * 获取远程版本
   */
  private static getRemoteVersion(conflict: ConflictBase): any {
    if (conflict.entityType === 'card') {
      const cardConflict = conflict as CardConflict
      return cardConflict.remoteVersion
    }
    return (conflict as any).remoteVersion
  }

  /**
   * 合并版本
   */
  private static mergeVersions(conflict: ConflictBase, mergedData?: any): any {
    if (!mergedData) {
      // 如果没有提供合并数据，使用智能合并
      return this.smartMerge(conflict)
    }
    return mergedData
  }

  /**
   * 智能合并
   */
  private static smartMerge(conflict: ConflictBase): any {
    if (conflict.entityType === 'card') {
      const cardConflict = conflict as CardConflict
      const local = cardConflict.localVersion
      const remote = cardConflict.remoteVersion

      return {
        content: {
          frontContent: {
            title: this.mergeTitles(
              local.content.frontContent.title,
              remote.content.frontContent.title
            ),
            text: this.mergeText(
              local.content.frontContent.text,
              remote.content.frontContent.text
            ),
            tags: [...new Set([
              ...local.content.frontContent.tags,
              ...remote.content.frontContent.tags
            ])],
            lastModified: new Date()
          },
          backContent: {
            title: this.mergeTitles(
              local.content.backContent.title,
              remote.content.backContent.title
            ),
            text: this.mergeText(
              local.content.backContent.text,
              remote.content.backContent.text
            ),
            tags: [...new Set([
              ...local.content.backContent.tags,
              ...remote.content.backContent.tags
            ])],
            lastModified: new Date()
          }
        },
        style: local.style,
        folderId: local.folderId,
        isFlipped: local.isFlipped,
        updatedAt: new Date()
      }
    }

    // 其他类型冲突的默认合并策略
    return this.getLocalVersion(conflict)
  }

  /**
   * 合并文本内容
   */
  private static mergeText(text1: string, text2: string): string {
    if (text1 === text2) return text1
    
    // 简单的文本合并策略
    const sentences1 = text1.split(/[.!?]+/).filter(s => s.trim())
    const sentences2 = text2.split(/[.!?]+/).filter(s => s.trim())
    
    // 去重合并
    const allSentences = new Set([
      ...sentences1.map(s => s.trim()),
      ...sentences2.map(s => s.trim())
    ])
    
    return `${Array.from(allSentences)
      .filter(s => s.length > 0)
      .join('. ')  }.`
  }
}