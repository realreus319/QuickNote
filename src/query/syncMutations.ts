import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'

import { useAuth } from '@/auth/useAuth'
import { syncAll } from '@/sync/syncManager'
import { useNetworkStatus } from '@/sync/network'

export function useSyncMutation() {
  const { account, getAccessToken, isAuthenticated } = useAuth()

  return useMutation({
    mutationKey: ['sync'],
    mutationFn: () =>
      syncAll(() => getAccessToken(), isAuthenticated, account?.homeAccountId ?? ''),
  })
}

export function useAutoSync(enabled = true) {
  const { isAuthenticated, initializing } = useAuth()
  const networkStatus = useNetworkStatus()
  const mutation = useSyncMutation()
  const lastAttemptAt = useRef(0)

  useEffect(() => {
    if (!enabled || initializing || !isAuthenticated || networkStatus !== 'online') {
      return
    }

    if (mutation.isPending) {
      return
    }

    const now = Date.now()
    if (now - lastAttemptAt.current < 60_000) {
      return
    }

    lastAttemptAt.current = now
    void mutation.mutateAsync()
  }, [enabled, initializing, isAuthenticated, mutation, networkStatus])

  return mutation
}
