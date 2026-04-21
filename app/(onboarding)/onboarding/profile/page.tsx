import type { Metadata } from 'next'
import { OnboardingHeader } from '@/components/onboarding/onboarding-header'
import { ProfileForm } from '@/components/onboarding/profile-form'

export const metadata: Metadata = {
  title: 'Profile Setup',
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-[620px] px-4 py-6 sm:px-6 sm:py-8">
      <OnboardingHeader currentStep={1} totalSteps={5} />

      <div className="mt-10 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          Step 1 of 5
        </p>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">
          Set up your profile
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Help us personalize your learning experience
        </p>
      </div>

      <div className="mt-8">
        <ProfileForm />
      </div>
    </div>
  )
}
