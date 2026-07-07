import { EditorContent, type Editor as TiptapEditor, useEditor, useEditorState } from '@tiptap/react'
import {
  Bold,
  ClipboardPaste,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { buildQuickNoteTiptapExtensions } from '@/components/notes/quickNoteTiptap'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

const DEFAULT_TOOLBAR_STATE = {
  bold: false,
  italic: false,
  strike: false,
  bulletList: false,
  orderedList: false,
}

const NOTE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/bmp'
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

function buildImageInsertContent(attachments: LocalNoteAttachment[]) {
  return attachments.flatMap((attachment) => [
    {
      type: 'quickNoteImage',
      attrs: {
        src: base64ToDataUrl(attachment.base64, attachment.mimeType),
        alt: attachment.name,
        attachmentId: attachment.id,
      },
    },
    {
      type: 'paragraph',
    },
  ])
}

function syncEditorDomState(editor: TiptapEditor) {
  const dom = editor.view.dom
  dom.dataset.empty = editor.isEmpty ? 'true' : 'false'
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
  const editorRef = useRef<TiptapEditor | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bodyHtmlRef = useRef(bodyHtml)
  const attachmentsRef = useRef(attachments)
  const plainText = useMemo(() => derivePlainTextFromStoredHtml(bodyHtml), [bodyHtml])

  useEffect(() => {
    bodyHtmlRef.current = bodyHtml
  }, [bodyHtml])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  const syncEditorState = useCallback(
    (editorHtml: string, nextAttachments = attachmentsRef.current) => {
      const storedHtml = storeEditorNoteHtml(editorHtml, nextAttachments)
      const prunedAttachments = pruneAttachmentsForStoredHtml(nextAttachments, storedHtml)

      if (!sameAttachments(prunedAttachments, attachmentsRef.current)) {
        attachmentsRef.current = prunedAttachments
        onAttachmentsChange(prunedAttachments)
      } else {
        attachmentsRef.current = prunedAttachments
      }

      if (storedHtml !== bodyHtmlRef.current) {
        bodyHtmlRef.current = storedHtml
        onBodyHtmlChange(storedHtml)
      }
    },
    [onAttachmentsChange, onBodyHtmlChange],
  )

  const appendFiles = useCallback(
    async (files: File[], activeEditor: TiptapEditor | null, position?: number) => {
      if (!files.length) {
        return
      }

      const nextAttachments = [...attachmentsRef.current]
      const insertedAttachments: LocalNoteAttachment[] = []

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
        insertedAttachments.push(attachment)
      }

      if (!insertedAttachments.length || !activeEditor) {
        return
      }

      attachmentsRef.current = nextAttachments

      const content = buildImageInsertContent(insertedAttachments)

      if (position == null) {
        activeEditor.chain().focus().insertContent(content).run()
      } else {
        activeEditor.commands.insertContentAt(position, content, {
          updateSelection: true,
        })
        activeEditor.commands.focus()
      }

      syncEditorDomState(activeEditor)
      syncEditorState(activeEditor.getHTML(), nextAttachments)
    },
    [syncEditorState],
  )

  const editorExtensions = useMemo(() => buildQuickNoteTiptapExtensions(), [])

  const editor = useEditor({
    extensions: editorExtensions,
    content: hydrateLocalNoteHtml(bodyHtml, attachments),
    editorProps: {
      attributes: {
        class:
          'note-rich-editor min-h-[60svh] text-[18px] leading-9 text-text-primary outline-none',
        'data-placeholder': '开始记录今天的内容。',
        spellcheck: 'true',
        autocapitalize: 'sentences',
      },
    },
    onCreate: ({ editor: activeEditor }) => {
      editorRef.current = activeEditor
      syncEditorDomState(activeEditor)
    },
    onUpdate: ({ editor: activeEditor }) => {
      syncEditorDomState(activeEditor)
      syncEditorState(activeEditor.getHTML(), attachmentsRef.current)
    },
  }, [editorExtensions])

  const toolbarState =
    useEditorState({
      editor,
      selector: ({ editor: activeEditor }) =>
        activeEditor
          ? {
              bold: activeEditor.isActive('bold'),
              italic: activeEditor.isActive('italic'),
              strike: activeEditor.isActive('strike'),
              bulletList: activeEditor.isActive('bulletList'),
              orderedList: activeEditor.isActive('orderedList'),
            }
          : DEFAULT_TOOLBAR_STATE,
    }) ?? DEFAULT_TOOLBAR_STATE

  useEffect(() => {
    if (!editor) {
      return
    }

    editorRef.current = editor
    const hydratedHtml = hydrateLocalNoteHtml(bodyHtml, attachments)

    if (editor.getHTML() !== hydratedHtml) {
      editor.commands.setContent(hydratedHtml, {
        emitUpdate: false,
      })
      syncEditorDomState(editor)
    }
  }, [attachments, bodyHtml, editor])

  function keepEditorSelection(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
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

      await appendFiles(files, editorRef.current)
    } catch {
      toast('读取剪贴板图片失败')
    }
  }

  async function handleCopyFirstImage() {
    const firstAttachment = attachmentsRef.current[0]

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

  function runEditorCommand(command: (activeEditor: TiptapEditor) => boolean) {
    if (!editor) {
      return
    }

    command(editor)
    syncEditorDomState(editor)
  }

  async function handlePasteCapture(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))

    if (!files.length) {
      return
    }

    event.preventDefault()
    await appendFiles(files, editorRef.current)
  }

  async function handleDropCapture(event: React.DragEvent<HTMLDivElement>) {
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))

    if (!files.length) {
      return
    }

    event.preventDefault()

    const activeEditor = editorRef.current
    const position = activeEditor?.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })?.pos

    await appendFiles(files, activeEditor, position)
  }

  return (
    <div>
      <div className="sticky top-0 z-20 border-b border-divider/80 bg-white px-0 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={toolbarState.bold ? 'secondary' : 'ghost'}
            size="icon-sm"
            className={cn('rounded-full', toolbarState.bold && 'shadow-none')}
            disabled={!editor}
            aria-pressed={toolbarState.bold}
            onPointerDown={keepEditorSelection}
            onClick={() => runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleBold().run())}
          >
            <Bold className="size-4" />
          </Button>
          <Button
            type="button"
            variant={toolbarState.italic ? 'secondary' : 'ghost'}
            size="icon-sm"
            className={cn('rounded-full', toolbarState.italic && 'shadow-none')}
            disabled={!editor}
            aria-pressed={toolbarState.italic}
            onPointerDown={keepEditorSelection}
            onClick={() =>
              runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleItalic().run())
            }
          >
            <Italic className="size-4" />
          </Button>
          <Button
            type="button"
            variant={toolbarState.strike ? 'secondary' : 'ghost'}
            size="icon-sm"
            className={cn('rounded-full', toolbarState.strike && 'shadow-none')}
            disabled={!editor}
            aria-pressed={toolbarState.strike}
            onPointerDown={keepEditorSelection}
            onClick={() =>
              runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleStrike().run())
            }
          >
            <Strikethrough className="size-4" />
          </Button>
          <Button
            type="button"
            variant={toolbarState.bulletList ? 'secondary' : 'ghost'}
            size="icon-sm"
            className={cn('rounded-full', toolbarState.bulletList && 'shadow-none')}
            disabled={!editor}
            aria-pressed={toolbarState.bulletList}
            onPointerDown={keepEditorSelection}
            onClick={() =>
              runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleBulletList().run())
            }
          >
            <List className="size-4" />
          </Button>
          <Button
            type="button"
            variant={toolbarState.orderedList ? 'secondary' : 'ghost'}
            size="icon-sm"
            className={cn('rounded-full', toolbarState.orderedList && 'shadow-none')}
            disabled={!editor}
            aria-pressed={toolbarState.orderedList}
            onPointerDown={keepEditorSelection}
            onClick={() =>
              runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleOrderedList().run())
            }
          >
            <ListOrdered className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            disabled={!editor}
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
            disabled={!editor}
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
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="标题"
          className="mt-4 w-full border-none bg-transparent px-0 text-[31px] leading-tight font-semibold tracking-[-0.06em] text-text-primary outline-none placeholder:text-[#d4d4d4]"
        />

        <p className="mt-3 text-[13px] text-text-muted">
          {formatLongDate(updatedAt)} ｜ {getWordCount(title, plainText)}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={NOTE_IMAGE_ACCEPT}
        className="hidden"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])

          if (files.length) {
            void appendFiles(files, editorRef.current)
          }

          event.target.value = ''
        }}
      />

      <div className="pt-8" onPasteCapture={(event) => void handlePasteCapture(event)} onDropCapture={(event) => void handleDropCapture(event)}>
        <EditorContent editor={editor} />
      </div>

      <p className="mt-8 text-xs text-text-muted">已自动保存到本地，在线时会继续同步。</p>
    </div>
  )
}
