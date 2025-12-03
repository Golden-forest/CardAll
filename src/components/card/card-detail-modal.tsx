import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CardType, CardContentType } from '@/types/card';
import { CardSide } from './card-side';

interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardType | null;
  onCardUpdate: (cardId: string, updates: any) => void;
  onFlip: (cardId: string) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  isOpen,
  onClose,
  card,
  onCardUpdate,
  onFlip
}) => {
  if (!card) return null;

  // 临时处理函数，因为CardSide需要这些props但在查看模式下不会使用
  const handleTempContentUpdate = (_field: keyof CardContentType, _value: any) => {
    // 在查看模式下不处理
  };

  const handleDoubleClick = (_field: 'title' | 'content') => {
    // 在查看模式下不处理
  };

  const handleKeyDown = (_e: React.KeyboardEvent) => {
    // 在查看模式下不处理
  };

  const handleEdit = (_e: React.MouseEvent) => {
    // 在查看模式下不处理
  };

  const handleCopy = () => {
    // 在查看模式下不处理
  };

  const handleScreenshot = () => {
    // 在查看模式下不处理
  };

  const handleShare = () => {
    // 在查看模式下不处理
  };

  const handleDelete = () => {
    // 在查看模式下不处理
  };

  const handleStyleChange = () => {
    // 在查看模式下不处理
  };

  const handleTagsChange = () => {
    // 在查看模式下不处理
  };

  const handleMoveToFolder = () => {
    // 在查看模式下不处理
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          {/* 卡片标题 */}
          <h2 className="text-2xl font-bold mb-6">
            {card.frontContent.title || 'Untitled Card'}
          </h2>
          
          {/* 卡片内容 */}
          <div className="border rounded-xl shadow-lg p-6">
            <CardSide
              content={card.isFlipped ? card.backContent : card.frontContent}
              isEditing={false}
              editingField={null}
              _onTitleChange={() => {}} // 废弃的prop，保持兼容
              _onTextChange={() => {}} // 废弃的prop，保持兼容
              onTempContentUpdate={handleTempContentUpdate}
              onSaveEdit={() => {}} // 在查看模式下不处理
              onCancelEdit={() => {}} // 在查看模式下不处理
              onDoubleClick={handleDoubleClick}
              _onKeyDown={handleKeyDown}
              _sideLabel={card.isFlipped ? 'Back' : 'Front'}
              isHovered={false}
              onEdit={handleEdit}
              onFlip={() => onFlip(card.id)}
              onCopy={handleCopy}
              onScreenshot={handleScreenshot}
              onShare={handleShare}
              onDelete={handleDelete}
              onStyleChange={handleStyleChange}
              onTagsChange={handleTagsChange}
              onMoveToFolder={handleMoveToFolder}
              _card={card}
              isFlipping={false}
              isCurrentlyFlipped={card.isFlipped}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};