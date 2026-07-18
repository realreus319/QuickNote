import { InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { graphScopes, msalInstance } from '@/auth/msal'
import {
  clearMsalCacheRecoveryAttempt,
  getMsalAuthErrorMessage,
  hasMsalCacheRecoveryAttempted,
  isMsalPostRequestFailed,
  markMsalCacheRecoveryAttempted,
} from '@/auth/msalRecovery'

interface AuthContextValue {
  account: AccountInfo | null
  error: string | null
  initializing: boolean
  isAuthenticated: boolean
  getAccessToken: (scopes?: string[]) => Promise<string>
  login: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const loginRequest = {
  scopes: graphScopes,
  prompt: 'select_account' as const,
}

async function startInteractiveRecovery(clearCache: boolean) {
  const storage = window.sessionStorage

  if (hasMsalCacheRecoveryAttempted(storage)) {
    return false
  }

  markMsalCacheRecoveryAttempted(storage)

  try {
    if (clearCache) {
      await msalInstance.clearCache()
    }

    await msalInstance.loginRedirect(loginRequest)
    return true
  } catch (error) {
    clearMsalCacheRecoveryAttempt(storage)
    throw error
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await msalInstance.initialize()
        const response = await msalInstance.handleRedirectPromise()
        const nextAccount =
          response?.account ??
          msalInstance.getActiveAccount() ??
          msalInstance.getAllAccounts()[0] ??
          null

        if (nextAccount) {
          msalInstance.setActiveAccount(nextAccount)
          clearMsalCacheRecoveryAttempt(window.sessionStorage)
        }

        if (!cancelled) {
          setAccount(nextAccount)
          setError(null)
        }
      } catch (caughtError) {
        let effectiveError = caughtError

        if (isMsalPostRequestFailed(caughtError) && navigator.onLine) {
          try {
            const redirectStarted = await startInteractiveRecovery(true)

            if (redirectStarted) {
              return
            }
          } catch (recoveryError) {
            effectiveError = recoveryError
          }
        }

        if (!cancelled) {
          setError(getMsalAuthErrorMessage(effectiveError))
        }
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async () => {
    setError(null)
    clearMsalCacheRecoveryAttempt(window.sessionStorage)

    try {
      await msalInstance.clearCache()
      await msalInstance.loginRedirect(loginRequest)
    } catch (caughtError) {
      setError(getMsalAuthErrorMessage(caughtError))
    }
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    clearMsalCacheRecoveryAttempt(window.sessionStorage)

    try {
      await msalInstance.logoutRedirect()
    } catch (caughtError) {
      setError(getMsalAuthErrorMessage(caughtError))
    }
  }, [])

  const getAccessToken = useCallback(async (scopes = graphScopes) => {
    const active =
      msalInstance.getActiveAccount() ?? account ?? msalInstance.getAllAccounts()[0] ?? null

    if (!active) {
      throw new Error('未登录 Microsoft 账户')
    }

    msalInstance.setActiveAccount(active)

    try {
      const result = await msalInstance.acquireTokenSilent({
        account: active,
        scopes,
      })

      return result.accessToken
    } catch (caughtError) {
      const cacheFailure = isMsalPostRequestFailed(caughtError)
      const interactionRequired = caughtError instanceof InteractionRequiredAuthError

      if ((cacheFailure || interactionRequired) && navigator.onLine) {
        try {
          const redirectStarted = await startInteractiveRecovery(cacheFailure)

          if (redirectStarted) {
            setError(null)
            throw new Error('正在重新连接 Microsoft 账户')
          }
        } catch (recoveryError) {
          const message = getMsalAuthErrorMessage(recoveryError)
          setError(message)
          throw recoveryError
        }
      }

      const message = getMsalAuthErrorMessage(caughtError)
      setError(message)
      throw new Error(message, { cause: caughtError })
    }
  }, [account])

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      error,
      initializing,
      isAuthenticated: Boolean(account),
      getAccessToken,
      login,
      logout,
    }),
    [account, error, getAccessToken, initializing, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
