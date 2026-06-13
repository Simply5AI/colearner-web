import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { deleteTeacherMaterial, updateTeacherMaterial } from '@/lib/teacher/materials-dev-store'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ materialId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { materialId } = await context.params
  const body = await req.json()
  const material = updateTeacherMaterial(materialId, body)
  if (!material) {
    return NextResponse.json({ message: 'Material not found' }, { status: 404 })
  }
  return NextResponse.json(material)
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ materialId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { materialId } = await context.params
  if (!deleteTeacherMaterial(materialId)) {
    return NextResponse.json({ message: 'Material not found' }, { status: 404 })
  }
  return new NextResponse(null, { status: 204 })
}