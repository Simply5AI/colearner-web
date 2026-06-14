'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Ticket } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RedeemCodeDialog } from '@/components/student/redeem-code-dialog'
import type { StudentEnrollmentSummary } from '@/lib/types/student-enrollment'

interface EnrolledPlansListProps {
  enrollments: StudentEnrollmentSummary[]
}

export function EnrolledPlansList({ enrollments }: EnrolledPlansListProps) {
  const [redeemOpen, setRedeemOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Teacher plans</p>
          <h1 className="text-2xl font-bold">Enrolled study plans</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Plans assigned by your teachers — separate from your personal learning roadmap.
          </p>
        </div>
        <Button onClick={() => setRedeemOpen(true)}>
          <Ticket className="mr-2 h-4 w-4" />
          Have an invite code?
        </Button>
      </div>

      {enrollments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-semibold">No enrolled plans yet</h2>
              <p className="text-sm text-muted-foreground">
                When a teacher shares an invite code, redeem it here to access their study plan,
                materials, and practice questions.
              </p>
            </div>
            <Button onClick={() => setRedeemOpen(true)}>Redeem invite code</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base leading-snug">{enrollment.planTitle}</CardTitle>
                    <CardDescription className="mt-1">
                      with {enrollment.teacherName}
                    </CardDescription>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Teacher
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{enrollment.progressPercent}%</span>
                  </div>
                  <Progress value={enrollment.progressPercent} className="h-1.5" />
                </div>
                {enrollment.nextTopicTitle && (
                  <p className="text-xs text-muted-foreground">
                    Up next: <span className="font-medium text-foreground">{enrollment.nextTopicTitle}</span>
                  </p>
                )}
                <Link
                  href={`/learn/enrolled/${enrollment.clonedPlanId}`}
                  className={cn(buttonVariants(), 'w-full')}
                >
                  {enrollment.progressPercent > 0 ? 'Continue' : 'Open plan'}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RedeemCodeDialog open={redeemOpen} onOpenChange={setRedeemOpen} />
    </div>
  )
}