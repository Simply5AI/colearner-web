'use client'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BrandMark, CoCharacter, Button, ErrorState, LoadingState } from '@/components/design-system'
import { familyBrowserRequest } from '@/lib/api/family-browser'
import type { FamilyMethod } from '@/lib/api/family'
import { useClientReady } from '@/components/auth/use-client-ready'

export function FamilyFrame({ children, title, description, step, co = false }: { children: React.ReactNode; title: string; description?: string; step?: number; co?: boolean }) {
  const clientReady = useClientReady()
  return <div data-age-band="tweens" className="min-h-dvh bg-gradient-to-b from-background to-accent/30 pb-20">
    <a href="#family-main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:bg-background focus:p-4">Skip to main content</a>
    <header className="border-b bg-background"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 p-4 sm:px-6"><Link href="/" aria-label="CoLearner home"><BrandMark /></Link><Link href="/profiles" className="ds-button ds-button-ghost">Shared device</Link>{step && <span className="text-sm font-semibold">Parent consent · step {step} of 4</span>}</div>{step && <div role="progressbar" aria-label="Parent setup progress" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} className="mx-auto flex max-w-5xl gap-2 px-4 pb-4">{[1,2,3,4].map(n => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>}</header>
    <main id="family-main" tabIndex={-1} className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      {co && <div className="flex justify-center"><CoCharacter band="tweens" state="waving" size={150} decorative /></div>}
      <div className="space-y-3"><h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold sm:text-4xl">{title}</h1>{description && <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>}</div><fieldset disabled={!clientReady} className="min-w-0 space-y-6">{children}</fieldset>
    </main></div>
}
export function FamilyQueryState({ pending, error, retry, children }: { pending: boolean; error: Error | null; retry: () => void; children: React.ReactNode }) {
  if (pending) return <LoadingState label="Checking your family access…" />
  if (error) return <ErrorState band="tweens" title="Family access unavailable" description={error.message} action={<Button onClick={retry}>Try again</Button>} />
  return children
}
export function FamilyFeedback({ pending, error, message }: { pending: boolean; error: Error | null; message?: string }) {
  return <div aria-live="polite">{pending && <LoadingState label="Please wait…" />}{error && <p role="alert" className="break-words rounded-2xl border border-destructive/30 bg-destructive/5 p-4">{error.message}</p>}{!pending && !error && message && <p role="status" className="rounded-2xl bg-accent/40 p-4">{message}</p>}</div>
}
export function FamilyAccessUnavailable(){const router=useRouter();return <FamilyFrame title="Account access unavailable" description="We could not check the age and consent gate. No profile or school details will be collected until this check succeeds."><Button onClick={()=>router.refresh()}>Try access check again</Button></FamilyFrame>}
export function useFamilyData<T>(path: string, enabled = true) {
  const { data: session } = useSession()
  return useQuery({ queryKey: ['family', session?.user?.id, path], queryFn: () => familyBrowserRequest<T>(path), enabled: !!session?.accessToken && enabled, retry: false })
}
export function useFamilyAction() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ path, method = 'POST', body }: { path: string; method?: FamilyMethod; body?: unknown }) => familyBrowserRequest<unknown>(path, method, body), retry: false, onSuccess: () => client.invalidateQueries({ queryKey: ['family'] }) })
}
