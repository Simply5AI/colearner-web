import type { Metadata } from 'next'

import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminUsers, type AdminUsersQuery } from '@/lib/api/admin'
import { AdminLearningPickerView } from '@/components/admin/admin-learning-picker-view'

export const metadata: Metadata = {
  title: 'Learning',
  description: 'Pick a learner to inspect mastery, sessions, and roadmaps.',
}

type AdminLearningPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PAGE_SIZES = [25, 50, 100]

export default async function AdminLearningPage({ searchParams }: AdminLearningPageProps) {
  const [params, headers] = await Promise.all([searchParams, getAdminHeaders()])
  const query = normalizeQuery(params)
  const data = await getAdminUsers(headers, query)

  return <AdminLearningPickerView data={data} query={query} />
}

function normalizeQuery(params: Record<string, string | string[] | undefined>): AdminUsersQuery {
  const search = first(params.search)
  const cursor = first(params.cursor)
  const limit = Number(first(params.limit))

  return {
    search: search || undefined,
    cursor: cursor || undefined,
    limit: PAGE_SIZES.includes(limit) ? limit : 25,
    sort: 'last_active_desc',
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}