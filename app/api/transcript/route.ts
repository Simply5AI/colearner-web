import { NextRequest, NextResponse } from 'next/server'
import {
  YoutubeTranscript,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
} from 'youtube-transcript-plus'

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

    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)

    if (!transcriptItems.length) {
      return NextResponse.json(
        { error: 'No transcript available for this video' },
        { status: 404 }
      )
    }

    const transcript = decodeHtmlEntities(
      transcriptItems.map((item) => item.text).join(' ')
    )

    return NextResponse.json({
      transcript,
      videoId,
      segmentCount: transcriptItems.length,
    })
  } catch (error) {
    const videoId = (error as { videoId?: string }).videoId ?? 'unknown'
    console.error(
      `[Transcript] ${error instanceof Error ? error.constructor.name : 'Error'} for ${videoId}:`,
      error instanceof Error ? error.message : error
    )

    if (error instanceof YoutubeTranscriptTooManyRequestError) {
      return NextResponse.json(
        { error: 'YouTube rate limit reached. Please try again in a few minutes.' },
        { status: 429 }
      )
    }
    if (error instanceof YoutubeTranscriptVideoUnavailableError) {
      return NextResponse.json(
        { error: 'Video not found or unavailable' },
        { status: 404 }
      )
    }
    if (error instanceof YoutubeTranscriptDisabledError) {
      return NextResponse.json(
        { error: 'Transcripts are disabled for this video' },
        { status: 403 }
      )
    }
    if (error instanceof YoutubeTranscriptNotAvailableError) {
      return NextResponse.json(
        { error: 'No captions available for this video' },
        { status: 404 }
      )
    }
    if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
      return NextResponse.json(
        { error: 'Transcript not available in the requested language' },
        { status: 404 }
      )
    }

    const message =
      error instanceof Error ? error.message : 'Failed to fetch transcript'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
