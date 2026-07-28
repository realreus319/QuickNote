export const LEGACY_OWNER_KEY = '__legacy__'

let activeOwnerKey = ''
let ownerGeneration = 0

export function normalizeOwnerKey(value: string | null | undefined) {
  return value?.trim() ?? ''
}

export function setActiveOwnerKey(value: string | null | undefined) {
  const nextOwnerKey = normalizeOwnerKey(value)

  if (nextOwnerKey !== activeOwnerKey) {
    activeOwnerKey = nextOwnerKey
    ownerGeneration += 1
  }
}

export function getActiveOwnerKey() {
  return activeOwnerKey
}

export function requireActiveOwnerKey() {
  const ownerKey = getActiveOwnerKey()

  if (!ownerKey) {
    throw new Error('缺少当前 Microsoft 账户标识')
  }

  return ownerKey
}

export function getOwnerGeneration() {
  return ownerGeneration
}

export function isCurrentOwnerGeneration(ownerKey: string, generation: number) {
  return activeOwnerKey === normalizeOwnerKey(ownerKey) && ownerGeneration === generation
}
