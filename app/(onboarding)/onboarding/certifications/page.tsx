import type { Metadata } from 'next'
import { OnboardingHeader } from '@/components/onboarding/onboarding-header'
import { CertificationsForm } from '@/components/onboarding/certifications-form'

export const metadata: Metadata = {
  title: 'Certifications',
}

export default function CertificationsPage() {
  return (
    <div className="mx-auto max-w-[620px] px-4 py-6 sm:px-6 sm:py-8">
      <OnboardingHeader
        currentStep={4}
        totalSteps={5}
        skipHref="/onboarding/ai-suggestions"
        skipLabel="Skip"
      />

      <div className="mt-10 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          Step 4 of 5
        </p>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">
          Do you have any certifications?
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Add certifications to get smarter learning recommendations
        </p>
      </div>

      <div className="mt-8">
        <CertificationsForm />
      </div>
    </div>
  )
}
