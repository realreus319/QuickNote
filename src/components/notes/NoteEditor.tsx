import { EditorContent, type Editor as TiptapEditor, useEditor, useEditorState } from '@tiptap/react'
import {
  Bold,
  ClipboardPaste,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  MoreHorizontal,
  Strikethrough,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { buildQuickNoteTiptapExtensions } from '@/components/notes/quickNoteTiptap'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  isStoredNoteHtmlInSync,
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
  return attachments.flatMap((attachment) => {
    if (!attachment.base64) return []

    return [
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
    ]
  })
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

  const editor = useEditor(
    {
      extensions: editorExtensions,
      content: hydrateLocalNoteHtml(bodyHtml, attachments),
      editorProps: {
        attributes: {
          class:
            'note-rich-editor min-h-[65svh] text-[17px] leading-8 text-[color:var(--note-ink,var(--color-text-primary))] outline-none md:text-[18px] md:leading-9',
          'data-placeholder': '开始记录内容…',
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
    },
    [editorExtensions],
  )

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
    if (isStoredNoteHtmlInSync(editor.getHTML(), bodyHtml, attachments)) {
      return
    }

    const hydratedHtml = hydrateLocalNoteHtml(bodyHtml, attachments)
    editor.commands.setContent(hydratedHtml, {
      emitUpdate: false,
    })
    syncEditorDomState(editor)
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

    if (!firstAttachment.base64) {
      toast('图片尚未下载，暂时无法复制')
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
    <div className="safe-bottom-editor md:pb-0">
      <div className="pt-8 md:pt-10">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="标题"
          className="w-full border-none bg-transparent px-0 text-[34px] leading-[1.12] font-semibold tracking-[-0.035em] text-[color:var(--note-ink,var(--color-text-primary))] outline-none placeholder:text-[color:var(--note-placeholder,#c8c8c2)] md:text-[42px]"
        />
        <p className="mt-3 text-xs text-[color:var(--note-muted,var(--color-text-muted))]">
          {formatLongDate(updatedAt)} · {getWordCount(title, plainText)}
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

      <div
        className="fixed right-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-4 z-40 flex items-center gap-1 overflow-x-auto rounded-[18px] border border-[color:var(--note-line,var(--color-divider))] bg-[color:var(--note-paper-raised,var(--color-surface))] p-1.5 shadow-floating backdrop-blur-xl md:sticky md:top-4 md:right-auto md:bottom-auto md:left-auto md:z-20 md:mt-6 md:w-fit md:max-w-full md:shadow-[0_8px_24px_rgba(25,25,24,0.07)]"
        role="toolbar"
        aria-label="文本格式"
      >
        <Button
          type="button"
          variant={toolbarState.bold ? 'secondary' : 'ghost'}
          size="icon-sm"
          className={cn('shrink-0 rounded-[10px]', toolbarState.bold && 'bg-[color:var(--note-line,var(--color-surface-muted))] shadow-none')}
          disabled={!editor}
          aria-label="加粗"
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
          className={cn('shrink-0 rounded-[10px]', toolbarState.italic && 'bg-[color:var(--note-line,var(--color-surface-muted))] shadow-none')}
          disabled={!editor}
          aria-label="斜体"
          aria-pressed={toolbarState.italic}
          onPointerDown={keepEditorSelection}
          onClick={() => runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleItalic().run())}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant={toolbarState.bulletList ? 'secondary' : 'ghost'}
          size="icon-sm"
          className={cn('shrink-0 rounded-[10px]', toolbarState.bulletList && 'bg-[color:var(--note-line,var(--color-surface-muted))] shadow-none')}
          disabled={!editor}
          aria-label="无序列表"
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
          className={cn('shrink-0 rounded-[10px]', toolbarState.orderedList && 'bg-[color:var(--note-line,var(--color-surface-muted))] shadow-none')}
          disabled={!editor}
          aria-label="有序列表"
          aria-pressed={toolbarState.orderedList}
          onPointerDown={keepEditorSelection}
          onClick={() =>
            runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleOrderedList().run())
          }
        >
          <ListOrdered className="size-4" />
        </Button>

        <span
          className="mx-1 h-5 w-px shrink-0 bg-[color:var(--note-line,var(--color-divider))]"
          aria-hidden="true"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 rounded-[10px]"
          disabled={!editor}
          aria-label="添加图片"
          onPointerDown={keepEditorSelection}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-[10px]"
              disabled={!editor}
              aria-label="更多编辑操作"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-44">
            <DropdownMenuItem
              onSelect={() =>
                runEditorCommand((activeEditor) => activeEditor.chain().focus().toggleStrike().run())
              }
            >
              <Strikethrough className="size-4" />
              {toolbarState.strike ? '取消删除线' : '删除线'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleClipboardRead()}>
              <ClipboardPaste className="size-4" />
              粘贴剪贴板图片
            </DropdownMenuItem>
            {attachments.length ? (
              <DropdownMenuItem onSelect={() => void handleCopyFirstImage()}>
                <ImagePlus className="size-4" />
                复制首张图片
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className="pt-8 md:pt-10"
        onPasteCapture={(event) => void handlePasteCapture(event)}
        onDropCapture={(event) => void handleDropCapture(event)}
      >
        <EditorContent editor={editor} />
      </div>

      <p className="mt-10 border-t border-[color:var(--note-line,var(--color-divider))] pt-4 text-xs text-[color:var(--note-muted,var(--color-text-muted))]">
        自动保存到本地，联网后继续同步。
      </p>
    </div>
  )
}
