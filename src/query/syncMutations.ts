import { useCallback, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'

import { useAuth } from '@/auth/useAuth'
import { PENDING_OPERATION_EVENT } from '@/db/pendingRepo'
import { syncAll } from '@/sync/syncManager'
import { useNetworkStatus } from '@/sync/network'

export function useSyncMutation() {
  const { account, getAccessToken, isAuthenticated } = useAuth()

  return useMutation({
    mutationKey: ['sync', account?.homeAccountId ?? ''],
    mutationFn: () =>
      syncAll(
        () => getAccessToken(),
        isAuthenticated,
        account?.homeAccountId ?? '',
      ),
  })
}

export function useAutoSync(enabled = true) {
  const { isAuthenticated, initializing } = useAuth()
  const networkStatus = useNetworkStatus()
  const mutation = useSyncMutation()
  const mutateAsyncRef = useRef(mutation.mutateAsync)
  const mutationPendingRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    mutateAsyncRef.current = mutation.mutateAsync
  }, [mutation.mutateAsync])

  useEffect(() => {
    mutationPendingRef.current = mutation.isPending
  }, [mutation.isPending])

  const runSync = useCallback(() => {
    if (
      !enabled ||
      initializing ||
      !isAuthenticated ||
      networkStatus !== 'online' ||
      mutationPendingRef.current
    ) {
      return
    }

    void mutateAsyncRef.current()
  }, [enabled, initializing, isAuthenticated, networkStatus])

  const scheduleSync = useCallback(
    (delayMs = 0) => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        runSync()
      }, delayMs)
    },
    [runSync],
  )

  useEffect(() => {
    if (!enabled || initializing || !isAuthenticated || networkStatus !== 'online') {
      return
    }

    scheduleSync()

    const intervalId = window.setInterval(() => {
      scheduleSync()
    }, 60_000)
    const handlePendingOperation = () => scheduleSync(1_500)
    const handleOnline = () => scheduleSync()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleSync()
      }
    }

    window.addEventListener(PENDING_OPERATION_EVENT, handlePendingOperation)
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      window.removeEventListener(PENDING_OPERATION_EVENT, handlePendingOperation)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, initializing, isAuthenticated, networkStatus, scheduleSync])

  return mutation
}
