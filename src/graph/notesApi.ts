import { graphFetch, graphFetchBlob } from '@/graph/graphClient'
import type { LocalNote, LocalNoteAttachment } from '@/types/domain'
import { toIsoNow } from '@/utils/date'
import {
  base64ToUint8Array,
  blobToBase64,
  collectReferencedAttachmentIds,
  collectRemoteContentIdsFromHtml,
  convertRemoteNoteHtmlToStoredHtml,
  derivePlainTextFromStoredHtml,
  DIRECT_NOTE_ATTACHMENT_MAX_BYTES,
  isSupportedNoteImageType,
  mergeRichHtmlBodies,
  mergeRichTextValue,
  MAX_NOTE_ATTACHMENT_BYTES,
  normalizeNoteContentId,
  prepareRemoteNoteHtml,
  RichTextMergeError,
} from '@/utils/noteRichHtml'
import { sortAttachmentsByBodyOrder } from '@/utils/noteAttachments'
import {
  normalizeNoteColor,
  noteColorFromMicrosoftValue,
  noteColorToMicrosoftValue,
  resolveSyncedNoteColor,
} from '@/utils/noteColor'
import { readString } from '@/utils/text'

const QUICKNOTE_RICH_HTML_PROPERTY_ID =
  'String {66f5a359-4659-4830-9070-00040ec6ac6e} Name QuickNoteRichHtml'
const QUICKNOTE_RICH_HTML_QUERY_ID = encodeURIComponent(QUICKNOTE_RICH_HTML_PROPERTY_ID)
export const MICROSOFT_NOTE_COLOR_PROPERTY_ID =
  'Integer {0006200E-0000-0000-C000-000000000046} Id 0x8B00'
const MICROSOFT_NOTE_COLOR_QUERY_ID = encodeURIComponent(MICROSOFT_NOTE_COLOR_PROPERTY_ID)
const NOTE_EXTENDED_PROPERTIES_FILTER =
  `id%20eq%20'${QUICKNOTE_RICH_HTML_QUERY_ID}'%20or%20` +
  `id%20eq%20'${MICROSOFT_NOTE_COLOR_QUERY_ID}'`

interface MailFolderResponse {
  value?: Array<{
    id?: string
    displayName?: string
  }>
}

interface RemoteMessageRecord extends Record<string, unknown> {
  hasAttachments?: boolean
  changeKey?: string
  singleValueExtendedProperties?: Array<{
    id?: string
    value?: string
  }>
  body?: {
    content?: string
  }
}

interface RemoteAttachmentRecord extends Record<string, unknown> {
  id?: string
  name?: string
  contentType?: string
  size?: number
  contentBytes?: string
  contentId?: string
  isInline?: boolean
}

const NOTES_MESSAGES_QUERY =
  `$select=id,subject,body,bodyPreview,createdDateTime,lastModifiedDateTime,hasAttachments,changeKey&$expand=singleValueExtendedProperties($filter=${NOTE_EXTENDED_PROPERTIES_FILTER})&$orderby=lastModifiedDateTime%20desc&$top=100`
const SINGLE_NOTE_QUERY =
  `$select=id,subject,body,createdDateTime,lastModifiedDateTime,hasAttachments,changeKey&$expand=singleValueExtendedProperties($filter=${NOTE_EXTENDED_PROPERTIES_FILTER})`
const ATTACHMENT_UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024

let notesMessagesPathPromise: Promise<string> | null = null

function encodePathSegment(value: string) {
  return encodeURIComponent(value)
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }

  return fallback
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function messageBodyHasInlineCid(bodyHtml: string | undefined) {
  return /cid:/i.test(bodyHtml ?? '')
}

function messageNeedsAttachmentHydration(bodyHtml: string | undefined, richHtml: string | undefined) {
  return (
    messageBodyHasInlineCid(bodyHtml) ||
    messageBodyHasInlineCid(richHtml) ||
    collectReferencedAttachmentIds(richHtml ?? '').size > 0
  )
}

export interface RemoteNoteSnapshot {
  remoteId: string
  title: string
  bodyHtml: string
  lastSyncedBodyHtml: string
  content: string
  attachments: LocalNoteAttachment[]
  color: LocalNote['color']
  remoteChangeKey?: string
}

function buildRemoteNotePayload(
  title: string | undefined,
  bodyHtml: string | undefined,
  canonicalBodyHtml: string | undefined,
  color: LocalNote['color'] | undefined,
  includeMessageClass = false,
) {
  const payload: Record<string, unknown> = {}
  const extendedProperties: Array<Record<string, unknown>> = []

  if (title != null) {
    payload.subject = title.trim() || '未命名便签'
  }

  if (bodyHtml != null) {
    payload.body = {
      contentType: 'html',
      content: bodyHtml,
    }
  }

  if (canonicalBodyHtml != null) {
    extendedProperties.push({
      id: QUICKNOTE_RICH_HTML_PROPERTY_ID,
      value: canonicalBodyHtml,
    })
  }

  if (color != null) {
    extendedProperties.push({
      id: MICROSOFT_NOTE_COLOR_PROPERTY_ID,
      value: noteColorToMicrosoftValue(color),
    })
  }

  if (includeMessageClass) {
    extendedProperties.push({
      id: 'String 0x001A',
      value: 'IPM.StickyNote',
    })
  }

  if (extendedProperties.length) {
    payload.singleValueExtendedProperties = extendedProperties
  }

  return payload
}

function readRemoteRichHtml(message: RemoteMessageRecord) {
  return message.singleValueExtendedProperties?.find(
    (property) => property.id === QUICKNOTE_RICH_HTML_PROPERTY_ID,
  )?.value
}

function readStoredImageIdFromImage(image: HTMLImageElement) {
  const attachmentId = image.dataset.attachmentId?.trim()

  if (attachmentId) {
    return attachmentId
  }

  const source = image.getAttribute('src') ?? ''

  if (source.startsWith('quicknote-asset://')) {
    return source.slice('quicknote-asset://'.length).trim()
  }

  if (source.toLowerCase().startsWith('cid:')) {
    return normalizeNoteContentId(source)
  }

  return ''
}

function collectStoredImageIdsFromHtml(bodyHtml: string | undefined) {
  const document = new DOMParser().parseFromString(bodyHtml ?? '', 'text/html')
  const ids: string[] = []

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const id = readStoredImageIdFromImage(image)

    if (id) {
      ids.push(id)
    }
  }

  return ids
}

export function remapRemoteAttachmentsForStoredHtml(
  attachments: LocalNoteAttachment[],
  sourceHtml: string | undefined,
) {
  const storedIds = collectStoredImageIdsFromHtml(sourceHtml)

  return attachments.map((attachment, index) => ({
    ...attachment,
    id: storedIds[index] ?? attachment.id,
  }))
}

async function resolveNotesMessagesPath(accessToken: string) {
  return graphFetch<MailFolderResponse>(
    accessToken,
    '/v1.0/me/mailFolders?includeHiddenFolders=true&$select=id,displayName',
  ).then((response) => {
    const notesFolder = response.value?.find((folder) => {
      const displayName = folder.displayName?.trim().toLowerCase()

      return displayName === 'notes' || displayName === '笔记' || displayName === '便笺'
    })

    if (!notesFolder?.id) {
      throw new Error('未找到 Outlook Notes 文件夹')
    }

    return `/v1.0/me/mailFolders/${encodePathSegment(notesFolder.id)}/messages`
  })
}

async function getNotesMessagesPath(accessToken: string) {
  if (!notesMessagesPathPromise) {
    notesMessagesPathPromise = graphFetch<unknown>(
      accessToken,
      '/v1.0/me/mailFolders/notes/messages?$top=1',
    )
      .then(() => '/v1.0/me/mailFolders/notes/messages')
      .catch(() => resolveNotesMessagesPath(accessToken))
      .catch((caughtError: unknown) => {
        notesMessagesPathPromise = null
        throw caughtError
      })
  }

  return notesMessagesPathPromise
}

function buildRemoteNoteSnapshot(
  message: RemoteMessageRecord,
  attachments: LocalNoteAttachment[],
): RemoteNoteSnapshot {
  const remoteId = readString(message.id)
  const title = readString(message.subject)
  const sourceBodyHtml = readRemoteRichHtml(message) ?? readString(message.body?.content, '<p></p>')
  const storedBodyHtml = convertRemoteNoteHtmlToStoredHtml(sourceBodyHtml, attachments)

  return {
    remoteId,
    title,
    bodyHtml: storedBodyHtml,
    lastSyncedBodyHtml: sourceBodyHtml,
    content: derivePlainTextFromStoredHtml(storedBodyHtml),
    attachments,
    color: readRemoteNoteColor(message),
    remoteChangeKey: readString(message.changeKey),
  }
}

export function isRemoteImageAttachment(attachment: RemoteAttachmentRecord) {
  const contentType = readString(attachment.contentType).toLowerCase()

  return contentType.startsWith('image/')
}

export function readRemoteNoteColor(message: RemoteMessageRecord) {
  const value = message.singleValueExtendedProperties?.find(
    (property) => property.id === MICROSOFT_NOTE_COLOR_PROPERTY_ID,
  )?.value

  return noteColorFromMicrosoftValue(value)
}

export function canReuseRemoteAttachments(
  remoteChangeKey: string,
  cachedNote: LocalNote | undefined,
) {
  return Boolean(
    remoteChangeKey && cachedNote?.remoteAttachmentsChangeKey === remoteChangeKey,
  )
}

function mapRemoteAttachment(
  attachment: RemoteAttachmentRecord,
  contentBytes: string,
): LocalNoteAttachment | null {
  const mimeType = readString(attachment.contentType).toLowerCase()

  if (!contentBytes || !mimeType.startsWith('image/')) {
    return null
  }

  return {
    id: readString(attachment.id, readString(attachment.contentId, `remote-${Date.now()}`)),
    remoteId: readString(attachment.id),
    name: readString(attachment.name, 'image'),
    mimeType,
    size: readNumber(attachment.size),
    base64: contentBytes,
    contentId: normalizeNoteContentId(
      readString(attachment.contentId, `quicknote-${readString(attachment.id, `image-${Date.now()}`)}`),
    ),
    createdAt: toIsoNow(),
  }
}

async function listRemoteAttachmentRefs(accessToken: string, messageId: string) {
  return graphFetch<{ value?: RemoteAttachmentRecord[] }>(
    accessToken,
    `/v1.0/me/messages/${encodePathSegment(messageId)}/attachments`,
  )
}

async function getRemoteAttachmentDetails(
  accessToken: string,
  messageId: string,
  attachmentId: string,
) {
  return graphFetch<RemoteAttachmentRecord>(
    accessToken,
    `/v1.0/me/messages/${encodePathSegment(messageId)}/attachments/${encodePathSegment(attachmentId)}`,
  )
}

async function getRemoteAttachmentBase64(
  accessToken: string,
  messageId: string,
  attachmentId: string,
) {
  const { blob } = await graphFetchBlob(
    accessToken,
    `/v1.0/me/messages/${encodePathSegment(messageId)}/attachments/${encodePathSegment(attachmentId)}/$value`,
  )

  return blobToBase64(blob)
}

async function fetchRemoteNoteAttachments(
  accessToken: string,
  messageId: string,
  bodyHtml: string | undefined,
  sourceHtml: string | undefined,
) {
  const attachments = await listRemoteAttachmentRefs(accessToken, messageId)
  const imageRefs = (attachments.value ?? []).filter(isRemoteImageAttachment)

  const resolved = await Promise.all(
    imageRefs.map(async (attachment) => {
      const attachmentId = readString(attachment.id)

      if (!attachmentId) {
        return null
      }

      const detail = await getRemoteAttachmentDetails(accessToken, messageId, attachmentId)
      const contentBytes =
        readString(detail.contentBytes) ||
        (await getRemoteAttachmentBase64(accessToken, messageId, attachmentId))

      return mapRemoteAttachment(
        {
          ...attachment,
          ...detail,
        },
        contentBytes,
      )
    }),
  )

  return remapRemoteAttachmentsForStoredHtml(
    sortAttachmentsByBodyOrder(
      resolved.filter((attachment): attachment is LocalNoteAttachment => Boolean(attachment)),
      bodyHtml,
    ),
    sourceHtml,
  )
}

async function fetchRemoteNoteRecord(accessToken: string, remoteId: string) {
  return graphFetch<RemoteMessageRecord>(
    accessToken,
    `/v1.0/me/messages/${encodePathSegment(remoteId)}?${SINGLE_NOTE_QUERY}`,
    {
      headers: {
        Prefer: 'outlook.body-content-type="html"',
      },
    },
  )
}

async function fetchRemoteNoteSnapshot(accessToken: string, remoteId: string) {
  const message = await fetchRemoteNoteRecord(accessToken, remoteId)
  const bodyHtml = readString(message.body?.content)
  const sourceBodyHtml = readRemoteRichHtml(message) ?? bodyHtml
  const attachments =
    readBoolean(message.hasAttachments) ||
    messageNeedsAttachmentHydration(bodyHtml, sourceBodyHtml)
    ? await fetchRemoteNoteAttachments(accessToken, remoteId, bodyHtml, sourceBodyHtml)
    : []

  return buildRemoteNoteSnapshot(message, attachments)
}

async function deleteRemoteAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
) {
  await graphFetch<void>(
    accessToken,
    `/v1.0/me/messages/${encodePathSegment(messageId)}/attachments/${encodePathSegment(attachmentId)}`,
    {
      method: 'DELETE',
    },
  )
}

async function uploadLargeAttachment(uploadUrl: string, bytes: Uint8Array) {
  let start = 0

  while (start < bytes.byteLength) {
    const endExclusive = Math.min(start + ATTACHMENT_UPLOAD_CHUNK_BYTES, bytes.byteLength)
    const chunk = bytes.slice(start, endExclusive)
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${endExclusive - 1}/${bytes.byteLength}`,
        'Content-Type': 'application/octet-stream',
      },
      body: chunk,
    })

    if (![200, 201, 202].includes(response.status)) {
      throw new Error((await response.text()) || '上传图片附件失败')
    }

    start = endExclusive
  }
}

async function uploadRemoteAttachment(
  accessToken: string,
  messageId: string,
  attachment: LocalNoteAttachment,
) {
  if (!isSupportedNoteImageType(attachment.mimeType)) {
    throw new Error('仅支持 PNG、JPEG、GIF 和 BMP 图片')
  }

  if (attachment.size > MAX_NOTE_ATTACHMENT_BYTES) {
    throw new Error('图片超过 35 MB，当前无法同步')
  }

  if (attachment.size <= DIRECT_NOTE_ATTACHMENT_MAX_BYTES) {
    await graphFetch(accessToken, `/v1.0/me/messages/${encodePathSegment(messageId)}/attachments`, {
      method: 'POST',
      body: JSON.stringify({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.name,
        contentType: attachment.mimeType,
        contentBytes: attachment.base64,
        contentId: attachment.contentId,
        isInline: true,
      }),
    })
    return
  }

  const uploadSession = await graphFetch<{ uploadUrl?: string }>(
    accessToken,
    `/v1.0/me/messages/${encodePathSegment(messageId)}/attachments/createUploadSession`,
    {
      method: 'POST',
      body: JSON.stringify({
        AttachmentItem: {
          attachmentType: 'file',
          name: attachment.name,
          size: attachment.size,
          isInline: true,
          contentId: attachment.contentId,
        },
      }),
    },
  )

  const uploadUrl = readString(uploadSession.uploadUrl)

  if (!uploadUrl) {
    throw new Error('图片上传会话创建失败')
  }

  await uploadLargeAttachment(uploadUrl, base64ToUint8Array(attachment.base64))
}

async function syncRemoteNoteAttachments(
  accessToken: string,
  messageId: string,
  localAttachments: LocalNoteAttachment[],
  remoteAttachments: LocalNoteAttachment[],
  targetBodyHtml: string,
) {
  const referencedContentIds = collectRemoteContentIdsFromHtml(targetBodyHtml)
  const localByContentId = new Map(
    localAttachments.map((attachment) => [attachment.contentId, attachment]),
  )
  const remoteByContentId = new Map(
    remoteAttachments.map((attachment) => [attachment.contentId, attachment]),
  )

  for (const remoteAttachment of remoteAttachments) {
    if (!referencedContentIds.has(remoteAttachment.contentId) && remoteAttachment.remoteId) {
      await deleteRemoteAttachment(accessToken, messageId, remoteAttachment.remoteId)
    }
  }

  for (const contentId of referencedContentIds) {
    if (remoteByContentId.has(contentId)) {
      continue
    }

    const localAttachment = localByContentId.get(contentId)

    if (!localAttachment) {
      throw new Error('缺少需要同步的内联图片数据')
    }

    await uploadRemoteAttachment(accessToken, messageId, localAttachment)
  }
}

export async function fetchRemoteNotes(accessToken: string, cachedNotes: LocalNote[] = []) {
  const cachedNotesByRemoteId = new Map(
    cachedNotes
      .filter((note) => note.remoteId)
      .map((note) => [note.remoteId as string, note]),
  )
  const messagesPath = await getNotesMessagesPath(accessToken)
  const response = await graphFetch<{ value?: RemoteMessageRecord[] }>(
    accessToken,
    `${messagesPath}?${NOTES_MESSAGES_QUERY}`,
    {
      headers: {
        Prefer: 'outlook.body-content-type="html"',
      },
    },
  )

  return Promise.all(
    (response.value ?? []).map(async (message) => {
      const messageId = readString(message.id)
      const remoteChangeKey = readString(message.changeKey)
      const cachedNote = cachedNotesByRemoteId.get(messageId)
      const bodyHtml = readString(message.body?.content)
      const richHtml = readRemoteRichHtml(message)
      const color = readRemoteNoteColor(message)
      const needsAttachmentHydration =
        readBoolean(message.hasAttachments) ||
        messageNeedsAttachmentHydration(bodyHtml, richHtml)

      if (!messageId || !needsAttachmentHydration) {
        return {
          ...message,
          quicknoteAttachments: [],
          quicknoteAttachmentsChangeKey: remoteChangeKey,
          quicknoteRichHtml: richHtml,
          quicknoteColor: color,
        }
      }

      if (canReuseRemoteAttachments(remoteChangeKey, cachedNote)) {
        return {
          ...message,
          quicknoteRichHtml: richHtml,
          quicknoteColor: color,
          quicknoteAttachments: cachedNote?.attachments ?? [],
          quicknoteAttachmentsChangeKey: remoteChangeKey,
        }
      }

      try {
        return {
          ...message,
          quicknoteRichHtml: richHtml,
          quicknoteColor: color,
          quicknoteAttachments: await fetchRemoteNoteAttachments(
            accessToken,
            messageId,
            bodyHtml,
            richHtml ?? bodyHtml,
          ),
          quicknoteAttachmentsChangeKey: remoteChangeKey,
        }
      } catch {
        return {
          ...message,
          quicknoteRichHtml: richHtml,
          quicknoteColor: color,
          quicknoteAttachmentsError: true,
        }
      }
    }),
  )
}

export async function createRemoteNote(accessToken: string, note: LocalNote) {
  const messagesPath = await getNotesMessagesPath(accessToken)
  const remoteBodyHtml = prepareRemoteNoteHtml(note.bodyHtml, note.attachments)
  const created = await graphFetch<Record<string, unknown>>(accessToken, messagesPath, {
    method: 'POST',
    body: JSON.stringify(
      buildRemoteNotePayload(
        note.title,
        remoteBodyHtml,
        note.bodyHtml,
        normalizeNoteColor(note.color),
        true,
      ),
    ),
  })
  const remoteId = readString(created.id)

  try {
    if (remoteId && note.attachments.length) {
      await syncRemoteNoteAttachments(accessToken, remoteId, note.attachments, [], remoteBodyHtml)
    }
  } catch (caughtError) {
    if (remoteId) {
      try {
        await deleteRemoteNote(accessToken, remoteId)
      } catch {
        // Ignore rollback failure so the original sync error surfaces to the user.
      }
    }

    throw caughtError
  }

  if (!remoteId) {
    throw new Error('远端便签创建失败')
  }

  return fetchRemoteNoteSnapshot(accessToken, remoteId)
}

export async function updateRemoteNote(accessToken: string, note: LocalNote) {
  if (!note.remoteId) {
    throw new Error('缺少远端便签标识')
  }

  const currentRemote = await fetchRemoteNoteSnapshot(accessToken, note.remoteId)
  const currentRemoteCanonicalHtml = currentRemote.lastSyncedBodyHtml
  const localCanonicalHtml = note.bodyHtml
  const localColor = normalizeNoteColor(note.color)
  const targetColor = resolveSyncedNoteColor(
    note.lastSyncedColor,
    localColor,
    currentRemote.color,
  )
  const remoteChanged =
    Boolean(note.remoteChangeKey) &&
    Boolean(currentRemote.remoteChangeKey) &&
    note.remoteChangeKey !== currentRemote.remoteChangeKey

  let targetTitle = note.title
  let targetCanonicalHtml = localCanonicalHtml

  if (remoteChanged) {
    try {
      targetTitle = mergeRichTextValue(
        note.lastSyncedTitle ?? currentRemote.title,
        note.title,
        currentRemote.title,
      )
      targetCanonicalHtml = mergeRichHtmlBodies(
        note.lastSyncedBodyHtml ?? currentRemoteCanonicalHtml,
        localCanonicalHtml,
        currentRemoteCanonicalHtml,
      )
    } catch (caughtError) {
      if (caughtError instanceof RichTextMergeError) {
        throw caughtError
      }

      throw new Error('便签存在远端修改，无法自动合并', {
        cause: caughtError,
      })
    }
  }

  const payload = buildRemoteNotePayload(
    targetTitle !== currentRemote.title ? targetTitle : undefined,
    targetCanonicalHtml !== currentRemoteCanonicalHtml
      ? prepareRemoteNoteHtml(targetCanonicalHtml, note.attachments)
      : undefined,
    targetCanonicalHtml !== currentRemoteCanonicalHtml ? targetCanonicalHtml : undefined,
    targetColor !== currentRemote.color ? targetColor : undefined,
  )

  if (Object.keys(payload).length) {
    await graphFetch<Record<string, unknown>>(
      accessToken,
      `/v1.0/me/messages/${encodePathSegment(note.remoteId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    )
  }

  await syncRemoteNoteAttachments(
    accessToken,
    note.remoteId,
    note.attachments,
    currentRemote.attachments,
    prepareRemoteNoteHtml(targetCanonicalHtml, note.attachments),
  )

  return fetchRemoteNoteSnapshot(accessToken, note.remoteId)
}

export async function deleteRemoteNote(accessToken: string, remoteId: string) {
  return graphFetch<void>(accessToken, `/v1.0/me/messages/${encodePathSegment(remoteId)}`, {
    method: 'DELETE',
  })
}
