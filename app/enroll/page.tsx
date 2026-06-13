'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { redeemInviteCodeClient } from '@/lib/api/teacher-enrollments-client'

function EnrollForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await redeemInviteCodeClient(code)
      toast.success('Enrolled successfully')
      router.push(`/dashboard?enrolled=${result.planId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to redeem code')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join a study plan</CardTitle>
          <CardDescription>Enter the invite code from your teacher to enroll.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input
                id="invite-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="ALGO-2026"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Enrolling...' : 'Enroll'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function EnrollPage() {
  return (
    <Suspense>
      <EnrollForm />
    </Suspense>
  )
}