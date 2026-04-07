'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useJoinByToken } from '@/lib/hooks/use-pods'

export default function JoinByTokenPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const joinByToken = useJoinByToken()

  useEffect(() => {
    if (params.token && !joinByToken.isPending && !joinByToken.isSuccess && !joinByToken.isError) {
      joinByToken.mutate(params.token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-7">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-center">Accepting Invite</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {joinByToken.isPending && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Processing your invite...</p>
            </>
          )}

          {joinByToken.isSuccess && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              <p className="text-sm font-medium">Successfully joined the group!</p>
              <Button onClick={() => router.push(`/pods/${joinByToken.data.podId}`)}>
                Go to Group
              </Button>
            </>
          )}

          {joinByToken.isError && (
            <>
              <XCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive">{joinByToken.error.message}</p>
              <Button variant="outline" onClick={() => router.push('/pods')}>
                Back to Groups
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
