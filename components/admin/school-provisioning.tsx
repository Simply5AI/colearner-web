'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Input, Select } from '@/components/design-system'
import { useAdminReauth } from '@/components/admin/admin-auth/admin-reauth-provider'
import { adminBrowserClient } from '@/lib/api/admin-browser'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
interface ProvisionedSchool { id: string; organizationId: string; name: string; status: string }

/** Platform provisioning never accepts an ordinary account role as authority. */
export function SchoolProvisioning() {
  const { requestReauth } = useAdminReauth()
  const [draft, setDraft] = useState({ organizationId: '', adminUserId: '', name: '' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ProvisionedSchool>()
  const [membership, setMembership] = useState({ schoolId: '', userId: '', membershipId: '', status: 'SUSPENDED' })
  const [membershipPending, setMembershipPending] = useState(false)
  const [membershipMessage, setMembershipMessage] = useState('')
  const [membershipError, setMembershipError] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  const update = (field: keyof typeof draft, value: string) => { setDraft(old => ({ ...old, [field]: value })); setError(''); setResult(undefined) }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    if (!uuid.test(draft.organizationId) || !uuid.test(draft.adminUserId) || !draft.name.trim()) { setError('Enter valid organisation and account IDs and a school name.'); requestAnimationFrame(() => errorRef.current?.focus()); return }
    setPending(true); setError('')
    try {
      if (!await requestReauth()) return
      const school = await adminBrowserClient<ProvisionedSchool>('/schools', { method: 'POST', body: { ...draft, name: draft.name.trim() }, signal: AbortSignal.timeout(15000) })
      if (!school?.id || school.organizationId !== draft.organizationId || school.status !== 'ACTIVE') throw new Error('The school response could not be verified. Refresh before retrying.')
      setResult(school)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'School provisioning failed. Review your details and try again.')
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally { setPending(false) }
  }
  const manage = async (event: React.FormEvent, grant: boolean) => {
    event.preventDefault()
    if (membershipPending) return
    if (!uuid.test(membership.schoolId) || !uuid.test(grant ? membership.userId : membership.membershipId)) { setMembershipError('Enter a valid school ID and the target account or membership ID.'); return }
    setMembershipPending(true); setMembershipError(''); setMembershipMessage('')
    try {
      if (!await requestReauth()) return
      const path = `/schools/${encodeURIComponent(membership.schoolId)}/memberships${grant ? '' : `/${encodeURIComponent(membership.membershipId)}`}`
      const changed = await adminBrowserClient<{ id: string; role: string; status: string }>(path, { method: grant ? 'POST' : 'PATCH', body: grant ? { userId: membership.userId, role: 'SCHOOL_ADMIN' } : { status: membership.status }, signal: AbortSignal.timeout(15000) })
      if (!changed?.id || (grant && changed.role !== 'SCHOOL_ADMIN')) throw new Error('The membership response could not be verified. Refresh before retrying.')
      setMembershipMessage(`School membership ${changed.id}: ${changed.status}. Platform authority was not changed.`)
    } catch (failure) { setMembershipError(failure instanceof Error ? failure.message : 'Membership update failed. Review and try again.') }
    finally { setMembershipPending(false) }
  }
  return <div className="space-y-6 p-5 sm:p-8"><div className="space-y-3"><h1 className="text-3xl font-extrabold">Provision a school</h1><p className="max-w-3xl text-muted-foreground">Connect an existing active team organisation to a school and nominate an existing account with a verified email as its administrator. Fresh platform authentication is required.</p></div>
    <Card className="max-w-3xl space-y-5"><p>Use the IDs from the platform’s organisation and user records. This preserves those records and grants only school authority to the nominated account.</p><form aria-label="Provision school" onSubmit={submit} className="space-y-4" aria-busy={pending}><Input label="Organisation ID" value={draft.organizationId} onChange={event => update('organizationId', event.target.value)} required disabled={pending} maxLength={36} /><Input label="Verified administrator account ID" value={draft.adminUserId} onChange={event => update('adminUserId', event.target.value)} required disabled={pending} maxLength={36} /><Input label="School name" value={draft.name} onChange={event => update('name', event.target.value)} required disabled={pending} maxLength={120} /><Button type="submit" loading={pending} disabled={!!result}>Provision school</Button></form>{error && <p role="alert" tabIndex={-1} ref={errorRef} className="rounded-xl border border-destructive p-4">{error}</p>}{result && <div role="status" className="space-y-3 rounded-xl border p-4"><p className="font-bold">{result.name} is provisioned.</p><p className="break-all">School ID: {result.id}</p><p>The nominated administrator can now choose this school in their verified workspace list.</p></div>}<div className="flex flex-wrap gap-4"><Link href="/admin/orgs" className="ds-button ds-button-secondary">Organisation records</Link><Link href="/admin/users" className="ds-button ds-button-secondary">User records</Link></div></Card>
    <Card className="max-w-3xl space-y-5"><h2 className="text-xl font-bold">School administrator membership</h2><p>Additional school administrators and changes to their membership require platform approval. These actions never grant a platform role.</p><Input label="Managed school ID" value={membership.schoolId} onChange={event => setMembership(old => ({ ...old, schoolId: event.target.value }))} disabled={membershipPending} maxLength={36} /><form onSubmit={event => void manage(event, true)} className="space-y-4"><Input label="Additional verified administrator account ID" value={membership.userId} onChange={event => setMembership(old => ({ ...old, userId: event.target.value }))} required disabled={membershipPending} maxLength={36} /><Button type="submit" variant="secondary" loading={membershipPending}>Grant school administrator</Button></form><form onSubmit={event => void manage(event, false)} className="space-y-4 border-t pt-5"><Input label="Managed membership ID" value={membership.membershipId} onChange={event => setMembership(old => ({ ...old, membershipId: event.target.value }))} required disabled={membershipPending} maxLength={36} /><Select label="Membership status" value={membership.status} disabled={membershipPending} onChange={event => setMembership(old => ({ ...old, status: event.target.value }))}><option value="SUSPENDED">Suspended</option><option value="ARCHIVED">Archived</option><option value="TRANSFERRED">Transferred</option><option value="ACTIVE">Active</option></Select><Button type="submit" variant="secondary" loading={membershipPending}>Update school membership</Button></form>{membershipError && <p role="alert" className="rounded-xl border border-destructive p-4">{membershipError}</p>}{membershipMessage && <p role="status" className="break-words rounded-xl border p-4">{membershipMessage}</p>}</Card>
  </div>
}
