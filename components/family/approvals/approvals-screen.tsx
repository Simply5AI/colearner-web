'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { LoadingState, Select } from '@/components/design-system'
import { FamilyFrame } from '../family-common'
import type { ApprovalListState } from '@/lib/api/family-approvals'
import { ApprovalCard } from './approval-card'
import { outcomeNotice } from './approval-actions'
import { ApprovalsFailure, NothingInHistory, NothingPending } from './approvals-states'
import { useApprovalList, useApprovalSummary, type DecisionOutcome } from './use-approvals'

const tabs: { id: ApprovalListState; label: string }[] = [{ id: 'pending', label: 'Pending' }, { id: 'history', label: 'History' }]

export function ApprovalsScreen() {
  const [tab, setTab] = useState<ApprovalListState>('pending')
  const [child, setChild] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const list = useApprovalList(tab)
  const summary = useApprovalSummary()
  const children = useMemo(() => {
    const seen = new Map<string, string>()
    for (const item of list.data ?? []) seen.set(item.child.profileId, item.child.nickname)
    return [...seen]
  }, [list.data])
  const items = (list.data ?? []).filter(item => !child || item.child.profileId === child)
  const onOutcome = (outcome: DecisionOutcome) => setNotice(outcomeNotice(outcome))
  const pendingCount = summary.data?.pendingCount
  return <FamilyFrame title="Requests and approvals" description="Teachers and schools ask for your yes before your child can open an assigned plan. Review what they will see, then approve or decline. You can take an approval back at any time from History.">
    <nav aria-label="Family sections"><Link href="/family" className="ds-button ds-button-ghost">Back to your family</Link></nav>
    <div role="tablist" aria-label="Approvals" className="flex flex-wrap gap-3">
      {tabs.map(item => <button key={item.id} role="tab" type="button" id={`approvals-tab-${item.id}`} aria-selected={tab === item.id} aria-controls="approvals-panel" onClick={() => { setTab(item.id); setNotice(null) }} className={`ds-button ${tab === item.id ? 'ds-button-primary' : 'ds-button-secondary'}`}>
        {item.label}{item.id === 'pending' && typeof pendingCount === 'number' && pendingCount > 0 ? <span className="ms-2 rounded-full bg-background px-2 text-sm text-foreground" aria-label={`${pendingCount} waiting`}>{pendingCount}</span> : null}
      </button>)}
    </div>
    <div aria-live="polite">{notice && <p role="status" className="rounded-2xl bg-accent/40 p-4 break-words" data-testid="approval-notice">{notice}</p>}</div>
    <div id="approvals-panel" role="tabpanel" aria-labelledby={`approvals-tab-${tab}`} className="space-y-4">
      {children.length > 1 && <Select label="Show requests for" value={child} onChange={event => setChild(event.target.value)}><option value="">All children</option>{children.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>}
      {list.isPending ? <LoadingState label="Loading requests…" />
        : list.error ? <ApprovalsFailure error={list.error} retry={() => void list.refetch()} />
          : items.length === 0 ? (tab === 'pending' ? <NothingPending /> : <NothingInHistory />)
            : <ul className="space-y-4">{items.map(item => <li key={item.id}><ApprovalCard request={item} onOutcome={onOutcome} /></li>)}</ul>}
    </div>
  </FamilyFrame>
}
