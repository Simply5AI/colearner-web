import type { Metadata } from 'next'
import { OnboardingHeader } from '@/components/onboarding/onboarding-header'
import { GoalForm } from '@/components/onboarding/goal-form'

export const metadata: Metadata = {
  title: 'Learning Goal',
}

export default function GoalPage() {
  return (
    <div className="mx-auto max-w-[620px] px-4 py-6 sm:px-6 sm:py-8">
      <OnboardingHeader currentStep={2} totalSteps={6} />

      <div className="mt-10 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          Step 2 of 6
        </p>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">
          What&apos;s your learning goal?
        </h1>
        <p className="text-[13px] text-muted-foreground">
          We&apos;ll tailor your recall sessions and recommendations
        </p>
      </div>

      <div className="mt-8">
        <GoalForm />
      </div>
    </div>
  )
}
