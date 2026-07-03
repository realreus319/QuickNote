import type { LocalNoteAttachment } from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import { generateLocalId } from '@/utils/id'

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const BLOCK_TAGS = new Set([
  'article',
  'blockquote',
  'div',
  'figcaption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'ul',
])

export const SUPPORTED_NOTE_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/bmp',
] as const

export const DIRECT_NOTE_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024
export const MAX_NOTE_ATTACHMENT_BYTES = 35 * 1024 * 1024

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char)
}

function appendLineBreak(text: string) {
  return text.endsWith('\n') ? text : `${text}\n`
}

function collectNodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ?? ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement
  const tagName = element.tagName.toLowerCase()

  if (
    tagName === 'img' ||
    (tagName === 'figure' && element.dataset.quicknoteImage === 'true')
  ) {
    return ''
  }

  if (tagName === 'br') {
    return '\n'
  }

  let text = ''

  for (const child of element.childNodes) {
    text += collectNodeText(child)
  }

  if (BLOCK_TAGS.has(tagName) && text.trim()) {
    text = appendLineBreak(text)
  }

  return text
}

export function isSupportedNoteImageType(mimeType: string) {
  return SUPPORTED_NOTE_IMAGE_TYPES.includes(
    mimeType.toLowerCase() as (typeof SUPPORTED_NOTE_IMAGE_TYPES)[number],
  )
}

export function formatAttachmentSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function buildRemoteNoteBodyHtml(content: string, attachments: LocalNoteAttachment[]) {
  const escapedContent = escapeHtml(content.replace(/\r\n/g, '\n').trim())
  const htmlText = escapedContent ? escapedContent.replace(/\n/g, '<br />') : '&nbsp;'
  const imageMarkup = attachments
    .map(
      (attachment) =>
        `<figure data-quicknote-image="true" contenteditable="false" draggable="false"><img src="cid:${escapeHtml(attachment.contentId)}" alt="${escapeHtml(attachment.name)}" draggable="false" /></figure>`,
    )
    .join('')

  return `<p>${htmlText}</p>${imageMarkup}`
}

export function extractLocalNoteContentFromHtml(bodyHtml: string) {
  const document = new DOMParser().parseFromString(bodyHtml, 'text/html')
  const rawText = collectNodeText(document.body)

  return rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, index, lines) => {
      if (line) {
        return true
      }

      const previous = lines[index - 1]
      const next = lines[index + 1]

      return Boolean(previous && next)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function sortAttachmentsByBodyOrder(
  attachments: LocalNoteAttachment[],
  bodyHtml: string | undefined,
) {
  if (!bodyHtml) {
    return attachments.toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  const order = new Map<string, number>()
  const matches = bodyHtml.matchAll(/cid:([^"' >]+)/g)
  let index = 0

  for (const match of matches) {
    const contentId = match[1]

    if (contentId && !order.has(contentId)) {
      order.set(contentId, index)
      index += 1
    }
  }

  return attachments.toSorted((left, right) => {
    const leftIndex = order.get(left.contentId)
    const rightIndex = order.get(right.contentId)

    if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    if (leftIndex != null) return -1
    if (rightIndex != null) return 1

    return left.createdAt.localeCompare(right.createdAt)
  })
}

export function base64ToDataUrl(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`
}

export function base64ToUint8Array(base64: string) {
  const decoded = atob(base64)
  const bytes = new Uint8Array(decoded.length)

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }

  return bytes
}

export function base64ToBlob(base64: string, mimeType: string) {
  return new Blob([base64ToUint8Array(base64)], {
    type: mimeType,
  })
}

export async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.onload = () => {
      const result = reader.result

      if (typeof result !== 'string') {
        reject(new Error('图片编码失败'))
        return
      }

      const [, base64 = ''] = result.split(',', 2)
      resolve(base64)
    }

    reader.readAsDataURL(blob)
  })
}

export async function fileToLocalNoteAttachment(file: File) {
  const mimeType = file.type.toLowerCase()

  return {
    id: generateLocalId('attachment'),
    name: file.name || 'image',
    mimeType,
    size: file.size,
    base64: await blobToBase64(file),
    contentId: `quicknote-${generateLocalId('image')}`,
    createdAt: toIsoNow(),
  } satisfies LocalNoteAttachment
}
