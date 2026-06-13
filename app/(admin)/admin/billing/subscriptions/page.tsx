import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import {
  getAdminSubscriptions,
  type AdminBillingCycle,
  type AdminSubscriptionPlan,
  type AdminSubscriptionStatus,
  type AdminSubscriptionsQuery,
} from '@/lib/api/admin'
import { AdminBillingSubscriptionsView } from '@/components/admin/admin-billing-subscriptions-view'

export const metadata: Metadata = {
  title: 'Subscriptions — Admin Billing',
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PLANS: AdminSubscriptionPlan[] = ['FREE', 'PRO', 'ENTERPRISE']
const STATUSES: AdminSubscriptionStatus[] = ['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'INCOMPLETE']
const CYCLES: AdminBillingCycle[] = ['MONTHLY', 'YEARLY']

function parseQuery(searchParams: Record<string, string | string[] | undefined>): AdminSubscriptionsQuery {
  const pick = (key: string) => {
    const value = searchParams[key]
    return typeof value === 'string' ? value : undefined
  }

  const plan = pick('plan')
  const status = pick('status')
  const cycle = pick('cycle')

  return {
    search: pick('search'),
    plan: PLANS.includes(plan as AdminSubscriptionPlan) ? (plan as AdminSubscriptionPlan) : undefined,
    status: STATUSES.includes(status as AdminSubscriptionStatus)
      ? (status as AdminSubscriptionStatus)
      : undefined,
    cycle: CYCLES.includes(cycle as AdminBillingCycle) ? (cycle as AdminBillingCycle) : undefined,
    limit: 25,
  }
}

export default async function AdminBillingSubscriptionsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = parseQuery(params)
  const headers = await getAdminHeaders()
  const data = await getAdminSubscriptions(headers, query)
  return <AdminBillingSubscriptionsView data={data} query={query} />
}