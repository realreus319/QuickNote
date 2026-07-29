import { graphFetch, GraphRequestError } from '@/graph/graphClient'
import {
  createRemoteNote,
  type RemoteNoteSnapshot,
  updateRemoteNote,
} from '@/graph/notesApi'
import type { LocalNote } from '@/types/domain'
import { readString } from '@/utils/text'

const TEMPLATE_SCAN_LIMIT = 50

interface RemoteNotesFolder {
  id?: string
  displayName?: string
}

interface RemoteTemplateMessage {
  id?: string
  hasAttachments?: boolean
  lastModifiedDateTime?: string
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value)
}

export function pickRemoteNoteTemplateId(
  messages: RemoteTemplateMessage[],
): string | undefined {
  return messages.find((message) => !message.hasAttachments && readString(message.id))
    ?.id
}

async function resolveNotesFolder(accessToken: string) {
  try {
    const folder = await graphFetch<RemoteNotesFolder>(
      accessToken,
      '/v1.0/me/mailFolders/notes?$select=id,displayName',
    )

    if (folder.id) return folder
  } catch (error) {
    if (
      !(error instanceof GraphRequestError) ||
      ![400, 404].includes(error.status)
    ) {
      throw error
    }
  }

  const folders = await graphFetch<{ value?: RemoteNotesFolder[] }>(
    accessToken,
    '/v1.0/me/mailFolders?includeHiddenFolders=true&$select=id,displayName',
  )
  const folder = folders.value?.find((candidate) => {
    const displayName = candidate.displayName?.trim().toLowerCase()
    return displayName === 'notes' || displayName === '笔记' || displayName === '便笺'
  })

  if (!folder?.id) {
    throw new Error('未找到 Outlook Notes 文件夹')
  }

  return folder
}

async function findRemoteNoteTemplateId(
  accessToken: string,
  folderId: string,
) {
  const response = await graphFetch<{ value?: RemoteTemplateMessage[] }>(
    accessToken,
    `/v1.0/me/mailFolders/${encodePathSegment(folderId)}/messages?$select=id,hasAttachments,lastModifiedDateTime&$orderby=lastModifiedDateTime%20desc&$top=${TEMPLATE_SCAN_LIMIT}`,
  )

  return pickRemoteNoteTemplateId(response.value ?? [])
}

/**
 * Creates a Sticky Note by copying a known-good note first, matching the
 * compatibility strategy observed in Floaty. Copying preserves hidden MAPI
 * properties that are not completely represented by the public Graph model.
 *
 * When an account has no existing note to use as a template, QuickNote falls
 * back to its explicit IPM.StickyNote payload so first-run creation still works.
 */
export async function createRemoteNoteWithTemplate(
  accessToken: string,
  note: LocalNote,
  homeAccountId: string,
  onRemoteCreated?: (remoteId: string) => Promise<void>,
): Promise<RemoteNoteSnapshot> {
  const notesFolder = await resolveNotesFolder(accessToken)
  const templateId = await findRemoteNoteTemplateId(
    accessToken,
    readString(notesFolder.id),
  )

  if (!templateId) {
    return createRemoteNote(
      accessToken,
      note,
      homeAccountId,
      onRemoteCreated,
    )
  }

  const copied = await graphFetch<Record<string, unknown>>(
    accessToken,
    `/v1.0/me/messages/${encodePathSegment(templateId)}/copy`,
    {
      method: 'POST',
      maxRetries: 0,
      body: JSON.stringify({ destinationId: notesFolder.id }),
    },
  )
  const remoteId = readString(copied.id)

  if (!remoteId) {
    throw new Error('复制微软便签模板后未返回远端标识')
  }

  // Persist immediately. If later PATCH or attachment upload fails, the Outbox
  // retries this same remote message instead of creating a duplicate.
  await onRemoteCreated?.(remoteId)

  return updateRemoteNote(accessToken, {
    ...note,
    remoteId,
    source: 'microsoft-notes',
    remoteChangeKey: undefined,
    remoteAttachmentsChangeKey: undefined,
    lastSyncedAt: undefined,
    lastSyncedTitle: undefined,
    lastSyncedBodyHtml: undefined,
    lastSyncedColor: undefined,
  })
}
