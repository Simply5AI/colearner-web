'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { GraduationCap, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function TeacherModeBanner() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [dismissed, setDismissed] = useState(false)

  const isTeacher = session?.user?.roles?.includes('TEACHER') ?? false
  const onStudentRoute =
    !pathname.startsWith('/teacher') &&
    !pathname.startsWith('/become-teacher') &&
    !pathname.startsWith('/admin')

  if (!isTeacher || !onStudentRoute || dismissed) {
    return null
  }

  return (
    <div className="border-b border-primary/20 bg-primary/5 px-5 py-2.5 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <GraduationCap className="h-4 w-4 text-primary" />
          You are also registered as a teacher.
        </p>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/teacher/dashboard">Open teacher dashboard</Link>
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dismiss teacher banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}