// Test component for style selection system

import React, { useState } from 'react'
import { Card as CardType } from '../../../types/card'
import { EnhancedFlipCard } from '../enhanced-flip-card'
import { Button } from '../../ui/button'
import { RefreshCw, TestTube } from 'lucide-react'
import { formatCardContentForCopy, copyTextToClipboard } from '../../../utils/copy-utils'

// Mock card data for testing
const createMockCard = (id: string, title: string, content: string): CardType => ({
  id,
  frontContent: {
    title,
    text: content,
    images: [],
    tags: ['test', 'demo'],
    lastModified: new Date()
  },
  backContent: {
    title: `${title} - Back`,
    text: `Back side content for ${title}`,
    images: [],
    tags: ['notes', 'back'],
    lastModified: new Date()
  },
  style: {
    type: 'solid',
    backgroundColor: '#ffffff',
    fontFamily: 'system-ui',
    fontSize: 'base',
    fontWeight: 'normal',
    textColor: '#1f2937',
    borderRadius: 'xl',
    shadow: 'md',
    borderWidth: 0
  },
  isFlipped: false,
  createdAt: new Date(),
  updatedAt: new Date()
})

export const StyleSystemTest: React.FC = () => {
  const [testCards, setTestCards] = useState<CardType[]>([
    createMockCard('test-1', 'Business Card', 'This is a test card for business style testing'),
    createMockCard('test-2', 'Creative Card', 'This card tests creative and artistic styles'),
    createMockCard('test-3', 'Natural Card', 'Testing natural and organic style themes'),
    createMockCard('test-4', 'Personality Card', 'Bold and unique personality styles test')
  ])

  const handleCardFlip = (cardId: string) => {
    setTestCards(cards => 
      cards.map(card => 
        card.id === cardId 
          ? { ...card, isFlipped: !card.isFlipped }
          : card
      )
    )
  }

  const handleCardUpdate = (cardId: string, updates: Partial<CardType>) => {
    setTestCards(cards =>
      cards.map(card =>
        card.id === cardId
          ? { ...card, ...updates, updatedAt: new Date() }
          : card
      )
    )
  }

  const handleCardCopy = async (cardId: string) => {
    const card = testCards.find(c => c.id === cardId)
    if (card) {
      const content = card.isFlipped ? card.backContent : card.frontContent
      const textToCopy = formatCardContentForCopy(content.title, content.text)
      const success = await copyTextToClipboard(textToCopy)
      if (success) {
        console.log('Card content copied to clipboard')
      } else {
        console.error('Failed to copy card content')
      }
    }
  }

  const handleCardScreenshot = (cardId: string) => {
    console.log('Screenshot functionality would be implemented here for card:', cardId)
  }

  const handleCardShare = (cardId: string) => {
    console.log('Share functionality would be implemented here for card:', cardId)
  }

  const handleCardDelete = (cardId: string) => {
    setTestCards(cards => cards.filter(card => card.id !== cardId))
  }

  const resetAllStyles = () => {
    const defaultStyle = {
      type: 'solid' as const,
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui',
      fontSize: 'base' as const,
      fontWeight: 'normal' as const,
      textColor: '#1f2937',
      borderRadius: 'xl' as const,
      shadow: 'md' as const,
      borderWidth: 0
    }

    setTestCards(cards =>
      cards.map(card => ({
        ...card,
        style: defaultStyle,
        updatedAt: new Date()
      }))
    )
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TestTube className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Style Selection System Test
            </h1>
          </div>
          <p className="text-gray-600 mb-4">
            Test the card style selection functionality with different card types and content.
          </p>
          
          {/* Test Controls */}
          <div className="flex gap-3">
            <Button
              onClick={resetAllStyles}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset All Styles
            </Button>
          </div>
        </div>

        {/* Test Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 mb-2">Test Instructions:</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• Hover over each card to see the style change button</li>
            <li>• Click the palette icon to open the style selection panel</li>
            <li>• Try different styles from each category (Business, Creative, Natural, Personality)</li>
            <li>• Flip cards to see how styles apply to both sides</li>
            <li>• Check that styles persist when you close and reopen the panel</li>
            <li>• Verify smooth animations and transitions</li>
          </ul>
        </div>

        {/* Test Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testCards.map((card) => (
            <div key={card.id} className="space-y-3">
              <div className="text-sm font-medium text-gray-700 text-center">
                Test Card {card.id.split('-')[1]}
              </div>
              <EnhancedFlipCard
                card={card}
                onFlip={handleCardFlip}
                onUpdate={handleCardUpdate}
                onCopy={handleCardCopy}
                onScreenshot={handleCardScreenshot}
                onShare={handleCardShare}
                onDelete={handleCardDelete}
                size="md"
              />
              <div className="text-xs text-gray-500 text-center">
                Style: {card.style.type === 'gradient' ? 'Gradient' : 'Solid'}
                {card.style.type === 'gradient' && card.style.gradientColors 
                  ? ` (${card.style.gradientColors.length} colors)`
                  : ''
                }
              </div>
            </div>
          ))}
        </div>

        {/* Style System Status */}
        <div className="mt-12 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium text-gray-700">Features Implemented:</div>
              <ul className="text-gray-600 space-y-1">
                <li>✅ 8 Preset Style Templates</li>
                <li>✅ 2×4 Compact Grid Layout</li>
                <li>✅ Instant Style Application</li>
                <li>✅ Style Persistence</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-gray-700">Style Categories:</div>
              <ul className="text-gray-600 space-y-1">
                <li>• Business (2 styles)</li>
                <li>• Creative (2 styles)</li>
                <li>• Natural (2 styles)</li>
                <li>• Personality (2 styles)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-gray-700">Animations:</div>
              <ul className="text-gray-600 space-y-1">
                <li>✅ Panel Open/Close</li>
                <li>✅ Style Preview Hover</li>
                <li>✅ Selection Feedback</li>
                <li>✅ Smooth Transitions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StyleSystemTest