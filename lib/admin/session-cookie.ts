/**
 * Admin session cookie names (web origin).
 *
 * The admin auth surface uses a BFF pattern: the browser only ever talks to the
 * colearner-web origin. Next.js route handlers under `/api/admin-auth/*` proxy to
 * the backend and re-issue the admin session as an httpOnly cookie on THIS origin.
 * Server components then forward it to the API server-to-server.
 */
export const ADMIN_SESSION_COOKIE = 'colearner_admin_sid'
export const ADMIN_PREAUTH_COOKIE = 'colearner_admin_preauth'

/** Pre-auth token lifetime mirrors the backend (5 minutes). */
export const ADMIN_PREAUTH_MAX_AGE = 300

/**
 * Admin session idle lifetime. Mirrors the backend `ADMIN_SESSION_TTL_SECONDS`
 * (default 1800 = 30 min). The web cookie is re-issued with this max-age on each
 * authenticated `/api/admin-auth/me` probe so active sessions slide in lockstep
 * with the backend's Redis TTL.
 */
export const ADMIN_SESSION_TTL_SECONDS = Number(
  process.env.NEXT_PUBLIC_ADMIN_SESSION_TTL_SECONDS ?? 1800
)
