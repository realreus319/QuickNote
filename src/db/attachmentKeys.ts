export function getAttachmentBlobRecordId(
  ownerKey: string,
  noteId: string,
  attachmentId: string,
) {
  return `${ownerKey}:${noteId}:${attachmentId}`
}
