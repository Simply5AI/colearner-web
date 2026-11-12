'use client'

import { z } from 'zod'
import { ApiError } from './client'

/** The same-origin boundary checks the current account or opaque child cookie on every dispatch. */
export async function materialRequest<T>(path: string, schema: z.ZodType<T>, method: 'GET' | 'POST' = 'GET', body?: unknown | FormData): Promise<T> {
  const multipart = body instanceof FormData
  let response: Response
  try {
    response = await fetch(`/api/materials${path}`, {
      method,
      headers: !multipart ? { 'Content-Type': 'application/json' } : {},
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(180000),
    })
  } catch { throw new ApiError(503, 'Material services are unavailable. Your draft is still here; try again.') }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Check the file format, size and supplied details. Your draft is still here.',
      401: 'Your learning session has ended. Check learner access to continue. Your draft is still here.',
      403: 'This learner, source or action is not permitted by the current school and guardian policy.',
      404: 'This material is unavailable or you no longer have access.',
      409: 'The material has changed or this import was already accepted. Refresh its progress before retrying.',
      413: 'This upload exceeds the configured school limit. Choose a smaller file.',
      415: 'Choose a supported source format from the import options.',
      422: 'This source could not be read. Try copying its text or uploading a text-based document. Scanned, encrypted or empty files need a suitable available processor.',
      429: 'The current import limit has been reached. Try again when your quota resets.',
      503: 'This processor is unavailable. Choose an enabled source or try again later.',
    }
    if (response.status === 401) throw new MaterialSessionError(messages[401]!)
    const failure: unknown = await response.json().catch(() => null)
    const code = failureCode(failure)
    const mediaMessages: Record<string, string> = {
      YOUTUBE_URL_INVALID: 'Use a public HTTPS YouTube video link.',
      YOUTUBE_CAPTIONS_UNAVAILABLE: 'Captions could not be read for this video. Try a public video with captions, or paste a transcript you have permission to use.',
      YOUTUBE_DURATION_LIMIT: 'Choose a video up to 30 minutes long.',
      AUDIO_DURATION_LIMIT: 'Choose or record audio up to 5 minutes long.',
      PHOTO_HAS_FACE: 'A face was detected. Crop the photo to show only the page, then try again.',
      NO_READABLE_TEXT: 'No readable text was found. Try a sharper, well-lit photo of printed text.',
      NO_SPEECH_DETECTED: 'No clear speech was found. Try a clearer recording.',
      MEDIA_PROCESSOR_BUSY: 'Co is reading another media import. Try again shortly; your draft is still here.',
      MEDIA_FORMAT_INVALID: 'Choose a supported photo or audio file. The file contents must match its format.',
      MEDIA_SOURCE_LIMIT: 'This source exceeds the size or text limit. Use a smaller photo, a shorter recording or a shorter video.',
      MEDIA_EXTRACTION_FAILED: 'The source could not be read. Try a clearer photo or recording, or paste the source text.',
    }
    throw new MaterialApiError(response.status, (code && mediaMessages[code]) || messages[response.status] || 'Material services are unavailable. Please try again.', code)
  }
  const json: unknown = await response.json().catch(() => { throw new ApiError(502, 'The material service returned an unsupported response. Please refresh or try again later.') })
  const data = json !== null && typeof json === 'object' && 'data' in json ? json.data : json
  const result = schema.safeParse(data)
  if (!result.success) { if (process.env.NODE_ENV !== 'production') console.error('[material-request] schema mismatch', JSON.stringify(result.error.issues).slice(0, 600)); throw new ApiError(502, 'The material service returned an unsupported response. Please refresh or try again later.') }
  return result.data
}

/** A material failure that keeps the contract error code (never server text) so the UI can offer the right next step. */
export class MaterialApiError extends ApiError {
  constructor(status: number, message: string, readonly code?: string) { super(status, message); this.name = 'MaterialApiError' }
}
const codePattern = /^[A-Z][A-Z0-9_]{2,63}$/
function failureCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  if (typeof record.code === 'string' && codePattern.test(record.code)) return record.code
  const nested = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>).code : undefined
  if (typeof nested === 'string' && codePattern.test(nested)) return nested
  if (typeof record.message === 'string' && codePattern.test(record.message)) return record.message
  return undefined
}

/** Avoid the account-only global sign-out handler for a revoked opaque child session. */
export class MaterialSessionError extends Error { readonly status = 401 }
