import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudOff, Pin, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getActiveOwnerKey } from '@/db/accountScope'
import { getNoteAttachmentBlob } from '@/db/attachmentBlobRepo'
import type { LocalNote } from '@/types/domain'
import { formatNoteDate } from '@/utils/date'
import { normalizeNoteColor } from '@/utils/noteColor'
import { getExcerpt } from '@/utils/text'

const syncStatusMap = {
  pending: {
    icon: CloudOff,
    label: '待同步',
    className: 'text-[color:var(--note-muted)]',
  },
  error: {
    icon: TriangleAlert,
    label: '同步失败',
    className: 'text-[color:var(--color-danger)]',
  },
  conflict: {
    icon: TriangleAlert,
    label: '需要处理',
    className: 'text-[color:var(--color-danger)]',
  },
} as const

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }

    const nextUrl = URL.createObjectURL(blob)
    setUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [blob])

  return url
}

function NoteCardPreview({ note }: { note: LocalNote }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const previewImage = note.attachments.find(
    (attachment) =>
      attachment.mimeType.startsWith('image/') &&
      attachment.storageState !== 'remote-only',
  )
  const ownerKey = note.ownerKey ?? getActiveOwnerKey()

  useEffect(() => {
    const element = containerRef.current

    if (!element || !previewImage || visible) return

    if (typeof IntersectionObserver !== 'function') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [previewImage, visible])

  const blob = useLiveQuery(
    () =>
      visible && previewImage && ownerKey
        ? getNoteAttachmentBlob(note.id, previewImage.id, ownerKey)
        : Promise.resolve(undefined),
    [note.id, ownerKey, previewImage?.id, visible],
  )
  const objectUrl = useObjectUrl(blob)

  if (!previewImage) return null

  return (
    <div
      ref={containerRef}
      className="order-first mb-3 aspect-[4/3] w-full max-w-full overflow-hidden rounded-[11px] border border-[color:var(--note-line)] bg-[color:var(--note-paper-raised)]"
    >
      {objectUrl ? (
        <img
          src={objectUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : null}
    </div>
  )
}

export function NoteCard({ note }: { note: LocalNote }) {
  const syncStatus =
    note.syncStatus === 'synced' ? null : syncStatusMap[note.syncStatus]
  const SyncIcon = syncStatus?.icon

  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: note.id }}
      viewTransition
      className="note-paper note-paper-card group block min-w-0 max-w-full overflow-hidden rounded-[15px] border p-3 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 sm:p-4"
      data-note-color={normalizeNoteColor(note.color)}
      style={{ viewTransitionName: `note-card-${note.id}` }}
    >
      <article className="flex min-w-0 max-w-full flex-col overflow-hidden">
        <NoteCardPreview note={note} />

        <div className="min-w-0 max-w-full overflow-hidden">
          <div className="flex min-w-0 items-start gap-1.5">
            <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-[15px] leading-[1.45] font-semibold tracking-[-0.01em] text-[color:var(--note-ink)] [overflow-wrap:anywhere] sm:text-[16px] sm:leading-6">
              {note.title || '未命名便签'}
            </h3>
            {note.pinned ? (
              <Pin
                className="mt-1 size-3.5 shrink-0 text-[color:var(--note-accent)]"
                aria-label="已固定"
              />
            ) : null}
          </div>

          <p className="mt-2 line-clamp-4 min-w-0 max-w-full break-words whitespace-pre-wrap text-[13px] leading-[1.65] text-[color:var(--note-muted)] [overflow-wrap:anywhere] sm:line-clamp-3 sm:text-[14px] sm:leading-6">
            {getExcerpt(note.content || '点击开始记录内容', 150)}
          </p>

          <div className="mt-3 flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-[10px] text-[color:var(--note-muted)] sm:mt-4 sm:text-[11px]">
            {syncStatus && SyncIcon ? (
              <span
                className={`inline-flex min-w-0 items-center gap-1 truncate ${syncStatus.className}`}
              >
                <SyncIcon className="size-3 shrink-0" />
                <span className="truncate">{syncStatus.label}</span>
              </span>
            ) : null}
            <time className="ml-auto shrink-0" dateTime={note.updatedAt}>
              {formatNoteDate(note.updatedAt)}
            </time>
          </div>
        </div>
      </article>
    </Link>
  )
}
