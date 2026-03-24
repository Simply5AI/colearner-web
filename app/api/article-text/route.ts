import { NextRequest, NextResponse } from 'next/server'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url: string }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'URL must use HTTP or HTTPS' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CoLearner/1.0 (article extractor)' },
      })

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch article: HTTP ${response.status}` },
          { status: 502 }
        )
      }

      const html = await response.text()
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()

      if (!article || !article.textContent?.trim()) {
        // Fallback: extract body text
        const bodyText = dom.window.document.body?.textContent?.trim()
        const titleEl = dom.window.document.querySelector('title')
        if (!bodyText) {
          return NextResponse.json(
            { error: 'Could not extract text from this page' },
            { status: 422 }
          )
        }
        return NextResponse.json({
          text: bodyText,
          title: titleEl?.textContent?.trim() || url,
        })
      }

      return NextResponse.json({
        text: article.textContent.trim(),
        title: article.title || url,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
