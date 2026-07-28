import { CloudDownload, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { LocalNoteAttachment } from '@/types/domain'
import { formatAttachmentSize } from '@/utils/noteAttachments'

interface RemoteAttachmentPanelProps {
  attachments: LocalNoteAttachment[]
  loadingAttachmentId?: string
  onLoadAttachment: (attachment: LocalNoteAttachment) => void
}

export function RemoteAttachmentPanel({
  attachments,
  loadingAttachmentId,
  onLoadAttachment,
}: RemoteAttachmentPanelProps) {
  const remoteOnlyAttachments = attachments.filter(
    (attachment) =>
      attachment.storageState === 'remote-only' || !attachment.base64,
  )

  if (!remoteOnlyAttachments.length) {
    return null
  }

  return (
    <aside
      className="mt-5 space-y-2 rounded-[14px] border border-[color:var(--note-line,var(--color-divider))] bg-[color:var(--note-paper-raised,var(--color-surface))] p-3"
      aria-label="尚未加载的远端图片"
    >
      <p className="text-xs leading-5 text-[color:var(--note-muted,var(--color-text-muted))]">
        为减少流量和内存占用，大图片不会自动下载。需要查看时再加载原图。
      </p>

      {remoteOnlyAttachments.map((attachment) => {
        const loading = loadingAttachmentId === attachment.id

        return (
          <div
            key={attachment.id}
            className="flex min-w-0 items-center gap-3 rounded-[11px] border border-[color:var(--note-line,var(--color-divider))] px-3 py-2.5"
          >
            <CloudDownload className="size-4 shrink-0 text-[color:var(--note-muted,var(--color-text-muted))]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[color:var(--note-ink,var(--color-text-primary))]">
                {attachment.name || '远端图片'}
              </p>
              <p className="text-xs text-[color:var(--note-muted,var(--color-text-muted))]">
                {formatAttachmentSize(attachment.size)}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 rounded-[10px]"
              disabled={Boolean(loadingAttachmentId)}
              onClick={() => onLoadAttachment(attachment)}
            >
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                '加载原图'
              )}
            </Button>
          </div>
        )
      })}
    </aside>
  )
}
