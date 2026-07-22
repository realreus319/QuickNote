import { getNoteAttachmentBlob } from '@/db/attachmentBlobRepo'
import type { LocalNoteAttachment } from '@/types/domain'

const THUMBNAIL_CACHE_NAME = 'quicknote-thumbnails-v1'
const THUMBNAIL_MAX_EDGE = 1024
const THUMBNAIL_QUALITY = 0.78

function buildThumbnailCacheUrl(
  ownerKey: string,
  noteId: string,
  attachment: LocalNoteAttachment,
) {
  const version = encodeURIComponent(
    `${attachment.size}:${attachment.createdAt}:${attachment.remoteId ?? ''}`,
  )

  return `https://quicknote.local/thumbnail/${encodeURIComponent(ownerKey)}/${encodeURIComponent(noteId)}/${encodeURIComponent(attachment.id)}?v=${version}`
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

async function createThumbnail(source: Blob) {
  if (
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  ) {
    return source
  }

  let bitmap: ImageBitmap | undefined

  try {
    bitmap = await createImageBitmap(source)
    const scale = Math.min(
      1,
      THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    )

    if (scale >= 1 && source.size <= 512 * 1024) {
      return source
    }

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })

    if (!context) return source

    context.drawImage(bitmap, 0, 0, width, height)

    return (
      (await canvasToBlob(canvas, 'image/webp', THUMBNAIL_QUALITY)) ??
      source
    )
  } finally {
    bitmap?.close()
  }
}

async function readCachedThumbnail(cacheUrl: string) {
  if (!('caches' in globalThis)) return undefined

  const cache = await caches.open(THUMBNAIL_CACHE_NAME)
  return (await cache.match(cacheUrl))?.blob()
}

async function cacheThumbnail(cacheUrl: string, blob: Blob) {
  if (!('caches' in globalThis)) return

  const cache = await caches.open(THUMBNAIL_CACHE_NAME)
  await cache.put(
    cacheUrl,
    new Response(blob, {
      headers: {
        'content-type': blob.type || 'image/webp',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    }),
  )
}

export async function getNoteAttachmentThumbnail(
  noteId: string,
  attachment: LocalNoteAttachment,
  ownerKey: string,
) {
  const cacheUrl = buildThumbnailCacheUrl(ownerKey, noteId, attachment)
  const cached = await readCachedThumbnail(cacheUrl)

  if (cached) return cached

  const source = await getNoteAttachmentBlob(
    noteId,
    attachment.id,
    ownerKey,
  )

  if (!source) return undefined

  const thumbnail = await createThumbnail(source)
  await cacheThumbnail(cacheUrl, thumbnail)
  return thumbnail
}
