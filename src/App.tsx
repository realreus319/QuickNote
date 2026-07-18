import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { AuthProvider } from '@/auth/AuthProvider'
import { setAppStateValue } from '@/db/appStateRepo'
import { ensureDefaultTodoList } from '@/db/todoRepo'
import { queryClient } from '@/query/queryClient'
import { router } from '@/router'
import { useNetworkStatus } from '@/sync/network'

function Bootstrapper() {
  const networkStatus = useNetworkStatus()

  useEffect(() => {
    void ensureDefaultTodoList()
  }, [])

  useEffect(() => {
    void setAppStateValue('networkStatus', networkStatus)
  }, [networkStatus])

  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Bootstrapper />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
