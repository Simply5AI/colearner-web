'use client'

import { useCallback } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'

export class RecaptchaUnavailableError extends Error {
  constructor() { super('Verification is unavailable right now. Refresh this page or try again.'); this.name = 'RecaptchaUnavailableError' }
}

/** Missing optional configuration differs from configured verification that failed. */
export function useOptionalRecaptcha() {
  const { executeRecaptcha } = useGoogleReCaptcha()
  const configured = !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  return useCallback(async (action: string): Promise<string | undefined> => {
    // The library's default context supplies a thrower even without its provider.
    // An absent optional key must not invoke that default function.
    if (!configured) return undefined
    if (!executeRecaptcha) throw new RecaptchaUnavailableError()
    try {
      const token = await executeRecaptcha(action)
      if (typeof token !== 'string' || !token.trim()) throw new RecaptchaUnavailableError()
      return token
    } catch { throw new RecaptchaUnavailableError() }
  }, [configured, executeRecaptcha])
}
