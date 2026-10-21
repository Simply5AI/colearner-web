'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { FamilySafetyGrant } from '@colearner/api-client'
import { Button, Card, Input, Checkbox } from '@/components/design-system'
import { familyBrowserRequest } from '@/lib/api/family-browser'
import { familyConversationsPath, parseFamilyConversationsFor, type FamilyConversations, type FamilySafetyAlert, type FullConversationItem, type SummaryConversationItem } from '@/lib/api/family-conversations'
import { FamilyFeedback, FamilyQueryState, useFamilyAction } from './family-common'
import { FullConversationList, SafetyAlertList, SummaryConversationList } from './conversation-list'

const rootKey = 'family-conversations'
const safetyAccessMinutes = 15
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' })

/**
 * Transcript data is read-only and every transcript read is audited by the server, so this query is kept apart from the
 * general `['family']` keys: an unrelated family action (a PIN change, a preference save) does not re-read transcripts.
 */
export function useFamilyConversations(profileId: string, teen: boolean, safetyGrantId?: string) {
  const { data: session } = useSession()
  return useInfiniteQuery({
    queryKey: [rootKey, session?.user?.id, profileId, safetyGrantId ?? 'none'],
    queryFn: async ({ pageParam }) => parseFamilyConversationsFor(
      await familyBrowserRequest<unknown>(familyConversationsPath(profileId, { cursor: pageParam, safetyGrantId })),
      { teen, granted: !!safetyGrantId },
    ),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    enabled: !!session?.accessToken,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

type Merged = { access: 'FULL'; items: FullConversationItem[]; safetyAlerts: FamilySafetyAlert[] } | { access: 'SUMMARIES'; items: SummaryConversationItem[]; safetyAlerts: FamilySafetyAlert[] }
function unique<T extends { id: string }>(list: T[]) {
  const seen = new Set<string>()
  return list.filter(item => !seen.has(item.id) && !!seen.add(item.id))
}
function mergePages(pages: FamilyConversations[]): Merged | null {
  const first = pages[0]
  if (!first) return null
  const safetyAlerts = unique(pages.flatMap(page => page.safetyAlerts))
  return first.access === 'FULL'
    ? { access: 'FULL', items: unique(pages.flatMap(page => page.access === 'FULL' ? page.items : [])), safetyAlerts }
    : { access: 'SUMMARIES', items: unique(pages.flatMap(page => page.access === 'SUMMARIES' ? page.items : [])), safetyAlerts }
}

export function ConversationAccess({ profileId, teen }: { profileId: string; teen: boolean }) {
  const [password, setPassword] = useState('')
  const [recent, setRecent] = useState(false)
  const [reason, setReason] = useState('')
  const [grant, setGrant] = useState<FamilySafetyGrant>()
  const [grantEnded, setGrantEnded] = useState(false)
  const action = useFamilyAction()
  const client = useQueryClient()
  const access = useFamilyConversations(profileId, teen, grant?.safetyGrantId)
  const merged = useMemo(() => access.data ? mergePages(access.data.pages) : null, [access.data])
  const grantId = grant?.safetyGrantId
  const grantExpiry = grant?.expiresAt
  const endGrant = (ended: boolean) => {
    client.removeQueries({ queryKey: [rootKey], predicate: query => query.queryKey[3] !== 'none' })
    setGrant(undefined)
    setGrantEnded(ended)
  }
  useEffect(() => {
    if (!grantId || !grantExpiry) return
    const wait = Math.max(0, Math.min(new Date(grantExpiry).getTime() - Date.now(), 2 ** 31 - 1))
    const timer = setTimeout(() => {
      client.removeQueries({ queryKey: [rootKey], predicate: query => query.queryKey[3] === grantId })
      setGrant(undefined)
      setGrantEnded(true)
    }, wait)
    return () => clearTimeout(timer)
  }, [grantId, grantExpiry, client])
  const loaded = merged?.items.length ?? 0
  const [announce, setAnnounce] = useState('')
  const full = merged?.access === 'FULL'
  const privacy = full
    ? 'Only you and your child can see this. Each time you open a conversation record, the access is logged.'
    : 'You see summaries and safety alerts only. Your teen’s messages stay private unless you request audited safety access below.'
  return <Card className="space-y-5">
    <h2 className="text-xl font-bold">{teen ? 'Chats with Co: summaries & safety access' : 'Chats with Co'}</h2>
    <FamilyQueryState pending={access.isPending} error={merged?null:access.error} retry={() => void access.refetch()}>{merged && <>
      <p>{merged.access === 'SUMMARIES' ? 'Summary access applies to this teen profile.' : 'Full authorized access applies to this profile.'}</p>
      <p className="text-sm text-muted-foreground">{privacy}</p>
      {grant && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/40 p-3 text-sm"><p>Safety access is active for {safetyAccessMinutes} minutes and ends at {time(grant.expiresAt)}. Transcripts disappear when it ends.</p><Button variant="secondary" onClick={() => endGrant(true)}>End safety access now</Button></div>}
      <section aria-labelledby={`conversations-${profileId}`} className="space-y-3">
        <h3 id={`conversations-${profileId}`} className="font-bold">Recent chats</h3>
        {loaded === 0
          ? <div className="space-y-1 rounded-xl bg-muted p-4"><p className="font-semibold">No chats with Co yet</p><p className="text-sm text-muted-foreground">{teen ? 'When your teen chats with Co or asks for homework help, a summary appears here. You will not see message text.' : 'When your child chats with Co or asks for homework help, the conversation appears here.'}</p></div>
          : merged.access === 'FULL' ? <FullConversationList items={merged.items} /> : <SummaryConversationList items={merged.items} />}
        {access.hasNextPage && <Button variant="secondary" loading={access.isFetchingNextPage} onClick={() => void access.fetchNextPage().then(result => { if (!result.isError) setAnnounce(`Loaded more conversations. ${result.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0} shown.`) })}>Load more</Button>}
        {access.isFetchNextPageError && access.error && <p role="alert" className="break-words rounded-2xl border border-destructive/30 bg-destructive/5 p-4">{access.error.message} The conversations already loaded are still shown.</p>}
        <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      </section>
      <SafetyAlertList alerts={merged.safetyAlerts} />
    </>}</FamilyQueryState>
    {grant && access.error && !merged && <Button variant="secondary" onClick={() => endGrant(true)}>End safety access and show summaries</Button>}
    {grantEnded && !grant && <p role="status" className="rounded-xl bg-accent/40 p-3 text-sm">Safety access has ended. Only summaries and safety alerts are shown.</p>}
    {teen && <form method="post" className="space-y-4 border-t pt-4" onSubmit={event => { event.preventDefault(); action.mutate({ path: `/family/profiles/${profileId}/safety-access`, body: { ...(password ? { password } : {}), reason } }, { onSuccess: result => { setGrant(result as FamilySafetyGrant); setGrantEnded(false); setPassword(''); setReason(''); setAnnounce('') } }) }}>
      <h3 className="font-bold">Request reasoned safety access</h3>
      <p className="text-sm text-muted-foreground">A fresh password and a specific safety reason are required. Access is audited, limited to this child and lasts {safetyAccessMinutes} minutes. When it is granted, this profile’s transcripts appear above until it ends.</p>
      <Input label="Safety access reason" required minLength={20} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />
      <Input label="Your adult password for safety access" type="password" autoComplete="current-password" required={!recent} value={password} onChange={event => setPassword(event.target.value)} />
      <Checkbox label="Use my recent sign-in instead (checked by the server)" checked={recent} onChange={event => { setRecent(event.target.checked); setPassword('') }} />
      <Button type="submit" loading={action.isPending}>Request audited safety access</Button>
      {grant && <p role="status">This child’s safety grant expires {new Date(grant.expiresAt).toLocaleTimeString()}.</p>}
      <FamilyFeedback pending={action.isPending} error={action.error} />
    </form>}
  </Card>
}
