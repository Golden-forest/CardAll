import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tag, MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { 
  TagContextMenu,
  RenameTagDialog,
  DeleteTagDialog,
  ConnectedTagPanel
} from '@/components/tag'

interface TagOperationsProps {
  tags: any[]
  popularTags: any[]
  renameTag: (oldName: string, newName: string) => Promise<void>
  deleteTagByName: (tagName: string) => boolean
  getAllTagNames: () => string[]
  filter: any
  setFilter: (filter: any) => void
}

export function TagOperations({
  tags,
  popularTags,
  renameTag,
  deleteTagByName,
  getAllTagNames,
  filter,
  setFilter
}: TagOperationsProps) {
  const { toast } = useToast()
  const [tagSearchTerm, setTagSearchTerm] = useState('')
  const [contextMenuTag, setContextMenuTag] = useState<any>(null)
  const [renameTagData, setRenameTagData] = useState<{ oldName: string; newName: string } | null>(null)
  const [deleteTagName, setDeleteTagName] = useState<string | null>(null)

  // 过滤标签
  const filteredTags = React.useMemo(() => {
    if (!tagSearchTerm.trim()) return tags
    
    const searchLower = tagSearchTerm.toLowerCase()
    return tags.filter(tag => 
      tag.name.toLowerCase().includes(searchLower)
    )
  }, [tags, tagSearchTerm])

  // 处理标签选择
  const handleTagSelect = (tagName: string) => {
    setFilter(prev => ({
      ...prev,
      selectedTagIds: prev.selectedTagIds?.includes(tagName)
        ? prev.selectedTagIds.filter(id => id !== tagName)
        : [...(prev.selectedTagIds || []), tagName]
    }))
  }

  // 重命名标签
  const handleRenameTag = async (oldName: string, newName: string) => {
    try {
      await renameTag(oldName, newName)
      toast({
        title: "重命名成功",
        description: `标签已从 "${oldName}" 重命名为 "${newName}"`
      })
    } catch (error) {
      console.error('Failed to rename tag:', error)
      toast({
        title: "重命名失败",
        description: "无法重命名标签",
        variant: "destructive"
      })
    }
  }

  // 删除标签
  const handleDeleteTag = (tagName: string) => {
    try {
      const success = deleteTagByName(tagName)
      if (success) {
        toast({
          title: "删除成功",
          description: `标签 "${tagName}" 已删除`
        })
      } else {
        toast({
          title: "删除失败",
          description: "无法删除标签",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Failed to delete tag:', error)
      toast({
        title: "删除失败",
        description: "删除过程中发生错误",
        variant: "destructive"
      })
    }
  }

  // 清除标签过滤器
  const handleClearTagFilters = () => {
    setFilter(prev => ({ ...prev, selectedTagIds: [] }))
  }

  return (
    <div className="space-y-4">
      {/* 标签搜索 */}
      <div className="relative">
        <Input
          placeholder="搜索标签..."
          value={tagSearchTerm}
          onChange={(e) => setTagSearchTerm(e.target.value)}
          className="pr-8"
        />
        {tagSearchTerm && (
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => setTagSearchTerm('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* 选中的标签过滤器 */}
      {filter.selectedTagIds?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">选中的标签:</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearTagFilters}
              className="h-6 px-2 text-xs"
            >
              清除全部
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {filter.selectedTagIds.map(tagId => (
              <Badge
                key={tagId}
                variant="default"
                className="gap-1 bg-blue-500 hover:bg-blue-600"
              >
                {tagId}
                <button
                  onClick={() => handleTagSelect(tagId)}
                  className="ml-1 hover:bg-blue-400 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 热门标签 */}
      {popularTags.length > 0 && !tagSearchTerm && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">热门标签</h3>
          <div className="flex flex-wrap gap-1">
            {popularTags.slice(0, 10).map(tag => (
              <Badge
                key={tag.id}
                variant={filter.selectedTagIds?.includes(tag.name) ? "default" : "secondary"}
                className={cn(
                  "cursor-pointer gap-1",
                  filter.selectedTagIds?.includes(tag.name) 
                    ? "bg-blue-500 hover:bg-blue-600" 
                    : "hover:bg-gray-200"
                )}
                onClick={() => handleTagSelect(tag.name)}
                style={{ backgroundColor: filter.selectedTagIds?.includes(tag.name) ? undefined : tag.color + '20' }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                <span className="text-xs">({tag.count})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 所有标签 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            {tagSearchTerm ? '搜索结果' : '所有标签'}
          </h3>
          <span className="text-xs text-gray-500">
            {filteredTags.length} 个标签
          </span>
        </div>
        
        {filteredTags.length > 0 ? (
          <div className="flex flex-wrap gap-1 max-h-64 overflow-y-auto">
            {filteredTags.map(tag => (
              <Badge
                key={tag.id}
                variant={filter.selectedTagIds?.includes(tag.name) ? "default" : "secondary"}
                className={cn(
                  "cursor-pointer gap-1 group",
                  filter.selectedTagIds?.includes(tag.name) 
                    ? "bg-blue-500 hover:bg-blue-600" 
                    : "hover:bg-gray-200"
                )}
                onClick={() => handleTagSelect(tag.name)}
                style={{ backgroundColor: filter.selectedTagIds?.includes(tag.name) ? undefined : tag.color + '20' }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenuTag(tag)
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                <span className="text-xs">({tag.count})</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 h-4 w-4 p-0 ml-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    setContextMenuTag(tag)
                  }}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            {tagSearchTerm ? '没有找到匹配的标签' : '暂无标签'}
          </div>
        )}
      </div>

      {/* 标签上下文菜单 */}
      {contextMenuTag && (
        <TagContextMenu
          tag={contextMenuTag}
          position={{ x: 0, y: 0 }}
          onClose={() => setContextMenuTag(null)}
          onRename={(newName) => {
            setRenameTagData({ oldName: contextMenuTag.name, newName })
            setContextMenuTag(null)
          }}
          onDelete={() => {
            setDeleteTagName(contextMenuTag.name)
            setContextMenuTag(null)
          }}
        />
      )}

      {/* 重命名标签对话框 */}
      {renameTagData && (
        <RenameTagDialog
          open={!!renameTagData}
          onOpenChange={(open) => !open && setRenameTagData(null)}
          tag={renameTagData}
          onConfirm={handleRenameTag}
        />
      )}

      {/* 删除标签对话框 */}
      {deleteTagName && (
        <DeleteTagDialog
          tagName={deleteTagName}
          open={!!deleteTagName}
          onOpenChange={(open) => !open && setDeleteTagName(null)}
          onConfirm={handleDeleteTag}
        />
      )}
    </div>
  )
}