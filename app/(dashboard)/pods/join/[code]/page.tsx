'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useJoinByCode } from '@/lib/hooks/use-pods'

export default function JoinByCodePage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const joinByCode = useJoinByCode()

  useEffect(() => {
    if (params.code && !joinByCode.isPending && !joinByCode.isSuccess && !joinByCode.isError) {
      joinByCode.mutate(params.code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-7">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-center">Joining Group</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {joinByCode.isPending && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Joining group with code {params.code}...</p>
            </>
          )}

          {joinByCode.isSuccess && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              <p className="text-sm font-medium">Successfully joined the group!</p>
              <Button onClick={() => router.push(`/pods/${joinByCode.data.podId}`)}>
                Go to Group
              </Button>
            </>
          )}

          {joinByCode.isError && (
            <>
              <XCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive">{joinByCode.error.message}</p>
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
