import { PublicClientApplication } from "@azure/msal-browser"

import type { AuthConfig } from "./config"

/**
 * The only module that imports the MSAL SDK. Everything else works against
 * `TokenSource`, so the token rules stay testable outside a browser.
 */
export function createMsal(config: AuthConfig): PublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.postLogoutRedirectUri,
      // MSAL's default is to return to the route that started the sign-in.
    },
    cache: {
      // The session survives a reload until the child signs out.
      cacheLocation: "localStorage",
    },
  })
}
