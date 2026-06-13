import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { apiClient, getApiUrl } from '@/lib/api/client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const body = await req.json()

  try {
    const result = await apiClient('/api/auth/org/freelance-bootstrap', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bootstrap failed'
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status)
        : 502

    // Surface backend availability clearly until B1 ships.
    if (status === 404 || status === 502) {
      return NextResponse.json(
        {
          message:
            'Teacher bootstrap API is not available yet. Complete TASK-12-B1 on colearner-platform first.',
          code: 'TEACHER_API_NOT_READY',
          upstream: `${getApiUrl()}/api/auth/org/freelance-bootstrap`,
        },
        { status: 503 },
      )
    }

    return NextResponse.json({ message }, { status })
  }
}