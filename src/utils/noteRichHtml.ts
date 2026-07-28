import { DiffMatchPatch } from '@cocalc/diff-match-patch'

import type { LocalNoteAttachment } from '@/types/domain'
import {
  base64ToDataUrl,
  extractLocalNoteContentFromHtml,
} from '@/utils/noteAttachments'

export {
  assertSafeImageDimensions,
  base64ToBlob,
  base64ToDataUrl,
  base64ToUint8Array,
  blobToBase64,
  DIRECT_NOTE_ATTACHMENT_MAX_BYTES,
  fileToLocalNoteAttachment,
  isSupportedNoteImageType,
  MAX_DECODED_NOTE_IMAGE_PIXELS,
  MAX_NOTE_ATTACHMENT_BYTES,
} from '@/utils/noteAttachments'

const NOTE_ASSET_PROTOCOL = 'quicknote-asset://'
const REMOTE_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAAAAACw='
const richTextPatch = new DiffMatchPatch({
  diffTimeout: 0.2,
})

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'del',
  'div',
  'em',
  'figure',
  'i',
  'img',
  'li',
  'ol',
  'p',
  's',
  'span',
  'strike',
  'strong',
  'u',
  'ul',
])

const DROP_WITH_CONTENT_TAGS = new Set([
  'base',
  'canvas',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'math',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'svg',
  'textarea',
  'video',
])

export class RichTextMergeError extends Error {
  constructor(message = '无法安全合并远端与本地内容') {
    super(message)
  }
}

function createHtmlDocument(html: string) {
  return new DOMParser().parseFromString(html || '<p></p>', 'text/html')
}

function isBoldStyle(value: string) {
  const normalized = value.trim().toLowerCase()

  if (!normalized) return false
  if (normalized === 'bold' || normalized === 'bolder') return true

  const weight = Number.parseInt(normalized, 10)
  return Number.isFinite(weight) && weight >= 600
}

function isItalicStyle(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === 'italic' || normalized === 'oblique'
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode

  if (!parent) return

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  parent.removeChild(element)
}

function wrapElementChildren(element: HTMLElement, tagNames: string[]) {
  if (!tagNames.length || !element.firstChild) return

  let container = element

  for (const tagName of tagNames) {
    const wrapper = element.ownerDocument.createElement(tagName)

    while (container.firstChild) {
      wrapper.appendChild(container.firstChild)
    }

    container.appendChild(wrapper)
    container = wrapper
  }
}

function hasResidualAttributes(element: HTMLElement) {
  return Array.from(element.attributes).some((attribute) => {
    if (attribute.name !== 'style') return true
    return attribute.value.trim().length > 0
  })
}

function normalizeFormattingElement(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'figure' || tagName === 'img') return

  const textDecorationValue =
    `${element.style.textDecoration} ${element.style.textDecorationLine}`
      .trim()
      .toLowerCase()
  const shouldWrap = {
    strong:
      !['strong', 'b'].includes(tagName) &&
      isBoldStyle(element.style.fontWeight),
    em:
      !['em', 'i'].includes(tagName) &&
      isItalicStyle(element.style.fontStyle),
    u: tagName !== 'u' && textDecorationValue.includes('underline'),
    s:
      !['s', 'strike', 'del'].includes(tagName) &&
      textDecorationValue.includes('line-through'),
  }

  wrapElementChildren(
    element,
    ['strong', 'em', 'u', 's'].filter(
      (markTag) => shouldWrap[markTag as keyof typeof shouldWrap],
    ),
  )

  element.style.removeProperty('font-weight')
  element.style.removeProperty('font-style')
  element.style.removeProperty('text-decoration')
  element.style.removeProperty('text-decoration-line')

  if (!element.getAttribute('style')?.trim()) {
    element.removeAttribute('style')
  }

  if (tagName === 'span' && !hasResidualAttributes(element)) {
    unwrapElement(element)
  }
}

function normalizeRichTextSemantics(document: Document) {
  const elements = Array.from(
    document.body.querySelectorAll<HTMLElement>('*'),
  ).reverse()

  for (const element of elements) {
    normalizeFormattingElement(element)
  }
}

function isAllowedLink(value: string) {
  const normalized = value.trim()

  if (!normalized) return false
  if (normalized.startsWith('#')) return true

  try {
    const url = new URL(normalized, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}

function isAllowedImageSource(value: string) {
  const normalized = value.trim().toLowerCase()

  return (
    normalized.startsWith(NOTE_ASSET_PROTOCOL) ||
    normalized.startsWith('cid:') ||
    normalized.startsWith('blob:') ||
    /^data:image\/(png|jpeg|gif|bmp);base64,/.test(normalized)
  )
}

function sanitizeAttributes(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase()

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    let keep = false

    if (tagName === 'a') {
      keep = name === 'href' || name === 'title'
    } else if (tagName === 'img') {
      keep =
        name === 'src' ||
        name === 'alt' ||
        name === 'data-attachment-id' ||
        name === 'data-storage-state'
    } else if (tagName === 'figure') {
      keep = name === 'data-quicknote-image'
    }

    if (!keep) {
      element.removeAttribute(attribute.name)
    }
  }

  if (tagName === 'a') {
    const href = element.getAttribute('href') ?? ''

    if (!isAllowedLink(href)) {
      element.removeAttribute('href')
    }
  }

  if (tagName === 'img') {
    const source = element.getAttribute('src') ?? ''

    if (!isAllowedImageSource(source)) {
      element.removeAttribute('src')
    }
  }
}

function sanitizeDocument(document: Document) {
  const elements = Array.from(
    document.body.querySelectorAll<HTMLElement>('*'),
  ).reverse()

  for (const element of elements) {
    const tagName = element.tagName.toLowerCase()

    if (DROP_WITH_CONTENT_TAGS.has(tagName)) {
      element.remove()
      continue
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      unwrapElement(element)
      continue
    }

    sanitizeAttributes(element)
  }
}

function normalizeDocumentBody(document: Document) {
  normalizeRichTextSemantics(document)
  sanitizeDocument(document)
  const html = document.body.innerHTML.trim()
  return html || '<p></p>'
}

export function sanitizeNoteHtml(html: string) {
  return normalizeDocumentBody(createHtmlDocument(html))
}

function normalizeImageFigureMarkup(image: HTMLImageElement) {
  const figure = image.parentElement
  image.removeAttribute('draggable')

  if (!figure || figure.tagName.toLowerCase() !== 'figure') return

  figure.dataset.quicknoteImage = 'true'
  figure.removeAttribute('contenteditable')
  figure.removeAttribute('draggable')
}

function readAttachmentIdFromImage(image: HTMLImageElement) {
  const attr = image.dataset.attachmentId?.trim()
  if (attr) return attr

  const source = image.getAttribute('src') ?? ''

  if (source.startsWith(NOTE_ASSET_PROTOCOL)) {
    return source.slice(NOTE_ASSET_PROTOCOL.length)
  }

  return ''
}

function removeLocalImageMetadata(image: HTMLImageElement) {
  image.removeAttribute('data-attachment-id')
  image.removeAttribute('data-storage-state')
}

export function normalizeNoteContentId(value: string) {
  return value.trim().replace(/^cid:/i, '').replace(/^<+/, '').replace(/>+$/, '')
}

function readContentIdFromImage(image: HTMLImageElement) {
  const source = image.getAttribute('src') ?? ''

  if (!source.toLowerCase().startsWith('cid:')) return ''
  return normalizeNoteContentId(source)
}

export function getNoteAssetUrl(attachmentId: string) {
  return `${NOTE_ASSET_PROTOCOL}${attachmentId}`
}

export function collectReferencedAttachmentIds(bodyHtml: string) {
  const document = createHtmlDocument(bodyHtml)
  const ids = new Set<string>()

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const attachmentId = readAttachmentIdFromImage(image)
    if (attachmentId) ids.add(attachmentId)
  }

  return ids
}

export function hydrateLocalNoteHtml(
  bodyHtml: string,
  attachments: LocalNoteAttachment[],
) {
  const document = createHtmlDocument(bodyHtml)
  const attachmentById = new Map(
    attachments.map((attachment) => [attachment.id, attachment]),
  )
  const attachmentByContentId = new Map(
    attachments.map((attachment) => [
      normalizeNoteContentId(attachment.contentId),
      attachment,
    ]),
  )

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const attachmentId = readAttachmentIdFromImage(image)
    const attachment =
      attachmentById.get(attachmentId) ||
      attachmentByContentId.get(readContentIdFromImage(image))

    if (!attachment) continue

    if (attachment.base64) {
      image.src = base64ToDataUrl(attachment.base64, attachment.mimeType)
      image.removeAttribute('data-storage-state')
    } else {
      image.src = REMOTE_IMAGE_PLACEHOLDER
      image.dataset.storageState = 'remote-only'
      image.alt = `${attachment.name}（点击上方按钮加载）`
    }

    image.dataset.attachmentId = attachment.id
    normalizeImageFigureMarkup(image)
  }

  return normalizeDocumentBody(document)
}

export function storeEditorNoteHtml(
  editorHtml: string,
  attachments: LocalNoteAttachment[],
) {
  const document = createHtmlDocument(editorHtml)
  const validAttachmentIds = new Set(
    attachments.map((attachment) => attachment.id),
  )
  const attachmentIdByContentId = new Map(
    attachments.map((attachment) => [
      normalizeNoteContentId(attachment.contentId),
      attachment.id,
    ]),
  )

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const attachmentId =
      readAttachmentIdFromImage(image) ||
      attachmentIdByContentId.get(readContentIdFromImage(image))

    if (!attachmentId || !validAttachmentIds.has(attachmentId)) continue

    image.src = getNoteAssetUrl(attachmentId)
    image.dataset.attachmentId = attachmentId
    image.removeAttribute('data-storage-state')
    normalizeImageFigureMarkup(image)
  }

  return normalizeDocumentBody(document)
}

export function isStoredNoteHtmlInSync(
  editorHtml: string,
  storedHtml: string,
  attachments: LocalNoteAttachment[],
) {
  return (
    storeEditorNoteHtml(editorHtml, attachments) ===
    storeEditorNoteHtml(storedHtml, attachments)
  )
}

export function prepareRemoteNoteHtml(
  bodyHtml: string,
  attachments: LocalNoteAttachment[],
) {
  const document = createHtmlDocument(bodyHtml)
  const attachmentById = new Map(
    attachments.map((attachment) => [attachment.id, attachment]),
  )

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const attachmentId = readAttachmentIdFromImage(image)

    if (!attachmentId) continue

    const attachment = attachmentById.get(attachmentId)
    if (!attachment) continue

    image.src = `cid:${normalizeNoteContentId(attachment.contentId)}`
    removeLocalImageMetadata(image)
  }

  for (const figure of Array.from(
    document.querySelectorAll('figure[data-quicknote-image]'),
  )) {
    figure.removeAttribute('data-quicknote-image')
    figure.removeAttribute('contenteditable')
    figure.removeAttribute('draggable')
  }

  return normalizeDocumentBody(document)
}

export function convertRemoteNoteHtmlToStoredHtml(
  remoteHtml: string,
  attachments: LocalNoteAttachment[],
) {
  const document = createHtmlDocument(remoteHtml)
  const attachmentByContentId = new Map(
    attachments.map((attachment) => [
      normalizeNoteContentId(attachment.contentId),
      attachment,
    ]),
  )

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const source = image.getAttribute('src') ?? ''

    if (!source.toLowerCase().startsWith('cid:')) continue

    const contentId = normalizeNoteContentId(source)
    const attachment = attachmentByContentId.get(contentId)

    if (!attachment) continue

    image.src = getNoteAssetUrl(attachment.id)
    image.dataset.attachmentId = attachment.id
    normalizeImageFigureMarkup(image)
  }

  const referencedAttachmentIds = collectReferencedAttachmentIds(
    document.body.innerHTML,
  )

  for (const attachment of attachments) {
    if (referencedAttachmentIds.has(attachment.id)) continue

    const figure = document.createElement('figure')
    figure.setAttribute('data-quicknote-image', 'true')

    const image = document.createElement('img')
    image.src = getNoteAssetUrl(attachment.id)
    image.dataset.attachmentId = attachment.id
    image.alt = attachment.name

    figure.appendChild(image)
    document.body.appendChild(figure)
  }

  return normalizeDocumentBody(document)
}

export function pruneAttachmentsForStoredHtml(
  attachments: LocalNoteAttachment[],
  bodyHtml: string,
) {
  const referencedIds = collectReferencedAttachmentIds(bodyHtml)
  return attachments.filter((attachment) => referencedIds.has(attachment.id))
}

export function derivePlainTextFromStoredHtml(bodyHtml: string) {
  return extractLocalNoteContentFromHtml(bodyHtml)
}

export function collectRemoteContentIdsFromHtml(bodyHtml: string) {
  const matches = bodyHtml.matchAll(/cid:([^"' >]+)/g)
  const contentIds = new Set<string>()

  for (const match of matches) {
    if (match[1]) contentIds.add(normalizeNoteContentId(match[1]))
  }

  return contentIds
}

export function mergeRichTextValue(base: string, local: string, remote: string) {
  if (local === base) return remote
  if (remote === base) return local
  if (local === remote) return local

  const patches = richTextPatch.patch_make(base, local)
  const [merged, results] = richTextPatch.patch_apply(patches, remote)

  if (!results.every(Boolean)) {
    throw new RichTextMergeError()
  }

  return merged
}

export function mergeRichHtmlBodies(base: string, local: string, remote: string) {
  const normalizedBase = sanitizeNoteHtml(base)
  const normalizedLocal = sanitizeNoteHtml(local)
  const normalizedRemote = sanitizeNoteHtml(remote)
  const merged = mergeRichTextValue(
    normalizedBase,
    normalizedLocal,
    normalizedRemote,
  )
  const normalizedMerged = sanitizeNoteHtml(merged)
  const mergedText = derivePlainTextFromStoredHtml(normalizedMerged)
  const mergedImages = collectReferencedAttachmentIds(normalizedMerged)
  const hadContent = Boolean(
    derivePlainTextFromStoredHtml(normalizedLocal) ||
      derivePlainTextFromStoredHtml(normalizedRemote) ||
      collectReferencedAttachmentIds(normalizedLocal).size ||
      collectReferencedAttachmentIds(normalizedRemote).size,
  )

  if (hadContent && !mergedText && !mergedImages.size) {
    throw new RichTextMergeError('自动合并导致内容为空，已转为冲突处理')
  }

  return normalizedMerged
}
