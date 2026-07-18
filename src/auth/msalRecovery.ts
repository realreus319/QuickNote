import { BrowserAuthErrorCodes } from '@azure/msal-browser'

export const MSAL_CACHE_RECOVERY_KEY = 'quicknote.msal.cache-recovery-attempted'

type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function readErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('errorCode' in error)) {
    return null
  }

  const errorCode = (error as { errorCode?: unknown }).errorCode
  return typeof errorCode === 'string' ? errorCode : null
}

export function isMsalPostRequestFailed(error: unknown) {
  if (readErrorCode(error) === BrowserAuthErrorCodes.postRequestFailed) {
    return true
  }

  return error instanceof Error && error.message.includes(BrowserAuthErrorCodes.postRequestFailed)
}

export function hasMsalCacheRecoveryAttempted(storage: RecoveryStorage) {
  return storage.getItem(MSAL_CACHE_RECOVERY_KEY) === '1'
}

export function markMsalCacheRecoveryAttempted(storage: RecoveryStorage) {
  storage.setItem(MSAL_CACHE_RECOVERY_KEY, '1')
}

export function clearMsalCacheRecoveryAttempt(storage: RecoveryStorage) {
  storage.removeItem(MSAL_CACHE_RECOVERY_KEY)
}

export function getMsalAuthErrorMessage(error: unknown) {
  if (isMsalPostRequestFailed(error)) {
    return '微软登录请求被浏览器拦截或认证缓存异常。已尝试自动修复，请关闭隐私/广告拦截扩展后重新连接；本地便签不会被删除。'
  }

  return error instanceof Error ? error.message : '登录状态恢复失败'
}
