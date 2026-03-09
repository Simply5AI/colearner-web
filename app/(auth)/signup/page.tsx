import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Sign Up | CoLearner',
  description: 'Create your CoLearner account',
}

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-brand-orange">Welcome to CoLearner</p>
        <h1 className="text-[28px] font-black tracking-tight leading-tight">
          Create your account
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Start your learning journey today
        </p>
      </div>
      <SignupForm />
    </div>
  )
}
