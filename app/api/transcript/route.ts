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
 * Fetch transcript using YouTube's internal InnerTube API.
 * Works from cloud servers (Vercel, Railway) where scraping-based
 * libraries fail due to IP-based bot detection.
 */
async function fetchViaInnerTube(
  videoId: string
): Promise<{ transcript: string; segmentCount: number } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    // Step 1: Get caption tracks from InnerTube player endpoint
    const playerRes = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20250320.00.00',
            },
          },
          videoId,
        }),
        signal: controller.signal,
      }
    )

    if (!playerRes.ok) return null

    const playerData = await playerRes.json()
    const captionTracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

    if (
      !captionTracks ||
      !Array.isArray(captionTracks) ||
      captionTracks.length === 0
    ) {
      return null
    }

    // Prefer manual captions over auto-generated, prefer English
    const track =
      captionTracks.find(
        (t: { kind?: string; languageCode?: string }) =>
          t.kind !== 'asr' && t.languageCode === 'en'
      ) ??
      captionTracks.find(
        (t: { languageCode?: string }) => t.languageCode === 'en'
      ) ??
      captionTracks.find((t: { kind?: string }) => t.kind !== 'asr') ??
      captionTracks[0]

    const baseUrl: string | undefined = track?.baseUrl
    if (!baseUrl) return null

    // Step 2: Fetch the actual caption content in JSON3 format
    const captionUrl = baseUrl.includes('fmt=')
      ? baseUrl
      : `${baseUrl}&fmt=json3`

    const captionRes = await fetch(captionUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    })

    if (!captionRes.ok) return null

    const captionData = await captionRes.json()
    const events: Array<{ segs?: Array<{ utf8?: string }> }> =
      captionData?.events ?? []

    const segments = events.filter((e) => e.segs)
    const text = segments
      .flatMap((e) => e.segs!.map((s) => s.utf8 ?? ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!text.length) return null

    return { transcript: decodeHtmlEntities(text), segmentCount: segments.length }
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
        return NextResponse.json({
          transcript,
          videoId,
          segmentCount: transcriptItems.length,
        })
      }
    } catch (directErr) {
      console.warn(
        `[Transcript] Direct fetch failed for ${videoId}, trying InnerTube:`,
        directErr instanceof Error ? directErr.message : directErr
      )
    }

    // Strategy 2: InnerTube API (works from cloud servers)
    try {
      const result = await fetchViaInnerTube(videoId)
      if (result) {
        return NextResponse.json({
          transcript: result.transcript,
          videoId,
          segmentCount: result.segmentCount,
        })
      }
    } catch (innerTubeErr) {
      console.warn(
        `[Transcript] InnerTube failed for ${videoId}:`,
        innerTubeErr instanceof Error ? innerTubeErr.message : innerTubeErr
      )
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
