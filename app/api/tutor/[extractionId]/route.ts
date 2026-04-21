import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getApiUrl } from '@/lib/api/client'

interface Params {
  params: Promise<{ extractionId: string }>
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { extractionId } = await params
  const base = getApiUrl().replace('localhost', '127.0.0.1')
  const upstream = await fetch(`${base}/api/tutor/${extractionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}
