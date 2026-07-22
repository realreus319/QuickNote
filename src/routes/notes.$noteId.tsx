import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useAuth } from '@/auth/useAuth'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { NoteDetailHeader } from '@/components/notes/NoteDetailHeader'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { RemoteAttachmentPanel } from '@/components/notes/RemoteAttachmentPanel'
import {
  cacheRemoteAttachment,
  deleteNote,
  getNoteById,
  updateNote,
} from '@/db/notesRepo'
import { downloadRemoteNoteAttachment } from '@/graph/notesApi'
import type { LocalNoteAttachment, NoteColor } from '@/types/domain'
import {
  buildNoteContentSignature,
  buildNoteSnapshotSignature,
  shouldAutosaveNote,
} from '@/utils/noteHydration'
import { derivePlainTextFromStoredHtml } from '@/utils/noteRichHtml'
import { normalizeNoteColor } from '@/utils/noteColor'
import { runWithViewTransition } from '@/utils/viewTransition'

function NoteDetailPage() {
  const { noteId } = Route.useParams()
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const note = useLiveQuery(() => getNoteById(noteId), [noteId])
  const appliedNoteSnapshotRef = useRef<string | null>(null)
  const hydrationSignatureRef = useRef<string | null>(null)
  const isHydratingRef = useRef(true)
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('<p></p>')
  const [attachments, setAttachments] = useState<LocalNoteAttachment[]>([])
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string>()

  useEffect(() => {
    if (!note) return

    const nextSnapshot = buildNoteSnapshotSignature(note)

    if (appliedNoteSnapshotRef.current === nextSnapshot) {
      return
    }

    appliedNoteSnapshotRef.current = nextSnapshot
    hydrationSignatureRef.current = buildNoteContentSignature(
      note.title,
      note.bodyHtml,
      note.attachments ?? [],
    )
    isHydratingRef.current = true
    setTitle(note.title)
    setBodyHtml(note.bodyHtml)
    setAttachments(note.attachments ?? [])
  }, [note])

  useEffect(() => {
    if (!note || !isHydratingRef.current || !hydrationSignatureRef.current) {
      return
    }

    const currentSignature = buildNoteContentSignature(title, bodyHtml, attachments)

    if (currentSignature !== hydrationSignatureRef.current) {
      return
    }

    isHydratingRef.current = false
  }, [attachments, bodyHtml, note, title])

  useEffect(() => {
    if (!note) return

    const currentSignature = buildNoteContentSignature(title, bodyHtml, attachments)

    if (!shouldAutosaveNote(currentSignature, hydrationSignatureRef.current, isHydratingRef.current)) {
      return
    }

    const timer = window.setTimeout(() => {
      void updateNote(noteId, {
        title,
        bodyHtml,
        attachments,
      })
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [attachments, bodyHtml, note, noteId, title])

  async function handleDelete() {
    await deleteNote(noteId)
    runWithViewTransition(() => navigate({ to: '/notes' }))
  }

  async function handleTogglePinned() {
    if (!note) return

    await updateNote(noteId, {
      pinned: !note.pinned,
    })
  }

  async function handleColorChange(color: NoteColor) {
    if (!note || normalizeNoteColor(note.color) === color) return
    await updateNote(noteId, { color })
  }

  async function handleLoadAttachment(attachment: LocalNoteAttachment) {
    if (!note?.remoteId || loadingAttachmentId) return

    setLoadingAttachmentId(attachment.id)

    try {
      const accessToken = await getAccessToken()
      const downloaded = await downloadRemoteNoteAttachment(
        accessToken,
        note.remoteId,
        attachment,
      )
      await cacheRemoteAttachment(noteId, downloaded)
      setAttachments((current) =>
        current.map((candidate) =>
          candidate.id === downloaded.id ? downloaded : candidate,
        ),
      )
      toast('图片已加载')
    } catch (error) {
      toast(error instanceof Error ? error.message : '图片加载失败')
    } finally {
      setLoadingAttachmentId(undefined)
    }
  }

  async function handleShare() {
    const plainText = derivePlainTextFromStoredHtml(bodyHtml)
    const shareText = title ? `${title}\n\n${plainText}` : plainText

    try {
      if (navigator.share) {
        await navigator.share({
          title: title || 'QuickNote 笔记',
          text: shareText,
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        toast('已复制笔记内容')
      }
    } catch {
      toast('分享已取消')
    }
  }

  if (!note) {
    return <LoadingState label="正在打开笔记…" />
  }

  if (note.deleted) {
    return <EmptyState title="笔记已删除" description="这条笔记已经移出列表。" />
  }

  return (
    <section
      className="note-paper note-detail-surface min-h-dvh"
      data-note-color={normalizeNoteColor(note.color)}
      style={{ viewTransitionName: `note-card-${note.id}` }}
    >
      <div className="mx-auto w-full max-w-[900px] px-4 pb-10 sm:px-6 lg:px-10">
        <NoteDetailHeader
          pinned={note.pinned}
          color={normalizeNoteColor(note.color)}
          syncStatus={note.syncStatus}
          onBack={() => runWithViewTransition(() => navigate({ to: '/notes' }))}
          onDelete={() => void handleDelete()}
          onShare={() => void handleShare()}
          onColorChange={(color) => void handleColorChange(color)}
          onTogglePin={() => void handleTogglePinned()}
        />
        <RemoteAttachmentPanel
          attachments={attachments}
          loadingAttachmentId={loadingAttachmentId}
          onLoadAttachment={(attachment) => void handleLoadAttachment(attachment)}
        />
        <NoteEditor
          title={title}
          bodyHtml={bodyHtml}
          updatedAt={note.updatedAt}
          attachments={attachments}
          onTitleChange={setTitle}
          onBodyHtmlChange={setBodyHtml}
          onAttachmentsChange={setAttachments}
        />
      </div>
    </section>
  )
}

export const Route = createFileRoute('/notes/$noteId')({
  component: NoteDetailPage,
})
