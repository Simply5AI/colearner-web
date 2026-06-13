import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { createTeacherMaterial, listTeacherMaterials } from '@/lib/teacher/materials-dev-store'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const planId = req.nextUrl.searchParams.get('planId')
  const topicId = req.nextUrl.searchParams.get('topicId') ?? undefined
  if (!planId) {
    return NextResponse.json({ message: 'planId is required' }, { status: 400 })
  }

  return NextResponse.json(listTeacherMaterials({ planId, topicId }))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const body = await req.json()
  if (!body.planId || !body.title || !body.type) {
    return NextResponse.json({ message: 'planId, title, and type are required' }, { status: 400 })
  }

  const material = createTeacherMaterial({
    planId: body.planId,
    topicId: body.topicId,
    title: String(body.title).trim(),
    type: body.type,
    visibility: body.visibility ?? 'SUBSCRIBER',
    downloadable: Boolean(body.downloadable),
    url: body.url,
    externalUrl: body.externalUrl,
    externalTitle: body.externalTitle,
    externalDescription: body.externalDescription,
    richTextContent: body.richTextContent,
  })

  return NextResponse.json(material, { status: 201 })
}