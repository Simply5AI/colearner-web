import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | CoLearner Setup',
    default: 'Setup | CoLearner',
  },
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
