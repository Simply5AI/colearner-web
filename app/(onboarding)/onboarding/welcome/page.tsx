import type { Metadata } from 'next'
import { WelcomeCelebration } from '@/components/onboarding/welcome-celebration'

export const metadata: Metadata = {
  title: 'Welcome to CoLearner!',
}

export default function WelcomePage() {
  return <WelcomeCelebration />
}
