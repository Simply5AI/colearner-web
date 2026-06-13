import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getBillingOverview, getBillingRecentTransactions } from '@/lib/api/admin'
import { AdminBillingOverviewView } from '@/components/admin/admin-billing-overview-view'

export const metadata: Metadata = {
  title: 'Billing — Admin',
}

export default async function AdminBillingPage() {
  const headers = await getAdminHeaders()
  const [overview, transactions] = await Promise.all([
    getBillingOverview(headers),
    getBillingRecentTransactions(headers, 20),
  ])
  return <AdminBillingOverviewView overview={overview} transactions={transactions} />
}