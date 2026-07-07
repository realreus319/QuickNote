import { useEffect, useState } from 'react'

export function getNetworkStatus() {
  return navigator.onLine ? 'online' : 'offline'
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<'online' | 'offline'>(getNetworkStatus())

  useEffect(() => {
    function handleOnline() {
      setStatus('online')
    }

    function handleOffline() {
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return status
}
