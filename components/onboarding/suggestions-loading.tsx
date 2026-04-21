'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import {
  updateOnboardingEducation,
  updateOnboardingCertifications,
  triggerOnboardingSuggestions,
  getOnboardingSuggestionStatus,
} from '@/lib/api/user'
import { queryKeys } from '@/lib/api/query-keys'

export function SuggestionsLoading() {
  const router = useRouter()
  const { data: session } = useSession()
  const { educationLevel, fieldOfStudy, isCurrent, institution, graduationYear, certifications } =
    useOnboardingStore()
  const [phase, setPhase] = useState<'submitting' | 'generating' | 'error'>('submitting')
  const [errorMsg, setErrorMsg] = useState('')
  const submitted = useRef(false)

  // Poll for suggestion status once we've triggered generation
  const { data: suggestionStatus } = useQuery({
    queryKey: queryKeys.onboarding.suggestionStatus(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getOnboardingSuggestionStatus(session.accessToken)
    },
    enabled: phase === 'generating' && !!session?.accessToken,
    refetchInterval: 2000,
  })

  // Navigate to review once suggestions are ready
  useEffect(() => {
    if (suggestionStatus?.generated) {
      router.push('/onboarding/review')
    }
  }, [suggestionStatus, router])

  // Submit education + certifications + trigger generation on mount
  useEffect(() => {
    if (submitted.current || !session?.accessToken) return
    submitted.current = true

    const run = async () => {
      const token = session.accessToken!
      try {
        // Step 1: Submit education if provided
        if (educationLevel && fieldOfStudy) {
          await updateOnboardingEducation(token, {
            educationLevel,
            fieldOfStudy,
            isCurrent,
            institution: institution || undefined,
            graduationYear: graduationYear ?? undefined,
          })
        }

        // Step 2: Submit certifications if any
        if (certifications.length > 0) {
          await updateOnboardingCertifications(token, { certifications })
        }

        // Step 3: Trigger AI suggestion generation
        if (educationLevel && fieldOfStudy) {
          await triggerOnboardingSuggestions(token)
          setPhase('generating')
        } else {
          // No education data, skip to welcome
          router.push('/onboarding/welcome')
        }
      } catch (err) {
        console.error('Suggestion trigger failed:', err)
        setPhase('error')
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      }
    }

    run()
  }, [session, educationLevel, fieldOfStudy, isCurrent, institution, graduationYear, certifications, router])

  const handleRetry = () => {
    submitted.current = false
    setPhase('submitting')
    setErrorMsg('')
    // Re-trigger by resetting the ref
    window.location.reload()
  }

  const handleSkip = () => {
    router.push('/onboarding/welcome')
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-4xl mb-4">&#x26A0;&#xFE0F;</div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {errorMsg || 'Failed to generate suggestions. You can retry or skip for now.'}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button
            onClick={handleRetry}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative mb-8">
        <div className="text-5xl animate-pulse">&#x2728;</div>
      </div>

      <h2 className="text-2xl font-black tracking-tight mb-3">
        Personalizing your path...
      </h2>

      <p className="text-sm text-muted-foreground max-w-md mb-8">
        {fieldOfStudy
          ? `Analyzing your background in ${fieldOfStudy}${certifications.length > 0 ? ` and ${certifications.length} certification${certifications.length > 1 ? 's' : ''}` : ''} to create a custom learning plan just for you.`
          : 'Preparing your personalized learning suggestions...'}
      </p>

      <Loader2 className="size-8 animate-spin text-brand-orange" />

      <p className="mt-6 text-xs text-muted-foreground">
        This usually takes 10-20 seconds
      </p>
    </div>
  )
}
