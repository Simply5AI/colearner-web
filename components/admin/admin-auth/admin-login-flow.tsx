'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OtpInput } from '@/components/admin/admin-auth/otp-input'
import {
  adminChallenge,
  adminLogin,
  adminMe,
  adminTotpSetup,
  adminTotpVerify,
} from '@/lib/api/admin-auth-client'

type Step = 'credentials' | 'setup' | 'verify-setup' | 'backup-codes' | 'challenge'

function extractSecret(otpauthUrl: string): string | null {
  try {
    return new URL(otpauthUrl).searchParams.get('secret')
  } catch {
    return null
  }
}

export function AdminLoginFlow() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [qr, setQr] = useState<{ dataUrl: string; secret: string | null } | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Already authenticated → skip straight to the dashboard.
  useEffect(() => {
    let active = true
    adminMe().then((r) => {
      if (active && r.authenticated) router.replace('/admin')
    })
    return () => {
      active = false
    }
  }, [router])

  const beginSetup = async () => {
    setLoading(true)
    setError(null)
    try {
      const { qrDataUrl, otpauthUrl } = await adminTotpSetup()
      setQr({ dataUrl: qrDataUrl, secret: extractSecret(otpauthUrl) })
      setStep('setup')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start authenticator setup')
    } finally {
      setLoading(false)
    }
  }

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { status } = await adminLogin(email, password)
      if (status === 'TOTP_CHALLENGE_REQUIRED') {
        setStep('challenge')
      } else {
        await beginSetup()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const submitSetupVerify = async (override?: string) => {
    const value = override ?? code
    setLoading(true)
    setError(null)
    try {
      const { backupCodes: codes } = await adminTotpVerify(value)
      setBackupCodes(codes)
      setCode('')
      setStep('backup-codes')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const submitChallenge = async (override?: string) => {
    const value = override ?? code
    setLoading(true)
    setError(null)
    try {
      await adminChallenge(value)
      router.replace('/admin')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Admin access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 'credentials' && 'Sign in to the CoLearner operations console.'}
          {step === 'setup' && 'Scan the QR code with your authenticator app.'}
          {step === 'verify-setup' && 'Enter the 6-digit code to confirm setup.'}
          {step === 'backup-codes' && 'Save your backup codes somewhere safe.'}
          {step === 'challenge' && 'Enter the code from your authenticator app.'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 'credentials' && (
        <form onSubmit={submitCredentials} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@inlogic.ae"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </form>
      )}

      {step === 'setup' && qr && (
        <div className="space-y-4">
          <div className="flex justify-center rounded-xl border border-border bg-card p-4">
            <Image src={qr.dataUrl} alt="TOTP QR code" width={200} height={200} unoptimized />
          </div>
          {qr.secret && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Or enter this key manually:</p>
              <code className="block break-all rounded-md border border-border bg-muted px-3 py-2 text-center text-sm font-semibold tracking-wide">
                {qr.secret}
              </code>
            </div>
          )}
          <Button className="w-full" onClick={() => setStep('verify-setup')}>
            I&apos;ve added it
          </Button>
        </div>
      )}

      {step === 'verify-setup' && (
        <div className="space-y-5">
          <OtpInput value={code} onChange={setCode} onComplete={(v) => submitSetupVerify(v)} />
          <Button
            className="w-full"
            disabled={loading || code.length < 6}
            onClick={() => submitSetupVerify()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
        </div>
      )}

      {step === 'backup-codes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-4">
            {backupCodes.map((c) => (
              <code key={c} className="text-center text-sm font-semibold tabular-nums">
                {c}
              </code>
            ))}
          </div>
          <Button variant="outline" className="w-full" onClick={copyBackupCodes}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copied' : 'Copy codes'}
          </Button>
          <Button className="w-full" onClick={() => setStep('challenge')}>
            I&apos;ve saved them — continue
          </Button>
        </div>
      )}

      {step === 'challenge' && (
        <div className="space-y-5">
          <OtpInput value={code} onChange={setCode} onComplete={(v) => submitChallenge(v)} />
          <Button
            className="w-full"
            disabled={loading || code.length < 6}
            onClick={() => submitChallenge()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify &amp; sign in
          </Button>
        </div>
      )}
    </div>
  )
}
