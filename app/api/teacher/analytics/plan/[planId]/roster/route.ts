import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { planRosterFixtures } from '@/lib/fixtures/teacher-analytics'

export async function GET(
  _req: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { planId } = await context.params
  return NextResponse.json(planRosterFixtures[planId] ?? [])
}