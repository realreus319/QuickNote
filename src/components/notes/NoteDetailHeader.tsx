import { ArrowLeft, MoreHorizontal, Palette, Pin, Share2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NoteDetailHeaderProps {
  pinned: boolean
  onBack: () => void
  onDelete: () => void
  onShare: () => void
  onTogglePin: () => void
}

export function NoteDetailHeader({
  pinned,
  onBack,
  onDelete,
  onShare,
  onTogglePin,
}: NoteDetailHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <Button variant="ghost" size="icon-lg" className="rounded-full" onClick={onBack}>
        <ArrowLeft className="size-5" />
      </Button>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-lg" className="rounded-full" onClick={onShare}>
          <Share2 className="size-4.5" />
        </Button>
        <Button variant="ghost" size="icon-lg" className="rounded-full">
          <Palette className="size-4.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-lg" className="rounded-full">
              <MoreHorizontal className="size-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTogglePin}>
              <Pin className="size-4" />
              {pinned ? '取消固定' : '固定便签'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-[color:var(--color-danger)]">
              <Trash2 className="size-4" />
              删除便签
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
