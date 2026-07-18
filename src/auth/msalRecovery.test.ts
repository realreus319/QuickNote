// @vitest-environment jsdom

import { BrowserAuthErrorCodes } from '@azure/msal-browser'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearMsalCacheRecoveryAttempt,
  getMsalAuthErrorMessage,
  hasMsalCacheRecoveryAttempted,
  isMsalPostRequestFailed,
  markMsalCacheRecoveryAttempted,
} from '@/auth/msalRecovery'

describe('msalRecovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('recognizes post_request_failed from the MSAL error code', () => {
    const error = Object.assign(new Error('Network request failed'), {
      errorCode: BrowserAuthErrorCodes.postRequestFailed,
    })

    expect(isMsalPostRequestFailed(error)).toBe(true)
  })

  it('recognizes post_request_failed from an error message fallback', () => {
    expect(isMsalPostRequestFailed(new Error('post_request_failed: Network request failed'))).toBe(
      true,
    )
  })

  it('guards automatic recovery to one attempt per browser session', () => {
    expect(hasMsalCacheRecoveryAttempted(window.sessionStorage)).toBe(false)

    markMsalCacheRecoveryAttempted(window.sessionStorage)
    expect(hasMsalCacheRecoveryAttempted(window.sessionStorage)).toBe(true)

    clearMsalCacheRecoveryAttempt(window.sessionStorage)
    expect(hasMsalCacheRecoveryAttempted(window.sessionStorage)).toBe(false)
  })

  it('returns a useful message without suggesting local note deletion', () => {
    const message = getMsalAuthErrorMessage(
      Object.assign(new Error('Network request failed'), {
        errorCode: BrowserAuthErrorCodes.postRequestFailed,
      }),
    )

    expect(message).toContain('关闭隐私/广告拦截扩展')
    expect(message).toContain('本地便签不会被删除')
  })
})
