/** Server configuration only. Never import this module from a client component. */
export interface GoogleProviderEnvironment { readonly [key: string]: string | undefined; AUTH_GOOGLE_ID?: string; AUTH_GOOGLE_SECRET?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string }
export function getGoogleProviderConfiguration(environment: GoogleProviderEnvironment = process.env): { clientId: string; clientSecret: string } | undefined {
  if (typeof window !== 'undefined') throw new Error('Google provider configuration is server-only')
  if (environment.AUTH_GOOGLE_ID && environment.AUTH_GOOGLE_SECRET) return { clientId: environment.AUTH_GOOGLE_ID, clientSecret: environment.AUTH_GOOGLE_SECRET }
  if (environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET) return { clientId: environment.GOOGLE_CLIENT_ID, clientSecret: environment.GOOGLE_CLIENT_SECRET }
  return undefined
}
export function isGoogleProviderConfigured(): boolean { return !!getGoogleProviderConfiguration() }
