import { ArrowLeft, Check, CloudOff, MoreHorizontal, Pin, Share2, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NoteSyncStatus } from '@/types/domain'

interface NoteDetailHeaderProps {
  pinned: boolean
  syncStatus: NoteSyncStatus
  onBack: () => void
  onDelete: () => void
  onShare: () => void
  onTogglePin: () => void
}

const syncPresentation = {
  synced: { icon: Check, label: '已同步', className: 'text-text-muted' },
  pending: { icon: CloudOff, label: '等待同步', className: 'text-text-muted' },
  conflict: { icon: TriangleAlert, label: '需要处理', className: 'text-[color:var(--color-danger)]' },
  error: { icon: TriangleAlert, label: '同步失败', className: 'text-[color:var(--color-danger)]' },
} as const

export function NoteDetailHeader({
  pinned,
  syncStatus,
  onBack,
  onDelete,
  onShare,
  onTogglePin,
}: NoteDetailHeaderProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const currentSync = syncPresentation[syncStatus]
  const SyncIcon = currentSync.icon

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 flex min-h-16 items-center justify-between border-b border-divider/75 bg-white/92 px-3 backdrop-blur-xl sm:-mx-6 sm:px-5 lg:-mx-10 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-[11px]"
            onClick={onBack}
            aria-label="返回笔记列表"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <span className={`hidden items-center gap-1.5 text-xs sm:inline-flex ${currentSync.className}`}>
            <SyncIcon className="size-3.5" />
            {currentSync.label}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-[11px]"
            onClick={onShare}
            aria-label="分享笔记"
          >
            <Share2 className="size-[18px]" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="rounded-[11px]" aria-label="更多操作">
                <MoreHorizontal className="size-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={onTogglePin}>
                <Pin className="size-4" />
                {pinned ? '取消固定' : '固定笔记'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-[color:var(--color-danger)] focus:text-[color:var(--color-danger)]"
              >
                <Trash2 className="size-4" />
                删除笔记
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[rgba(201,79,69,0.08)] text-[color:var(--color-danger)]">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>删除这条笔记？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后会进入同步队列，并在联网时同步到 Microsoft。此操作无法在 QuickNote 内撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false)
                onDelete()
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
