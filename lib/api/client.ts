import { z } from 'zod/v4'

export function getApiUrl(): string {
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
  const url = `${apiUrl}${path}`

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    const detail =
      error instanceof Error && error.message ? ` ${error.message}` : ''
    throw new ApiError(
      503,
      `Could not reach API at ${url}. Make sure colearner-platform is running and NEXT_PUBLIC_API_URL is correct.${detail}`
    )
  }

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
