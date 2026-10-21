import { canonicalApiBaseUrl, CoLearnerClient } from '@colearner/api-client'

export function platformApiBaseUrl() {
  return canonicalApiBaseUrl(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000')
}

/** Web-only adapter. The package itself reads no environment, cookies or storage. */
export function platformClient() {
  return new CoLearnerClient({
    baseUrl: platformApiBaseUrl(),
    transport: (url, request) => fetch(url, {
      ...request, cache: 'no-store',
      signal: request.signal ?? AbortSignal.timeout(10000),
    }),
  })
}
