import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript-plus'

const YOUTUBE_URL_REGEX =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/

/** Decode common HTML entities returned by the transcript API */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\n/g, ' ')
}

/**
 * Fetch transcript using Supadata's free transcript API.
 * Free tier: 100 requests/month, no credit card required.
 * Works reliably from cloud servers (Vercel, Railway, AWS).
 */
async function fetchViaSupadata(
  videoUrl: string,
  apiKey: string
): Promise<{ transcript: string; segmentCount: number } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const url = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}&text=true`

    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey },
      signal: controller.signal,
    })

    if (res.status === 202) {
      // Async job for long videos (>20min) — poll for result
      const { jobId } = (await res.json()) as { jobId: string }
      console.log(`[supadata] Async job started: ${jobId}`)

      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2_000))

        const pollRes = await fetch(
          `https://api.supadata.ai/v1/transcript/${jobId}`,
          {
            headers: { 'x-api-key': apiKey },
            signal: controller.signal,
          }
        )

        const pollData = (await pollRes.json()) as {
          status: string
          content?: string
          error?: string
        }

        if (pollData.status === 'completed' && pollData.content) {
          const transcript = decodeHtmlEntities(pollData.content)
          return { transcript, segmentCount: 1 }
        }
        if (pollData.status === 'failed') {
          console.warn(`[supadata] Job failed: ${pollData.error}`)
          return null
        }
      }
      return null
    }

    if (!res.ok) {
      console.warn(`[supadata] API returned ${res.status}`)
      return null
    }

    const data = (await res.json()) as { content?: string }
    if (data.content) {
      return { transcript: decodeHtmlEntities(data.content), segmentCount: 1 }
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string }

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid url' },
        { status: 400 }
      )
    }

    const match = body.url.match(YOUTUBE_URL_REGEX)
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      )
    }

    const videoId = match[1]!

    // Strategy 1: Direct library call (works from residential IPs)
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)
      if (transcriptItems.length) {
        const transcript = decodeHtmlEntities(
          transcriptItems.map((item) => item.text).join(' ')
        )
        console.log(`[Transcript] Direct fetch: ${transcript.length} chars`)
        return NextResponse.json({
          transcript,
          videoId,
          segmentCount: transcriptItems.length,
        })
      }
    } catch (directErr) {
      console.warn(
        `[Transcript] Direct fetch failed for ${videoId}, trying Supadata:`,
        directErr instanceof Error ? directErr.message : directErr
      )
    }

    // Strategy 2: Supadata API (works from cloud servers)
    const supadataKey = process.env.SUPADATA_API_KEY
    if (supadataKey) {
      try {
        const result = await fetchViaSupadata(body.url, supadataKey)
        if (result) {
          console.log(
            `[Transcript] Supadata fetch: ${result.transcript.length} chars`
          )
          return NextResponse.json({
            transcript: result.transcript,
            videoId,
            segmentCount: result.segmentCount,
          })
        }
      } catch (supadataErr) {
        console.warn(
          `[Transcript] Supadata failed for ${videoId}:`,
          supadataErr instanceof Error ? supadataErr.message : supadataErr
        )
      }
    } else {
      console.warn('[Transcript] SUPADATA_API_KEY not set, skipping cloud fallback')
    }

    // Both strategies failed
    return NextResponse.json(
      { error: 'No captions available for this video' },
      { status: 404 }
    )
  } catch (error) {
    console.error(
      `[Transcript] Unexpected error:`,
      error instanceof Error ? error.message : error
    )
    const message =
      error instanceof Error ? error.message : 'Failed to fetch transcript'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
