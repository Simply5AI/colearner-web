import { getApiUrl } from '@/lib/api/client'

export interface BackendResult<T> {
  ok: boolean
  status: number
  data: T | null
  message?: string
  code?: string
}

/**
 * Server-to-server call from a colearner-web BFF route handler to the API.
 * Unwraps the `{ statusCode, data, timestamp }` envelope and surfaces error
 * `message`/`code` so the handler can relay a clean response to the browser.
 */
export async function callBackend<T>(
  path: string,
  init: RequestInit & { bearer?: string; cookie?: string } = {}
): Promise<BackendResult<T>> {
  const { bearer, cookie, headers, ...rest } = init
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: null,
      message: (json?.message as string) ?? res.statusText,
      code: json?.code as string | undefined,
    }
  }

  const data = json && json.data !== undefined ? json.data : json
  return { ok: true, status: res.status, data: data as T }
}
