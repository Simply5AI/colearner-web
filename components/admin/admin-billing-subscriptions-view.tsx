'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  cancelAdminSubscription,
  changeAdminSubscriptionPlan,
  getAdminSubscription,
  getAdminSubscriptions,
  reactivateAdminSubscription,
  refundAdminSubscriptionTransaction,
  type AdminBillingCycle,
  type AdminSubscriptionDetail,
  type AdminSubscriptionListRow,
  type AdminSubscriptionPlan,
  type AdminSubscriptionsQuery,
  type AdminSubscriptionsResponse,
  type AdminSubscriptionStatus,
  type BillingTransactionRow,
} from '@/lib/api/admin'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'

const ALL = 'all'
const PLANS: AdminSubscriptionPlan[] = ['FREE', 'PRO', 'ENTERPRISE']
const STATUSES: AdminSubscriptionStatus[] = ['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'INCOMPLETE']
const CYCLES: AdminBillingCycle[] = ['MONTHLY', 'YEARLY']

interface AdminBillingSubscriptionsViewProps {
  data: AdminSubscriptionsResponse
  query: AdminSubscriptionsQuery
}

export function AdminBillingSubscriptionsView({ data: initial, query: initialQuery }: AdminBillingSubscriptionsViewProps) {
  const router = useRouter()
  const { runSensitive } = useAdminMutation()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState(initial.items)
  const [total, setTotal] = useState(initial.total)
  const [nextCursor, setNextCursor] = useState(initial.nextCursor)
  const [search, setSearch] = useState(initialQuery.search ?? '')
  const [plan, setPlan] = useState(initialQuery.plan ?? ALL)
  const [status, setStatus] = useState(initialQuery.status ?? ALL)
  const [cycle, setCycle] = useState(initialQuery.cycle ?? ALL)
  const [detail, setDetail] = useState<AdminSubscriptionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [refundTx, setRefundTx] = useState<BillingTransactionRow | null>(null)
  const [changePlan, setChangePlan] = useState<AdminSubscriptionPlan>('PRO')
  const [changeCycle, setChangeCycle] = useState<AdminBillingCycle>('MONTHLY')
  const [changeEffective, setChangeEffective] = useState<'immediate' | 'end_of_cycle'>('end_of_cycle')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelImmediate, setCancelImmediate] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [busy, setBusy] = useState(false)

  const buildQuery = useCallback(
    (cursor?: string): AdminSubscriptionsQuery => ({
      search: search.trim() || undefined,
      plan: plan === ALL ? undefined : (plan as AdminSubscriptionPlan),
      status: status === ALL ? undefined : (status as AdminSubscriptionStatus),
      cycle: cycle === ALL ? undefined : (cycle as AdminBillingCycle),
      cursor,
      limit: 25,
    }),
    [search, plan, status, cycle],
  )

  const reloadList = useCallback(async () => {
    try {
      const result = await getAdminSubscriptions({}, buildQuery())
      setRows(result.items)
      setTotal(result.total)
      setNextCursor(result.nextCursor)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load subscriptions')
    }
  }, [buildQuery])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (plan !== ALL) params.set('plan', plan)
    if (status !== ALL) params.set('status', status)
    if (cycle !== ALL) params.set('cycle', cycle)
    const qs = params.toString()
    router.replace(qs ? `/admin/billing/subscriptions?${qs}` : '/admin/billing/subscriptions')
    void reloadList()
  }, [search, plan, status, cycle, router, reloadList])

  const openDetail = async (row: AdminSubscriptionListRow) => {
    setDetailLoading(true)
    try {
      const next = await getAdminSubscription({}, row.id)
      setDetail(next)
      setChangePlan(next.plan)
      setChangeCycle(next.billingCycle ?? 'MONTHLY')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load subscription')
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshDetail = async () => {
    if (!detail) return
    const next = await getAdminSubscription({}, detail.id)
    setDetail(next)
    await reloadList()
  }

  const submitChangePlan = async () => {
    if (!detail) return
    setBusy(true)
    try {
      await runSensitive(() =>
        changeAdminSubscriptionPlan(detail.id, {
          plan: changePlan,
          cycle: changeCycle,
          effective: changeEffective,
          updatedAt: detail.updatedAt,
        }),
      )
      toast.success('Plan change submitted')
      setChangeOpen(false)
      await refreshDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Plan change failed')
    } finally {
      setBusy(false)
    }
  }

  const submitCancel = async () => {
    if (!detail || !cancelReason.trim()) {
      toast.error('A cancellation reason is required')
      return
    }
    setBusy(true)
    try {
      await runSensitive(() =>
        cancelAdminSubscription(detail.id, {
          reason: cancelReason.trim(),
          immediate: cancelImmediate,
          updatedAt: detail.updatedAt,
        }),
      )
      toast.success('Subscription canceled')
      setCancelOpen(false)
      setCancelReason('')
      await refreshDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const submitReactivate = async () => {
    if (!detail) return
    setBusy(true)
    try {
      await runSensitive(() => reactivateAdminSubscription(detail.id))
      toast.success('Subscription reactivated')
      await refreshDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reactivate failed')
    } finally {
      setBusy(false)
    }
  }

  const submitRefund = async () => {
    if (!detail || !refundTx) return
    const amount = Number(refundAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid refund amount')
      return
    }
    if (!refundReason.trim()) {
      toast.error('A refund reason is required')
      return
    }
    setBusy(true)
    try {
      const result = await runSensitive(() =>
        refundAdminSubscriptionTransaction(detail.id, refundTx.id, {
          amount,
          reason: refundReason.trim(),
        }),
      )
      toast.success(`Refund ${result.status}`)
      setRefundTx(null)
      setRefundReason('')
      await refreshDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refund failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-4">
        <Link href="/admin/billing" className="text-sm font-medium text-primary hover:underline">
          ← Billing overview
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Subscriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} subscriptions</p>
        </div>
        <Button
          variant="outline"
          onClick={() => startTransition(() => void reloadList())}
          disabled={isPending}
        >
          <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card className="my-0 mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1">
            <Label htmlFor="sub-search">Search org</Label>
            <div className="relative mt-1.5">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sub-search"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Org name or slug"
              />
            </div>
          </div>
          <FilterSelect label="Plan" value={plan} onChange={setPlan} options={[{ value: ALL, label: 'All plans' }, ...PLANS.map((p) => ({ value: p, label: formatPlan(p) }))]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: ALL, label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: formatEnum(s) }))]} />
          <FilterSelect label="Cycle" value={cycle} onChange={setCycle} options={[{ value: ALL, label: 'All cycles' }, ...CYCLES.map((c) => ({ value: c, label: formatEnum(c) }))]} />
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setPlan(ALL)
              setStatus(ALL)
              setCycle(ALL)
            }}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </CardContent>
      </Card>

      <Card className="my-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Org</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Cycle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Renews</th>
                  <th className="px-4 py-3">MRR</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No subscriptions match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <button type="button" className="text-left hover:text-primary" onClick={() => void openDetail(row)}>
                          <p className="font-semibold">{row.orgName}</p>
                          <p className="text-xs text-muted-foreground">{row.orgSlug}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3"><Badge variant="secondary">{formatPlan(row.plan)}</Badge></td>
                      <td className="px-4 py-3">{row.billingCycle ? formatEnum(row.billingCycle) : '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(row.startedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.renewsAt ? formatDate(row.renewsAt) : '—'}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{formatCurrency(row.mrr)}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.orgName}`} />}>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void openDetail(row)}>View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openDetail(row).then(() => setChangeOpen(true))}>
                              Change plan
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openDetail(row).then(() => setCancelOpen(true))}>
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {nextCursor ? (
            <div className="border-t p-3 text-center">
              <Button
                variant="outline"
                onClick={async () => {
                  const result = await getAdminSubscriptions({}, buildQuery(nextCursor))
                  setRows((current) => [...current, ...result.items])
                  setNextCursor(result.nextCursor)
                }}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle>{detail.orgName}</SheetTitle>
                <SheetDescription>
                  {formatPlan(detail.plan)} · <StatusBadge status={detail.status} />
                </SheetDescription>
              </SheetHeader>

              <SheetBody>
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-3 pt-3">
                  <Field label="Billing email" value={detail.billingEmail ?? '—'} />
                  <Field label="Owner" value={detail.owner ? `${detail.owner.name} (${detail.owner.email})` : '—'} />
                  <Field
                    label="Payment method"
                    value={
                      detail.paymentMethodLast4
                        ? `${detail.paymentMethodBrand ?? 'Card'} ·••• ${detail.paymentMethodLast4}`
                        : '—'
                    }
                  />
                  <Field label="Renews at" value={detail.renewsAt ? formatDate(detail.renewsAt) : '—'} />
                  <Field
                    label="Next invoice estimate"
                    value={
                      detail.nextInvoiceEstimateUsd !== null
                        ? formatCurrency(detail.nextInvoiceEstimateUsd)
                        : '—'
                    }
                  />
                  <Field label="MRR" value={formatCurrency(detail.mrr)} />
                </TabsContent>
                <TabsContent value="transactions" className="pt-3">
                  <div className="space-y-2">
                    {detail.transactions.map((tx) => (
                      <div key={tx.id} className="rounded-lg border border-border/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold tabular-nums">{formatCurrency(tx.amountUsd)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.createdAt)} · {tx.status}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!tx.refundable || busy}
                            onClick={() => {
                              setRefundTx(tx)
                              setRefundAmount(String(tx.amountUsd - tx.refundedAmountUsd))
                            }}
                          >
                            Refund
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
              </SheetBody>

              <SheetFooter className="flex-wrap gap-2 sm:justify-start">
                <Button size="sm" onClick={() => setChangeOpen(true)} disabled={detail.status === 'PAST_DUE'}>
                  Change plan
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
                  Cancel
                </Button>
                {(detail.cancelAtPeriodEnd || detail.status === 'CANCELED') && (
                  <Button size="sm" variant="secondary" onClick={() => void submitReactivate()} disabled={busy}>
                    Reactivate
                  </Button>
                )}
              </SheetFooter>
            </>
          ) : detailLoading ? (
            <SheetBody>
              <p className="text-sm text-muted-foreground">Loading subscription…</p>
            </SheetBody>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>Updates Stripe when configured. Requires re-auth.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Plan</Label>
              <Select value={changePlan} onValueChange={(v) => setChangePlan(v as AdminSubscriptionPlan)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.filter((p) => p !== 'FREE').map((p) => (
                    <SelectItem key={p} value={p}>{formatPlan(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cycle</Label>
              <Select value={changeCycle} onValueChange={(v) => setChangeCycle(v as AdminBillingCycle)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>{formatEnum(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Effective</Label>
              <Select value={changeEffective} onValueChange={(v) => setChangeEffective(v as 'immediate' | 'end_of_cycle')}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="end_of_cycle">End of cycle</SelectItem>
                  <SelectItem value="immediate">Immediate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitChangePlan()} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription</DialogTitle>
            <DialogDescription>Provide a reason. Immediate cancel revokes access now.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label htmlFor="cancel-reason">Reason</Label>
              <Textarea id="cancel-reason" className="mt-1.5" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cancelImmediate} onChange={(e) => setCancelImmediate(e.target.checked)} />
              Cancel immediately
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button variant="destructive" onClick={() => void submitCancel()} disabled={busy}>Cancel subscription</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundTx} onOpenChange={(open) => !open && setRefundTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund transaction</DialogTitle>
            <DialogDescription>Partial refunds are supported when Stripe is configured.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label htmlFor="refund-amount">Amount (USD)</Label>
              <Input id="refund-amount" className="mt-1.5" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="refund-reason">Reason</Label>
              <Textarea id="refund-reason" className="mt-1.5" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTx(null)}>Cancel</Button>
            <Button onClick={() => void submitRefund()} disabled={busy}>Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="min-w-40">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next ?? ALL)}>
        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: AdminSubscriptionStatus }) {
  const variant =
    status === 'ACTIVE' || status === 'TRIALING'
      ? 'secondary'
      : status === 'PAST_DUE'
        ? 'outline'
        : 'outline'
  return <Badge variant={variant}>{formatEnum(status)}</Badge>
}

function formatPlan(plan: string) {
  return plan.charAt(0) + plan.slice(1).toLowerCase()
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatDate(value: string) {
  return format(new Date(value), 'MMM d, yyyy')
}