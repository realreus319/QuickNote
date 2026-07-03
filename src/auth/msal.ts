import { PublicClientApplication } from '@azure/msal-browser'

export const graphScopes = [
  'User.Read',
  'offline_access',
  'Tasks.ReadWrite',
  'Mail.ReadWrite',
]

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: '28ff6548-87cc-47c8-b478-335cdcabde6c',
    authority: 'https://login.microsoftonline.com/consumers',
    redirectUri: typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin,
    postLogoutRedirectUri:
      typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
})
