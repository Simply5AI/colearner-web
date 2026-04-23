import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getApiUrl } from '@/lib/api/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ extractionId: string }>
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { extractionId } = await params
  const contentType = req.headers.get('content-type') ?? 'application/json'
  const isMultipart = contentType.startsWith('multipart/form-data')

  const base = getApiUrl().replace('localhost', '127.0.0.1')

  let upstream: Response
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'text/event-stream',
    }
    let body: BodyInit

    if (isMultipart) {
      const formData = await req.formData()
      const image = formData.get('image')
      console.info(
        '[tutor proxy] forwarding multipart',
        JSON.stringify({
          extractionId,
          hasImage: image instanceof File,
          imageType: image instanceof File ? image.type : null,
          imageSize: image instanceof File ? image.size : 0,
          hasContent: typeof formData.get('content') === 'string',
        }),
      )
      body = formData
    } else {
      headers['Content-Type'] = contentType
      body = await req.text()
    }

    upstream = await fetch(`${base}/api/tutor/${extractionId}/message`, {
      method: 'POST',
      headers,
      body,
    })
  } catch (err) {
    console.error('[tutor proxy] upstream fetch failed', err)
    return NextResponse.json(
      { message: (err as Error).message || 'Upstream unreachable' },
      { status: 502 },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    console.error('[tutor proxy] upstream error', upstream.status, errText)
    return new NextResponse(errText || 'Upstream error', {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const reader = upstream.body.getReader()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        controller.enqueue(value)
      } catch (err) {
        controller.error(err)
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
    },
  })

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
    },
  })
}
