'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { StepProgress } from '@/components/onboarding/step-progress'

interface OnboardingHeaderProps {
  currentStep: number
  totalSteps: number
  skipHref?: string
  skipLabel?: string
}

export function OnboardingHeader({
  currentStep,
  totalSteps,
  skipHref = '/onboarding/welcome',
  skipLabel = 'Skip for now',
}: OnboardingHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-orange to-brand-orange-hover">
          <span className="text-[10px] font-black text-white">CL</span>
        </div>
        <span className="text-sm font-extrabold tracking-tight">
          Co<span className="text-brand-orange">Learner</span>
        </span>
      </div>

      <StepProgress currentStep={currentStep} totalSteps={totalSteps} />

      <div className="flex items-center gap-3">
        <Link
          href={skipHref}
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-brand-orange"
        >
          {skipLabel}
        </Link>
        <button
          onClick={() => signOut({ redirectTo: '/login' })}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </div>
  )
}
