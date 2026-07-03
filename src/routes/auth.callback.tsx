import { createFileRoute, Navigate } from '@tanstack/react-router'

import { LoadingState } from '@/components/common/LoadingState'
import { useAuth } from '@/auth/useAuth'

function AuthCallbackPage() {
  const { initializing, isAuthenticated } = useAuth()

  if (initializing) {
    return <LoadingState label="正在恢复 Microsoft 登录…" />
  }

  return <Navigate to={isAuthenticated ? '/notes' : '/'} />
}

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})
