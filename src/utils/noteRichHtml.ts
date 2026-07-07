import { DiffMatchPatch } from '@cocalc/diff-match-patch'

import type { LocalNoteAttachment } from '@/types/domain'
import { base64ToDataUrl, extractLocalNoteContentFromHtml } from '@/utils/noteAttachments'

export {
  base64ToBlob,
  base64ToDataUrl,
  base64ToUint8Array,
  blobToBase64,
  DIRECT_NOTE_ATTACHMENT_MAX_BYTES,
  fileToLocalNoteAttachment,
  isSupportedNoteImageType,
  MAX_NOTE_ATTACHMENT_BYTES,
} from '@/utils/noteAttachments'

const NOTE_ASSET_PROTOCOL = 'quicknote-asset://'
const richTextPatch = new DiffMatchPatch({
  diffTimeout: 0.2,
})

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

  if (!normalized) {
    return false
  }

  if (normalized === 'bold' || normalized === 'bolder') {
    return true
  }

  const weight = Number.parseInt(normalized, 10)
  return Number.isFinite(weight) && weight >= 600
}

function isItalicStyle(value: string) {
  const normalized = value.trim().toLowerCase()

  return normalized === 'italic' || normalized === 'oblique'
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode

  if (!parent) {
    return
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  parent.removeChild(element)
}

function wrapElementChildren(element: HTMLElement, tagNames: string[]) {
  if (!tagNames.length || !element.firstChild) {
    return
  }

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
    if (attribute.name !== 'style') {
      return true
    }

    return attribute.value.trim().length > 0
  })
}

function normalizeFormattingElement(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'figure' || tagName === 'img') {
    return
  }

  const textDecorationValue = `${element.style.textDecoration} ${element.style.textDecorationLine}`
    .trim()
    .toLowerCase()
  const shouldWrap = {
    strong:
      !['strong', 'b'].includes(tagName) && isBoldStyle(element.style.fontWeight),
    em: !['em', 'i'].includes(tagName) && isItalicStyle(element.style.fontStyle),
    u: tagName !== 'u' && textDecorationValue.includes('underline'),
    s: !['s', 'strike', 'del'].includes(tagName) && textDecorationValue.includes('line-through'),
  }

  wrapElementChildren(
    element,
    ['strong', 'em', 'u', 's'].filter((markTag) => shouldWrap[markTag as keyof typeof shouldWrap]),
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
  const elements = Array.from(document.body.querySelectorAll<HTMLElement>('*')).reverse()

  for (const element of elements) {
    normalizeFormattingElement(element)
  }
}

function normalizeDocumentBody(document: Document) {
  normalizeRichTextSemantics(document)
  const html = document.body.innerHTML.trim()

  return html || '<p></p>'
}

function markImageFigureAtomic(image: HTMLImageElement) {
  const figure = image.parentElement

  image.setAttribute('draggable', 'false')

  if (!figure || figure.tagName.toLowerCase() !== 'figure') {
    return
  }

  figure.setAttribute('contenteditable', 'false')
  figure.setAttribute('draggable', 'false')
  figure.dataset.quicknoteImage = 'true'
}

function readAttachmentIdFromImage(image: HTMLImageElement) {
  const attr = image.dataset.attachmentId?.trim()

  if (attr) {
    return attr
  }

  if (image.src.startsWith(NOTE_ASSET_PROTOCOL)) {
    return image.src.slice(NOTE_ASSET_PROTOCOL.length)
  }

  return ''
}

function removeLocalImageMetadata(image: HTMLImageElement) {
  image.removeAttribute('data-attachment-id')
}

export function normalizeNoteContentId(value: string) {
  return value.trim().replace(/^cid:/i, '').replace(/^<+/, '').replace(/>+$/, '')
}

function readContentIdFromImage(image: HTMLImageElement) {
  const source = image.getAttribute('src') ?? ''

  if (!source.toLowerCase().startsWith('cid:')) {
    return ''
  }

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

    if (attachmentId) {
      ids.add(attachmentId)
    }
  }

  return ids
}

export function hydrateLocalNoteHtml(bodyHtml: string, attachments: LocalNoteAttachment[]) {
  const document = createHtmlDocument(bodyHtml)
  const attachmentById = new Map(attachments.map((attachment) => [attachment.id, attachment]))
  const attachmentByContentId = new Map(
    attachments.map((attachment) => [normalizeNoteContentId(attachment.contentId), attachment]),
  )

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const attachmentId = readAttachmentIdFromImage(image)
    const attachment =
      attachmentById.get(attachmentId) ||
      attachmentByContentId.get(readContentIdFromImage(image))

    if (!attachment) {
      continue
    }

    image.src = base64ToDataUrl(attachment.base64, attachment.mimeType)
    image.dataset.attachmentId = attachment.id
    markImageFigureAtomic(image)
  }

  return normalizeDocumentBody(document)
}

export function storeEditorNoteHtml(editorHtml: string, attachments: LocalNoteAttachment[]) {
  const document = createHtmlDocument(editorHtml)
  const validAttachmentIds = new Set(attachments.map((attachment) => attachment.id))
  const attachmentIdByContentId = new Map(
    attachments.map((attachment) => [normalizeNoteContentId(attachment.contentId), attachment.id]),
  )

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const attachmentId =
      readAttachmentIdFromImage(image) || attachmentIdByContentId.get(readContentIdFromImage(image))

    if (!attachmentId || !validAttachmentIds.has(attachmentId)) {
      continue
    }

    image.src = getNoteAssetUrl(attachmentId)
    image.dataset.attachmentId = attachmentId
    markImageFigureAtomic(image)
  }

  return normalizeDocumentBody(document)
}

export function prepareRemoteNoteHtml(bodyHtml: string, attachments: LocalNoteAttachment[]) {
  const document = createHtmlDocument(bodyHtml)
  const attachmentById = new Map(attachments.map((attachment) => [attachment.id, attachment]))

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const attachmentId = readAttachmentIdFromImage(image)

    if (!attachmentId) {
      continue
    }

    const attachment = attachmentById.get(attachmentId)

    if (!attachment) {
      continue
    }

    image.src = `cid:${normalizeNoteContentId(attachment.contentId)}`
    removeLocalImageMetadata(image)
    markImageFigureAtomic(image)
  }

  for (const figure of Array.from(document.querySelectorAll('figure[data-quicknote-image]'))) {
    figure.setAttribute('contenteditable', 'false')
    figure.setAttribute('draggable', 'false')
    figure.removeAttribute('data-quicknote-image')
  }

  return normalizeDocumentBody(document)
}

export function convertRemoteNoteHtmlToStoredHtml(
  remoteHtml: string,
  attachments: LocalNoteAttachment[],
) {
  const document = createHtmlDocument(remoteHtml)
  const attachmentByContentId = new Map(
    attachments.map((attachment) => [normalizeNoteContentId(attachment.contentId), attachment]),
  )

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const source = image.getAttribute('src') ?? ''

    if (!source.startsWith('cid:')) {
      continue
    }

    const contentId = normalizeNoteContentId(source)
    const attachment = attachmentByContentId.get(contentId)

    if (!attachment) {
      continue
    }

    image.src = getNoteAssetUrl(attachment.id)
    image.dataset.attachmentId = attachment.id
    markImageFigureAtomic(image)

    if (image.parentElement?.tagName.toLowerCase() === 'figure') {
      image.parentElement.setAttribute('data-quicknote-image', 'true')
      image.parentElement.setAttribute('contenteditable', 'false')
      image.parentElement.setAttribute('draggable', 'false')
    }
  }

  const referencedAttachmentIds = collectReferencedAttachmentIds(document.body.innerHTML)

  for (const attachment of attachments) {
    if (referencedAttachmentIds.has(attachment.id)) {
      continue
    }

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
    if (match[1]) {
      contentIds.add(normalizeNoteContentId(match[1]))
    }
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
  return mergeRichTextValue(base, local, remote)
}
