/** Helpers for the original address of a link import (YouTube, website, paper). Pure; no I/O. */

function parse(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

/** The http(s) address as a safe href, or null when it is missing or not a plain web link. */
export function safeSourceUrl(url: string | null | undefined): string | null {
  return parse(url)?.href ?? null
}

/** A short, friendly label for a source address: its hostname without a leading "www." (e.g. "youtube.com"). */
export function sourceLabel(url: string | null | undefined): string | null {
  const parsed = parse(url)
  return parsed ? parsed.hostname.replace(/^www\./, '') : null
}

/** The YouTube video id for watch, youtu.be, shorts and embed addresses, or null. */
export function youtubeVideoId(url: string | null | undefined): string | null {
  const parsed = parse(url)
  if (!parsed) return null
  const host = parsed.hostname.replace(/^(www|m)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = parsed.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') id = parsed.searchParams.get('v')
    else {
      const [, kind, value] = parsed.pathname.split('/')
      if (kind === 'shorts' || kind === 'embed' || kind === 'live') id = value ?? null
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null
}

/** `https://www.youtube.com/watch?v=ID&t=Ns` for a YouTube source at `startMs`, otherwise null. */
export function youtubeTimestampUrl(sourceUrl: string | null | undefined, startMs: number): string | null {
  const id = youtubeVideoId(sourceUrl)
  if (!id) return null
  const seconds = Number.isFinite(startMs) ? Math.max(0, Math.floor(startMs / 1000)) : 0
  return `https://www.youtube.com/watch?v=${id}&t=${seconds}s`
}
