import type { Metadata } from 'next'
import { OnboardingHeader } from '@/components/onboarding/onboarding-header'
import { EducationForm } from '@/components/onboarding/education-form'

export const metadata: Metadata = {
  title: 'Educational Background',
}

export default function EducationPage() {
  return (
    <div className="mx-auto max-w-[620px] px-4 py-6 sm:px-6 sm:py-8">
      <OnboardingHeader
        currentStep={3}
        totalSteps={5}
        skipHref="/onboarding/certifications"
        skipLabel="Skip"
      />

      <div className="mt-10 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          Step 3 of 5
        </p>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">
          Tell us about your education
        </h1>
        <p className="text-[13px] text-muted-foreground">
          This helps us personalize your learning path
        </p>
      </div>

      <div className="mt-8">
        <EducationForm />
      </div>
    </div>
  )
}
