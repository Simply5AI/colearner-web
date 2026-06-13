/**
 * Browser-side admin API client. Routes through the colearner-web BFF
 * (`/api/admin/*`) so mutations use the httpOnly admin session cookie instead
 * of the consumer Auth.js bearer token.
 */

export class AdminBrowserError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'AdminBrowserError'
  }
}

interface AdminBrowserOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/** Strip the platform prefix; BFF re-adds `/api/admin/` when proxying. */
export function toAdminBffPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized.startsWith('/api/admin')) {
    const remainder = normalized.slice('/api/admin'.length)
    return remainder || '/'
  }
  return normalized
}

export async function adminBrowserClient<T>(
  path: string,
  options: AdminBrowserOptions = {}
): Promise<T> {
  const { method = 'GET', body, signal } = options
  // `path` should already be BFF-relative (e.g. `/users/:id/activity`). Keep the
  // strip here as a safety net for any direct callers.
  const res = await fetch(`/api/admin${toAdminBffPath(path)}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new AdminBrowserError(
      res.status,
      (json?.message as string) ?? res.statusText,
      json?.code as string | undefined
    )
  }

  return json as T
}

/** Download binary/text admin exports through the BFF (CSV, etc.). */
export async function adminBrowserDownload(path: string, filename: string): Promise<void> {
  const res = await fetch(`/api/admin${toAdminBffPath(path)}`)
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new AdminBrowserError(
      res.status,
      (json?.message as string) ?? res.statusText,
      json?.code as string | undefined
    )
  }

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}