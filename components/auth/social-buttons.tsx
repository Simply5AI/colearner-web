'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/icons/google-icon'
import { isSafeCallbackUrl } from '@/lib/auth/post-login'

interface SocialButtonsProps { isLoading?: boolean; enabled?: boolean; callbackUrl?: string | null }

export function SocialButtons({ isLoading, enabled = false, callbackUrl }: SocialButtonsProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  async function handleGoogleSignIn() {
    if (pending || isLoading) return
    setPending(true)
    setError(false)
    try { await signIn('google', { callbackUrl: isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/' }) }
    catch { setError(true); setPending(false) }
  }
  if (!enabled) return null
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="h-12 w-full gap-3" onClick={handleGoogleSignIn} disabled={isLoading || pending} aria-busy={pending}>
        <GoogleIcon className="size-5" />{pending ? 'Connecting to Google…' : 'Continue with Google'}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">Google sign-in is unavailable. Try again or use your email and password.</p>}
    </div>
  )
}
