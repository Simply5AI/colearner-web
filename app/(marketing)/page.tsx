'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
        CoLearner
      </h1>
      <p className="max-w-md text-center text-lg text-muted-foreground">
        AI-powered adaptive learning platform. Master any subject with spaced
        repetition and active recall.
      </p>
      <div className="flex gap-4">
        <Link href="/signup" className={cn(buttonVariants({ size: 'lg' }))}>
          Get Started
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
