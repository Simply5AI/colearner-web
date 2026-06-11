'use client'

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OtpInput } from '@/components/admin/admin-auth/otp-input'
import { adminReauth } from '@/lib/api/admin-auth-client'

interface ReauthContextValue {
  /**
   * Prompt the operator for a fresh TOTP code. Resolves `true` once re-auth
   * succeeds, or `false` if the operator cancels. Use before/around a sensitive
   * mutation, or in response to a 401 `REAUTH_REQUIRED` from the API.
   */
  requestReauth: () => Promise<boolean>
}

const ReauthContext = createContext<ReauthContextValue | null>(null)

export function useAdminReauth(): ReauthContextValue {
  const ctx = useContext(ReauthContext)
  if (!ctx) throw new Error('useAdminReauth must be used within AdminReauthProvider')
  return ctx
}

export function AdminReauthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const requestReauth = useCallback(() => {
    setCode('')
    setError(null)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (ok: boolean) => {
    setOpen(false)
    resolver.current?.(ok)
    resolver.current = null
  }

  const submit = async (override?: string) => {
    const value = override ?? code
    setLoading(true)
    setError(null)
    try {
      await adminReauth(value)
      settle(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReauthContext.Provider value={{ requestReauth }}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Confirm it&apos;s you
            </DialogTitle>
            <DialogDescription>
              This is a sensitive action. Enter the current code from your authenticator app.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="py-2">
            <OtpInput value={code} onChange={setCode} onComplete={(v) => submit(v)} />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => settle(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={() => submit()} disabled={loading || code.length < 6}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReauthContext.Provider>
  )
}
