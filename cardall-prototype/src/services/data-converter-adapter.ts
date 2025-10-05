/**
 * 数据转换适配器
 * 处理不同数据格式之间的转换
 */

import { Card } from '@/types/card'
import { DbCard } from '@/services/database'

export interface CardValidationResult {
  valid: boolean
  errors: string[]
}

export class DataConverterAdapter {
  static loadFromLocalStorage(): Card[] {
    try {
      const data = localStorage.getItem('cards')
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.warn('Failed to load from localStorage:', error)
      return []
    }
  }

  static validateCard(card: any): CardValidationResult {
    const errors: string[] = []

    if (!card || typeof card !== 'object') {
      errors.push('Card must be an object')
      return { valid: false, errors }
    }

    if (!card.id || typeof card.id !== 'string') {
      errors.push('Card must have a valid id')
    }

    if (!card.frontContent || typeof card.frontContent !== 'object') {
      errors.push('Card must have frontContent')
    }

    if (!card.backContent || typeof card.backContent !== 'object') {
      errors.push('Card must have backContent')
    }

    return { valid: errors.length === 0, errors }
  }

  static bulkCardsToDbCards(cards: Card[]): DbCard[] {
    return cards.map(card => this.cardToDbCard(card))
  }

  static cardToDbCard(card: Card): DbCard {
    return {
      ...card,
      userId: 'temp-user', // 临时用户ID，实际使用时会替换
      syncVersion: 1,
      pendingSync: true
    } as DbCard
  }

  static dbCardToCard(dbCard: DbCard): Card {
    const { userId, syncVersion, pendingSync, ...card } = dbCard
    return card as Card
  }
}