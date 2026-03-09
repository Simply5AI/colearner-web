import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign In | CoLearner',
  description: 'Sign in to your CoLearner account',
}

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-brand-orange">Welcome back!</p>
        <h1 className="text-[28px] font-black tracking-tight leading-tight">
          Sign in to your account
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Continue your learning journey
        </p>
      </div>
      <LoginForm />
    </div>
  )
}
