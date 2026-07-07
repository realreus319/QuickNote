import {
  Bold,
  ClipboardPaste,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { LocalNoteAttachment } from '@/types/domain'
import { formatLongDate } from '@/utils/date'
import {
  base64ToBlob,
  base64ToDataUrl,
  derivePlainTextFromStoredHtml,
  fileToLocalNoteAttachment,
  hydrateLocalNoteHtml,
  isSupportedNoteImageType,
  MAX_NOTE_ATTACHMENT_BYTES,
  pruneAttachmentsForStoredHtml,
  storeEditorNoteHtml,
} from '@/utils/noteRichHtml'
import { getWordCount } from '@/utils/text'

interface NoteEditorProps {
  title: string
  bodyHtml: string
  updatedAt?: string
  attachments: LocalNoteAttachment[]
  onTitleChange: (value: string) => void
  onBodyHtmlChange: (value: string) => void
  onAttachmentsChange: (value: LocalNoteAttachment[]) => void
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sameAttachments(left: LocalNoteAttachment[], right: LocalNoteAttachment[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((attachment, index) => {
    const candidate = right[index]

    return (
      candidate?.id === attachment.id &&
      candidate?.base64 === attachment.base64 &&
      candidate?.contentId === attachment.contentId
    )
  })
}

export function NoteEditor({
  title,
  bodyHtml,
  updatedAt,
  attachments,
  onTitleChange,
  onBodyHtmlChange,
  onAttachmentsChange,
}: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const bodyHtmlRef = useRef(bodyHtml)
  const pendingBodyHtmlRef = useRef(bodyHtml)
  const plainText = useMemo(() => derivePlainTextFromStoredHtml(bodyHtml), [bodyHtml])

  useEffect(() => {
    bodyHtmlRef.current = bodyHtml
  }, [bodyHtml])

  useEffect(() => {
    const editor = editorRef.current

    if (!editor) {
      return
    }

    const hydratedHtml = hydrateLocalNoteHtml(bodyHtml, attachments)

    if (editor.innerHTML !== hydratedHtml) {
      editor.innerHTML = hydratedHtml
    }

    pendingBodyHtmlRef.current = bodyHtml
  }, [attachments, bodyHtml])

  useEffect(() => {
    function rememberSelection() {
      const editor = editorRef.current
      const selection = window.getSelection()

      if (!editor || !selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
        return
      }

      selectionRef.current = selection.getRangeAt(0).cloneRange()
    }

    document.addEventListener('selectionchange', rememberSelection)

    return () => {
      document.removeEventListener('selectionchange', rememberSelection)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  function syncEditorState(nextAttachments = attachments, immediate = false) {
    const editor = editorRef.current

    if (!editor) {
      return
    }

    const storedHtml = storeEditorNoteHtml(editor.innerHTML, nextAttachments)
    const prunedAttachments = pruneAttachmentsForStoredHtml(nextAttachments, storedHtml)
    pendingBodyHtmlRef.current = storedHtml

    if (!sameAttachments(prunedAttachments, attachments)) {
      onAttachmentsChange(prunedAttachments)
    }

    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
    }

    if (immediate) {
      if (storedHtml !== bodyHtmlRef.current) {
        bodyHtmlRef.current = storedHtml
        onBodyHtmlChange(storedHtml)
      }
      return
    }

    saveTimerRef.current = window.setTimeout(() => {
      const nextHtml = pendingBodyHtmlRef.current

      if (nextHtml !== bodyHtmlRef.current) {
        bodyHtmlRef.current = nextHtml
        onBodyHtmlChange(nextHtml)
      }
    }, 180)
  }

  function focusEditor() {
    editorRef.current?.focus()
  }

  function restoreSelection() {
    const selection = window.getSelection()

    focusEditor()

    if (!selectionRef.current || !selection) {
      return
    }

    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
  }

  function insertHtmlAtCursor(html: string) {
    const editor = editorRef.current

    if (!editor) {
      return
    }

    restoreSelection()
    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      editor.insertAdjacentHTML('beforeend', html)
      focusEditor()
      return
    }

    const range = selection.getRangeAt(0)
    range.deleteContents()

    const container = document.createElement('div')
    container.innerHTML = html
    const fragment = document.createDocumentFragment()
    let lastNode: ChildNode | null = null

    while (container.firstChild) {
      lastNode = fragment.appendChild(container.firstChild)
    }

    range.insertNode(fragment)

    if (lastNode) {
      range.setStartAfter(lastNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    focusEditor()
  }

  function execRichCommand(command: string) {
    restoreSelection()
    document.execCommand(command)
    selectionRef.current = window.getSelection()?.rangeCount
      ? window.getSelection()?.getRangeAt(0).cloneRange() ?? null
      : null
    syncEditorState(undefined, false)
  }

  function keepEditorSelection(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  async function appendFiles(files: File[]) {
    const nextAttachments = [...attachments]

    for (const file of files) {
      if (!isSupportedNoteImageType(file.type)) {
        toast('仅支持 PNG、JPEG、GIF 和 BMP 图片')
        continue
      }

      if (file.size > MAX_NOTE_ATTACHMENT_BYTES) {
        toast('图片超过 35 MB，当前无法添加')
        continue
      }

      const attachment = await fileToLocalNoteAttachment(file)
      nextAttachments.push(attachment)
      const src = base64ToDataUrl(attachment.base64, attachment.mimeType)
      insertHtmlAtCursor(
        `<figure data-quicknote-image="true" contenteditable="false" draggable="false"><img src="${escapeAttribute(src)}" data-attachment-id="${escapeAttribute(attachment.id)}" alt="${escapeAttribute(attachment.name)}" draggable="false" /></figure><p><br></p>`,
      )
    }

    syncEditorState(nextAttachments, true)
  }

  async function handleClipboardRead() {
    if (!navigator.clipboard?.read) {
      toast('当前浏览器不支持主动读取剪贴板图片')
      return
    }

    try {
      const clipboardItems = await navigator.clipboard.read()
      const files: File[] = []

      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) {
            continue
          }

          const blob = await item.getType(type)
          const extension = type.split('/')[1] ?? 'png'
          files.push(new File([blob], `clipboard-${Date.now()}.${extension}`, { type }))
        }
      }

      if (!files.length) {
        toast('剪贴板里没有可用图片')
        return
      }

      await appendFiles(files)
    } catch {
      toast('读取剪贴板图片失败')
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))

    if (!files.length) {
      return
    }

    event.preventDefault()
    await appendFiles(files)
  }

  async function handleCopyFirstImage() {
    const firstAttachment = attachments[0]

    if (!firstAttachment) {
      toast('当前没有图片可复制')
      return
    }

    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      toast('当前浏览器不支持复制图片到剪贴板')
      return
    }

    try {
      const blob = base64ToBlob(firstAttachment.base64, firstAttachment.mimeType)
      await navigator.clipboard.write([
        new ClipboardItem({
          [firstAttachment.mimeType]: blob,
        }),
      ])
      toast('已复制首张图片')
    } catch {
      toast('复制图片失败')
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onPointerDown={keepEditorSelection}
          onClick={() => execRichCommand('bold')}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onPointerDown={keepEditorSelection}
          onClick={() => execRichCommand('italic')}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onPointerDown={keepEditorSelection}
          onClick={() => execRichCommand('strikeThrough')}
        >
          <Strikethrough className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onPointerDown={keepEditorSelection}
          onClick={() => execRichCommand('insertUnorderedList')}
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onPointerDown={keepEditorSelection}
          onClick={() => execRichCommand('insertOrderedList')}
        >
          <ListOrdered className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onPointerDown={keepEditorSelection}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onPointerDown={keepEditorSelection}
          onClick={() => void handleClipboardRead()}
        >
          <ClipboardPaste className="size-4" />
        </Button>
        {attachments.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full text-xs"
            onPointerDown={keepEditorSelection}
            onClick={() => void handleCopyFirstImage()}
          >
            复制图片
          </Button>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/bmp"
        className="hidden"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])

          if (files.length) {
            void appendFiles(files)
          }

          event.target.value = ''
        }}
      />

      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="标题"
        className="w-full border-none bg-transparent px-0 text-[31px] leading-tight font-semibold tracking-[-0.06em] text-text-primary outline-none placeholder:text-[#d4d4d4]"
      />

      <p className="mt-4 text-[13px] text-text-muted">
        {formatLongDate(updatedAt)} ｜ {getWordCount(title, plainText)}
      </p>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
          data-placeholder="开始记录今天的内容。"
          className="note-rich-editor mt-8 min-h-[60svh] text-[18px] leading-9 text-text-primary outline-none"
          onInput={() => syncEditorState(undefined, false)}
          onPasteCapture={(event) => void handlePaste(event)}
        />

      <p className="mt-8 text-xs text-text-muted">已自动保存到本地，在线时会继续同步。</p>
    </div>
  )
}
