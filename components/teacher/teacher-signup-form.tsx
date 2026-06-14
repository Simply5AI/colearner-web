'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerUser } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { bootstrapFreelanceOrgClient } from '@/lib/api/teacher-client'

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500))
    }
  }
  throw lastError
}

export function TeacherSignupForm() {
  const router = useRouter()
  const { update } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
        acceptedTerms: true,
      })

      const signInResult = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        throw new Error('Account created but sign-in failed. Please sign in and try again.')
      }

      const result = await withRetry(() =>
        bootstrapFreelanceOrgClient({
          displayName: displayName.trim(),
          language,
          timezone,
        }),
      )

      await update({
        onboardingCompleted: true,
        ...(result.accessToken ? { accessToken: result.accessToken } : {}),
        ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}),
      })

      toast.success('Teacher account created')
      router.push('/teacher/onboarding')
      router.refresh()
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to create teacher account'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="teacher-name">Your name</Label>
          <Input
            id="teacher-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-email">Email</Label>
          <Input
            id="teacher-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-password">Password</Label>
          <Input
            id="teacher-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="school-name">School / organization name</Label>
        <Input
          id="school-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="e.g. Ada Lovelace Academy"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="teacher-language">Language</Label>
          <Input
            id="teacher-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teacher-timezone">Timezone</Label>
          <Input
            id="teacher-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting || !displayName.trim()} className="w-full">
        {isSubmitting ? 'Creating account...' : 'Create teacher account'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already have a teacher account?{' '}
        <Link
          href="/login?callbackUrl=/teacher/dashboard"
          className="font-semibold text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}