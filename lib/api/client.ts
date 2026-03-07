import { z } from 'zod/v4'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

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

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message)
  }

  const data: T = await res.json()
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
