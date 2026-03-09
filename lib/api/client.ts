import { z } from 'zod/v4'

function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[apiClient] NEXT_PUBLIC_API_URL is not set. Falling back to http://localhost:3000. ' +
        'Restart the dev server if you just added it to .env.'
      )
    }
    return 'http://localhost:3000'
  }
  return url
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  schema?: z.ZodType
}

/**
 * Typed fetch wrapper for colearner-platform API.
 * Validates responses against Zod schemas when provided.
 */
export async function apiClient<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, schema } = options
  const apiUrl = getApiUrl()

  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.data?.message || error.message || res.statusText)
  }

  const json = await res.json()

  // Backend wraps responses in { statusCode, data, timestamp } envelope
  const data: T = json.data !== undefined ? json.data : json
  return schema ? (schema.parse(data) as T) : data
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
