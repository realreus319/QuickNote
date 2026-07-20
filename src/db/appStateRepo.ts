import { db } from '@/db/db'
import type { AppSyncStatus } from '@/types/domain'

export async function getAppStateValue<T>(key: string, fallback: T) {
  const record = await db.appState.get(key)

  return (record?.value as T | undefined) ?? fallback
}

export async function setAppStateValue<T>(key: string, value: T) {
  await db.appState.put({ key, value })
}

export async function deleteAppStateValue(key: string) {
  await db.appState.delete(key)
}

export async function getSyncStatus() {
  return getAppStateValue<AppSyncStatus>('syncStatus', 'unauthenticated')
}
