'use client'

import { useCallback } from 'react'
import { useAdminReauth } from '@/components/admin/admin-auth/admin-reauth-provider'
import { AdminBrowserError } from '@/lib/api/admin-browser'

/**
 * Wraps admin mutations that may require a fresh TOTP step-up. On
 * `REAUTH_REQUIRED`, prompts the operator and retries once.
 */
export function useAdminMutation() {
  const { requestReauth } = useAdminReauth()

  const runSensitive = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (error) {
        if (error instanceof AdminBrowserError && error.code === 'REAUTH_REQUIRED') {
          const ok = await requestReauth()
          if (!ok) throw error
          return await fn()
        }
        throw error
      }
    },
    [requestReauth]
  )

  return { runSensitive }
}