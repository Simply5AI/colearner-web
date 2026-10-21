/** These tokens never enter Auth.js session JSON or browser storage. */
export const FAMILY_DEVICE_COOKIE = 'colearner-family-device'
export const FAMILY_CHILD_COOKIE = 'colearner-family-child'
export const familyCookieOptions = (expiresAt: string) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', expires: new Date(expiresAt) })
export function isAdultSessionCookie(name: string) { return /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(name) || /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/.test(name) }
