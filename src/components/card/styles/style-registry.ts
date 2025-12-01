// Style registry for managing all card style presets

import { StylePreset, StyleRegistry, StyleCategory } from '../../../types/style'

class CardStyleRegistry implements StyleRegistry {
  private static instance: CardStyleRegistry
  public presets: Map<string, StylePreset> = new Map()
  public categories: Map<string, StylePreset[]> = new Map()

  private constructor() {
    this.initializeCategories()
  }

  public static getInstance(): CardStyleRegistry {
    if (!CardStyleRegistry.instance) {
      CardStyleRegistry.instance = new CardStyleRegistry()
    }
    return CardStyleRegistry.instance
  }

  private initializeCategories(): void {
    const categories: StyleCategory[] = ['business', 'creative', 'natural', 'personality', 'gradient', 'nature', 'modern', 'warm', 'classic', 'dark', 'minimalist']
    categories.forEach(category => {
      this.categories.set(category, [])
    })
  }

  public register(preset: StylePreset): void {
    this.presets.set(preset.id, preset)
    
    // Add to category
    const categoryPresets = this.categories.get(preset.category) || []
    categoryPresets.push(preset)
    this.categories.set(preset.category, categoryPresets)
  }

  public unregister(id: string): void {
    const preset = this.presets.get(id)
    if (preset) {
      this.presets.delete(id)
      
      // Remove from category
      const categoryPresets = this.categories.get(preset.category) || []
      const filteredPresets = categoryPresets.filter(p => p.id !== id)
      this.categories.set(preset.category, filteredPresets)
    }
  }

  public getByCategory(category: string): StylePreset[] {
    return this.categories.get(category) || []
  }

  public getById(id: string): StylePreset | undefined {
    return this.presets.get(id)
  }

  public getAll(): StylePreset[] {
    return Array.from(this.presets.values())
  }

  public getAllByOrder(): StylePreset[] {
    const orderedPresets: StylePreset[] = []
    const categories: StyleCategory[] = ['business', 'creative', 'natural', 'personality', 'gradient', 'nature', 'modern', 'warm', 'classic', 'dark', 'minimalist']
    
    categories.forEach(category => {
      const categoryPresets = this.getByCategory(category)
      orderedPresets.push(...categoryPresets)
    })
    
    return orderedPresets
  }

  public getCategoryCount(category: string): number {
    return this.categories.get(category)?.length || 0
  }

  public getTotalCount(): number {
    return this.presets.size
  }

  public clear(): void {
    this.presets.clear()
    this.initializeCategories()
  }
}

// Export singleton instance
export const styleRegistry = CardStyleRegistry.getInstance()

// Utility functions for style management
export const registerStylePreset = (preset: StylePreset): void => {
  styleRegistry.register(preset)
}

export const getStylePreset = (id: string): StylePreset | undefined => {
  return styleRegistry.getById(id)
}

export const getAllStylePresets = (): StylePreset[] => {
  return styleRegistry.getAllByOrder()
}

export const getStylePresetsByCategory = (category: StyleCategory): StylePreset[] => {
  return styleRegistry.getByCategory(category)
}

// Auto-registration helper for style preset files
export const autoRegisterStylePresets = async (): Promise<void> => {
  try {
    // Dynamic import all preset files
    const presetModules = import.meta.glob('./presets/*.tsx', { eager: true })
    
    for (const [path, module] of Object.entries(presetModules)) {
      const presetModule = module as { default?: StylePreset; preset?: StylePreset }
      const preset = presetModule.default || presetModule.preset
      
      if (preset && preset.id) {
        styleRegistry.register(preset)
      } else {
        console.warn(`Style preset file ${path} does not export a valid preset`)
      }
    }
  } catch (error) {
    console.error('Failed to auto-register style presets:', error)
  }
}