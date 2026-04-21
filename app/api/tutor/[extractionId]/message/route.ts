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
  const body = await req.text()

  const base = getApiUrl().replace('localhost', '127.0.0.1')
  const upstream = await fetch(`${base}/api/tutor/${extractionId}/message`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body,
  })

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
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
