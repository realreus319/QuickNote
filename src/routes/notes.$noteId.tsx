import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { NoteDetailHeader } from '@/components/notes/NoteDetailHeader'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { deleteNote, getNoteById, updateNote } from '@/db/notesRepo'
import type { LocalNoteAttachment } from '@/types/domain'
import {
  buildNoteContentSignature,
  buildNoteSnapshotSignature,
  shouldAutosaveNote,
} from '@/utils/noteHydration'
import { derivePlainTextFromStoredHtml } from '@/utils/noteRichHtml'
import { runWithViewTransition } from '@/utils/viewTransition'

function NoteDetailPage() {
  const { noteId } = Route.useParams()
  const navigate = useNavigate()
  const note = useLiveQuery(() => getNoteById(noteId), [noteId])
  const appliedNoteSnapshotRef = useRef<string | null>(null)
  const hydrationSignatureRef = useRef<string | null>(null)
  const isHydratingRef = useRef(true)
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('<p></p>')
  const [attachments, setAttachments] = useState<LocalNoteAttachment[]>([])

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

  async function handleShare() {
    const plainText = derivePlainTextFromStoredHtml(bodyHtml)
    const shareText = title ? `${title}\n\n${plainText}` : plainText

    try {
      if (navigator.share) {
        await navigator.share({
          title: title || 'QuickNote 便签',
          text: shareText,
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        toast('已复制便签内容')
      }
    } catch {
      toast('分享已取消')
    }
  }

  if (!note) {
    return <LoadingState label="正在打开便签…" />
  }

  if (note.deleted) {
    return <EmptyState title="便签已删除" description="这条便签已经移出列表。" />
  }

  return (
    <section
      className="min-h-screen bg-white"
      style={{
        viewTransitionName: `note-card-${note.id}`,
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-5 pt-3 pb-16 md:px-10 md:pt-6">
        <NoteDetailHeader
          pinned={note.pinned}
          onBack={() => runWithViewTransition(() => navigate({ to: '/notes' }))}
          onDelete={() => void handleDelete()}
          onShare={() => void handleShare()}
          onTogglePin={() => void handleTogglePinned()}
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
