// Style persistence manager for CardAll platform

import { StylePersistence } from '../../../types/style'

class CardStylePersistence implements StylePersistence {
  private static instance: CardStylePersistence
  private readonly STORAGE_KEYS = {
    USER_PREFERENCES: 'cardall_style_preferences',
    RECENT_STYLES: 'cardall_recent_styles',
    DEFAULT_STYLE: 'cardall_default_style'
  }

  private constructor() {}

  public static getInstance(): CardStylePersistence {
    if (!CardStylePersistence.instance) {
      CardStylePersistence.instance = new CardStylePersistence()
    }
    return CardStylePersistence.instance
  }

  public saveUserPreference(cardId: string, styleId: string): void {
    try {
      const preferences = this.getUserPreferences()
      preferences[cardId] = {
        styleId,
        appliedAt: new Date().toISOString()
      }
      
      localStorage.setItem(
        this.STORAGE_KEYS.USER_PREFERENCES,
        JSON.stringify(preferences)
      )

      // Update recent styles
      this.addToRecentStyles(styleId)
    } catch (error) {
      console.error('Failed to save user style preference:', error)
    }
  }

  public getUserPreference(cardId: string): string | null {
    try {
      const preferences = this.getUserPreferences()
      return preferences[cardId]?.styleId || null
    } catch (error) {
      console.error('Failed to get user style preference:', error)
      return null
    }
  }

  public getRecentStyles(limit: number = 10): string[] {
    try {
      const recentStyles = localStorage.getItem(this.STORAGE_KEYS.RECENT_STYLES)
      if (!recentStyles) return []

      const styles: string[] = JSON.parse(recentStyles)
      return styles.slice(0, limit)
    } catch (error) {
      console.error('Failed to get recent styles:', error)
      return []
    }
  }

  public clearPreferences(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.USER_PREFERENCES)
      localStorage.removeItem(this.STORAGE_KEYS.RECENT_STYLES)
    } catch (error) {
      console.error('Failed to clear style preferences:', error)
    }
  }

  public setDefaultStyle(styleId: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.DEFAULT_STYLE, styleId)
    } catch (error) {
      console.error('Failed to set default style:', error)
    }
  }

  public getDefaultStyle(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEYS.DEFAULT_STYLE)
    } catch (error) {
      console.error('Failed to get default style:', error)
      return null
    }
  }

  private getUserPreferences(): Record<string, { styleId: string; appliedAt: string }> {
    try {
      const preferences = localStorage.getItem(this.STORAGE_KEYS.USER_PREFERENCES)
      return preferences ? JSON.parse(preferences) : {}
    } catch (error) {
      console.error('Failed to parse user preferences:', error)
      return {}
    }
  }

  private addToRecentStyles(styleId: string): void {
    try {
      const recentStyles = this.getRecentStyles()
      
      // Remove if already exists
      const filteredStyles = recentStyles.filter(id => id !== styleId)
      
      // Add to beginning
      const updatedStyles = [styleId, ...filteredStyles].slice(0, 10)
      
      localStorage.setItem(
        this.STORAGE_KEYS.RECENT_STYLES,
        JSON.stringify(updatedStyles)
      )
    } catch (error) {
      console.error('Failed to update recent styles:', error)
    }
  }

  public getStyleUsageStats(): Record<string, number> {
    try {
      const preferences = this.getUserPreferences()
      const stats: Record<string, number> = {}
      
      Object.values(preferences).forEach(({ styleId }) => {
        stats[styleId] = (stats[styleId] || 0) + 1
      })
      
      return stats
    } catch (error) {
      console.error('Failed to get style usage stats:', error)
      return {}
    }
  }

  public getMostUsedStyles(limit: number = 5): string[] {
    try {
      const stats = this.getStyleUsageStats()
      return Object.entries(stats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([styleId]) => styleId)
    } catch (error) {
      console.error('Failed to get most used styles:', error)
      return []
    }
  }
}

// Export singleton instance
export const stylePersistence = CardStylePersistence.getInstance()

// Utility functions
export const saveCardStylePreference = (cardId: string, styleId: string): void => {
  stylePersistence.saveUserPreference(cardId, styleId)
}

export const getCardStylePreference = (cardId: string): string | null => {
  return stylePersistence.getUserPreference(cardId)
}

export const getRecentCardStyles = (limit?: number): string[] => {
  return stylePersistence.getRecentStyles(limit)
}

export const clearAllStylePreferences = (): void => {
  stylePersistence.clearPreferences()
}