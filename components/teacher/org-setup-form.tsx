'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bootstrapFreelanceOrgClient } from '@/lib/api/teacher-client'

interface OrgSetupFormProps {
  defaultDisplayName: string
}

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

export function OrgSetupForm({ defaultDisplayName }: OrgSetupFormProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(defaultDisplayName)
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await withRetry(() =>
        bootstrapFreelanceOrgClient({
          displayName: displayName.trim(),
          language,
          timezone,
        }),
      )
      toast.success('Teacher organization created')
      router.push('/teacher/onboarding')
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create teacher organization'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display-name">Organization display name</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Input
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !displayName.trim()}
        className="w-full"
      >
        {isSubmitting ? 'Creating...' : 'Create teacher organization'}
      </Button>
    </form>
  )
}