import type { AccountInfo } from '@azure/msal-browser'
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
        }

        if (!cancelled) {
          setAccount(nextAccount)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : '登录状态恢复失败')
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
    await msalInstance.loginRedirect({
      scopes: graphScopes,
      prompt: 'select_account',
    })
  }, [])

  const logout = useCallback(async () => {
    await msalInstance.logoutRedirect()
  }, [])

  const getAccessToken = useCallback(async (scopes = graphScopes) => {
    const active =
      msalInstance.getActiveAccount() ?? account ?? msalInstance.getAllAccounts()[0] ?? null

    if (!active) {
      throw new Error('未登录 Microsoft 账户')
    }

    msalInstance.setActiveAccount(active)

    const result = await msalInstance.acquireTokenSilent({
      account: active,
      scopes,
    })

    return result.accessToken
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
