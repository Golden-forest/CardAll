import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 常用emoji列表
const EMOJI_LIST = [
  { emoji: '😀', name: 'grinning' },
  { emoji: '😃', name: 'smiley' },
  { emoji: '😄', name: 'smile' },
  { emoji: '😁', name: 'grin' },
  { emoji: '😆', name: 'laughing' },
  { emoji: '😅', name: 'sweat_smile' },
  { emoji: '🤣', name: 'rofl' },
  { emoji: '😂', name: 'joy' },
  { emoji: '🙂', name: 'slightly_smiling_face' },
  { emoji: '🙃', name: 'upside_down_face' },
  { emoji: '😉', name: 'wink' },
  { emoji: '😊', name: 'blush' },
  { emoji: '😇', name: 'innocent' },
  { emoji: '🥰', name: 'smiling_face_with_hearts' },
  { emoji: '😍', name: 'heart_eyes' },
  { emoji: '🤩', name: 'star_struck' },
  { emoji: '😘', name: 'kissing_heart' },
  { emoji: '😗', name: 'kissing' },
  { emoji: '😚', name: 'kissing_closed_eyes' },
  { emoji: '😙', name: 'kissing_smiling_eyes' },
  { emoji: '🥲', name: 'smiling_face_with_tear' },
  { emoji: '😋', name: 'yum' },
  { emoji: '😛', name: 'stuck_out_tongue' },
  { emoji: '😜', name: 'stuck_out_tongue_winking_eye' },
  { emoji: '🤪', name: 'zany_face' },
  { emoji: '😝', name: 'stuck_out_tongue_closed_eyes' },
  { emoji: '🤑', name: 'money_mouth_face' },
  { emoji: '🤗', name: 'hugs' },
  { emoji: '🤭', name: 'hand_over_mouth' },
  { emoji: '🤫', name: 'shushing_face' },
  { emoji: '🤔', name: 'thinking' },
  { emoji: '🤐', name: 'zipper_mouth_face' },
  { emoji: '🤨', name: 'raised_eyebrow' },
  { emoji: '😐', name: 'neutral_face' },
  { emoji: '😑', name: 'expressionless' },
  { emoji: '😶', name: 'no_mouth' },
  { emoji: '😏', name: 'smirk' },
  { emoji: '😒', name: 'unamused' },
  { emoji: '🙄', name: 'roll_eyes' },
  { emoji: '😬', name: 'grimacing' },
  { emoji: '🤥', name: 'lying_face' },
  { emoji: '😔', name: 'pensive' },
  { emoji: '😪', name: 'sleepy' },
  { emoji: '🤤', name: 'drooling_face' },
  { emoji: '😴', name: 'sleeping' },
  { emoji: '😷', name: 'mask' },
  { emoji: '🤒', name: 'face_with_thermometer' },
  { emoji: '🤕', name: 'face_with_head_bandage' },
  { emoji: '🤢', name: 'nauseated_face' },
  { emoji: '🤮', name: 'vomiting_face' },
  { emoji: '🤧', name: 'sneezing_face' },
  { emoji: '🥵', name: 'hot_face' },
  { emoji: '🥶', name: 'cold_face' },
  { emoji: '🥴', name: 'woozy_face' },
  { emoji: '😵', name: 'dizzy_face' },
  { emoji: '🤯', name: 'exploding_head' },
  { emoji: '🤠', name: 'cowboy_hat_face' },
  { emoji: '🥳', name: 'partying_face' },
  { emoji: '🥸', name: 'disguised_face' },
  { emoji: '😎', name: 'sunglasses' },
  { emoji: '🤓', name: 'nerd_face' },
  { emoji: '🧐', name: 'monocle_face' },
  { emoji: '😕', name: 'confused' },
  { emoji: '😟', name: 'worried' },
  { emoji: '🙁', name: 'slightly_frowning_face' },
  { emoji: '☹️', name: 'frowning_face' },
  { emoji: '😮', name: 'open_mouth' },
  { emoji: '😯', name: 'hushed' },
  { emoji: '😲', name: 'astonished' },
  { emoji: '😳', name: 'flushed' },
  { emoji: '🥺', name: 'pleading_face' },
  { emoji: '😦', name: 'frowning' },
  { emoji: '😧', name: 'anguished' },
  { emoji: '😨', name: 'fearful' },
  { emoji: '😰', name: 'cold_sweat' },
  { emoji: '😥', name: 'disappointed_relieved' },
  { emoji: '😢', name: 'cry' },
  { emoji: '😭', name: 'sob' },
  { emoji: '😱', name: 'scream' },
  { emoji: '😖', name: 'confounded' },
  { emoji: '😣', name: 'persevere' },
  { emoji: '😞', name: 'disappointed' },
  { emoji: '😓', name: 'sweat' },
  { emoji: '😩', name: 'weary' },
  { emoji: '😫', name: 'tired_face' },
  { emoji: '🥱', name: 'yawning_face' },
  { emoji: '😤', name: 'triumph' },
  { emoji: '😡', name: 'rage' },
  { emoji: '😠', name: 'angry' },
  { emoji: '🤬', name: 'cursing_face' },
  { emoji: '😈', name: 'smiling_imp' },
  { emoji: '👿', name: 'imp' },
  { emoji: '💀', name: 'skull' },
  { emoji: '☠️', name: 'skull_and_crossbones' },
  { emoji: '💩', name: 'poop' },
  { emoji: '🤡', name: 'clown_face' },
  { emoji: '👹', name: 'ogre' },
  { emoji: '👺', name: 'goblin' },
  { emoji: '👻', name: 'ghost' },
  { emoji: '👽', name: 'alien' },
  { emoji: '👾', name: 'space_invader' },
  { emoji: '🤖', name: 'robot' },
  { emoji: '😺', name: 'smiley_cat' },
  { emoji: '😸', name: 'smile_cat' },
  { emoji: '😹', name: 'joy_cat' },
  { emoji: '😻', name: 'heart_eyes_cat' },
  { emoji: '😼', name: 'smirk_cat' },
  { emoji: '😽', name: 'kissing_cat' },
  { emoji: '🙀', name: 'scream_cat' },
  { emoji: '😿', name: 'crying_cat_face' },
  { emoji: '😾', name: 'pouting_cat' },
  // 手势
  { emoji: '👋', name: 'wave' },
  { emoji: '🤚', name: 'raised_back_of_hand' },
  { emoji: '🖐️', name: 'raised_hand_with_fingers_splayed' },
  { emoji: '✋', name: 'hand' },
  { emoji: '🖖', name: 'vulcan_salute' },
  { emoji: '👌', name: 'ok_hand' },
  { emoji: '🤌', name: 'pinched_fingers' },
  { emoji: '🤏', name: 'pinching_hand' },
  { emoji: '✌️', name: 'v' },
  { emoji: '🤞', name: 'crossed_fingers' },
  { emoji: '🤟', name: 'love_you_gesture' },
  { emoji: '🤘', name: 'metal' },
  { emoji: '🤙', name: 'call_me_hand' },
  { emoji: '👈', name: 'point_left' },
  { emoji: '👉', name: 'point_right' },
  { emoji: '👆', name: 'point_up_2' },
  { emoji: '🖕', name: 'middle_finger' },
  { emoji: '👇', name: 'point_down' },
  { emoji: '☝️', name: 'point_up' },
  { emoji: '👍', name: 'thumbsup' },
  { emoji: '👎', name: 'thumbsdown' },
  { emoji: '✊', name: 'fist' },
  { emoji: '👊', name: 'facepunch' },
  { emoji: '🤛', name: 'fist_left' },
  { emoji: '🤜', name: 'fist_right' },
  { emoji: '👏', name: 'clap' },
  { emoji: '🙌', name: 'raised_hands' },
  { emoji: '👐', name: 'open_hands' },
  { emoji: '🤲', name: 'palms_up_together' },
  { emoji: '🤝', name: 'handshake' },
  { emoji: '🙏', name: 'pray' },
  // 心形和符号
  { emoji: '❤️', name: 'heart' },
  { emoji: '🧡', name: 'orange_heart' },
  { emoji: '💛', name: 'yellow_heart' },
  { emoji: '💚', name: 'green_heart' },
  { emoji: '💙', name: 'blue_heart' },
  { emoji: '💜', name: 'purple_heart' },
  { emoji: '🖤', name: 'black_heart' },
  { emoji: '🤍', name: 'white_heart' },
  { emoji: '🤎', name: 'brown_heart' },
  { emoji: '💔', name: 'broken_heart' },
  { emoji: '❣️', name: 'heavy_heart_exclamation' },
  { emoji: '💕', name: 'two_hearts' },
  { emoji: '💞', name: 'revolving_hearts' },
  { emoji: '💓', name: 'heartbeat' },
  { emoji: '💗', name: 'heartpulse' },
  { emoji: '💖', name: 'sparkling_heart' },
  { emoji: '💘', name: 'cupid' },
  { emoji: '💝', name: 'gift_heart' },
  { emoji: '💟', name: 'heart_decoration' },
  { emoji: '☮️', name: 'peace_symbol' },
  { emoji: '✝️', name: 'latin_cross' },
  { emoji: '☪️', name: 'star_and_crescent' },
  { emoji: '🕉️', name: 'om' },
  { emoji: '☸️', name: 'wheel_of_dharma' },
  { emoji: '✡️', name: 'star_of_david' },
  { emoji: '🔯', name: 'six_pointed_star' },
  { emoji: '🕎', name: 'menorah' },
  { emoji: '☯️', name: 'yin_yang' },
  { emoji: '☦️', name: 'orthodox_cross' },
  { emoji: '🛐', name: 'place_of_worship' },
  { emoji: '⛎', name: 'ophiuchus' },
  { emoji: '♈', name: 'aries' },
  { emoji: '♉', name: 'taurus' },
  { emoji: '♊', name: 'gemini' },
  { emoji: '♋', name: 'cancer' },
  { emoji: '♌', name: 'leo' },
  { emoji: '♍', name: 'virgo' },
  { emoji: '♎', name: 'libra' },
  { emoji: '♏', name: 'scorpius' },
  { emoji: '♐', name: 'sagittarius' },
  { emoji: '♑', name: 'capricorn' },
  { emoji: '♒', name: 'aquarius' },
  { emoji: '♓', name: 'pisces' },
  { emoji: '🆔', name: 'id' },
  { emoji: '⚡', name: 'zap' },
  { emoji: '💥', name: 'boom' },
  { emoji: '💫', name: 'dizzy' },
  { emoji: '💦', name: 'sweat_drops' },
  { emoji: '💨', name: 'dash' },
  { emoji: '🕳️', name: 'hole' },
  { emoji: '💣', name: 'bomb' },
  { emoji: '💬', name: 'speech_balloon' },
  { emoji: '👁️‍🗨️', name: 'eye_speech_bubble' },
  { emoji: '🗨️', name: 'left_speech_bubble' },
  { emoji: '🗯️', name: 'right_anger_bubble' },
  { emoji: '💭', name: 'thought_balloon' },
  { emoji: '💤', name: 'zzz' }
]

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  onClose: () => void
  query?: string
  position?: { x: number; y: number }
}

export function EmojiPicker({ onEmojiSelect, onClose, query = '', position }: EmojiPickerProps) {
  const [filteredEmojis, setFilteredEmojis] = useState(EMOJI_LIST)

  useEffect(() => {
    if (query && query.trim()) {
      const queryLower = query.toLowerCase().trim()
      const filtered = EMOJI_LIST.filter(item => 
        item.name.toLowerCase().includes(queryLower) ||
        item.emoji.includes(query) ||
        // 支持部分匹配
        item.name.toLowerCase().startsWith(queryLower)
      )
      setFilteredEmojis(filtered.slice(0, 20)) // 限制显示数量
    } else {
      setFilteredEmojis(EMOJI_LIST.slice(0, 40)) // 默认显示前40个
    }
  }, [query])

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  // 计算更好的位置，避免被遮挡
  const getOptimalPosition = () => {
    if (!position) return {}
    
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const pickerWidth = 320 // 预估选择器宽度
    const pickerHeight = 240 // 预估选择器高度
    
    let left = position.x
    let top = position.y
    
    // 如果右侧空间不够，向左调整
    if (left + pickerWidth > viewportWidth) {
      left = viewportWidth - pickerWidth - 20
    }
    
    // 如果下方空间不够，向上显示
    if (top + pickerHeight > viewportHeight) {
      top = position.y - pickerHeight - 10
    }
    
    return { left: Math.max(10, left), top: Math.max(10, top) }
  }

  // 使用Portal将emoji面板渲染到body下，确保不被遮挡
  const emojiPanel = (
    <div 
      className="fixed bg-white border border-border rounded-lg shadow-xl p-3 w-80"
      style={{ 
        ...getOptimalPosition(), 
        zIndex: 2147483647 // 使用最大的z-index值
      }}
      onKeyDown={handleKeyDown}
    >
      {/* 搜索状态指示 */}
      {query && (
        <div className="text-xs text-blue-600 mb-2 font-medium">
          "{query}"
        </div>
      )}
      
      <div className="grid grid-cols-10 gap-1 max-h-52 overflow-y-auto">
        {filteredEmojis.map((item, index) => (
          <Button
            key={`${item.emoji}-${index}`}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-50 text-lg transition-colors"
            onClick={() => handleEmojiClick(item.emoji)}
            title={item.name}
          >
            {item.emoji}
          </Button>
        ))}
      </div>
      
      {filteredEmojis.length === 0 && query && (
        <div className="text-center text-muted-foreground text-sm py-6">
          No emojis found
        </div>
      )}
    </div>
  )

  // 使用Portal渲染到document.body
  return createPortal(emojiPanel, document.body)
}