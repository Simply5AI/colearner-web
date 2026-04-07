import type { Metadata } from 'next'
import { OnboardingHeader } from '@/components/onboarding/onboarding-header'
import { SkillsForm } from '@/components/onboarding/skills-form'

export const metadata: Metadata = {
  title: 'Choose Your Interests',
}

export default function SkillsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-6 sm:py-8">
      <OnboardingHeader
        currentStep={3}
        totalSteps={6}
        skipLabel="Skip — explore everything"
      />

      <div className="mt-10 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          Step 3 of 6
        </p>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">
          What interests you?
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Pick 3 or more topics — this personalizes your learning feed
        </p>
      </div>

      <div className="mt-8">
        <SkillsForm />
      </div>
    </div>
  )
}
