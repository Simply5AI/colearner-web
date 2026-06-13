import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import {
  getAdminConcepts,
  getAdminQuestions,
  type AdminLibraryQuery,
  type AdminLibrarySort,
} from '@/lib/api/admin'
import { AdminContentLibraryView } from '@/components/admin/admin-content-library-view'

export const metadata: Metadata = { title: 'Content Library — Admin' }

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
type LibraryTab = 'concepts' | 'questions'

const SORTS = new Set<AdminLibrarySort>(['created_desc', 'created_asc', 'title_asc', 'title_desc'])

export default async function AdminContentLibraryPage({ searchParams }: PageProps) {
  const [params, headers] = await Promise.all([searchParams, getAdminHeaders()])
  const tab = first(params.tab) === 'questions' ? 'questions' : 'concepts'
  const query = normalizeQuery(params)
  const [concepts, questions] = await Promise.all([
    getAdminConcepts(headers, tab === 'concepts' ? query : { limit: 1 }),
    getAdminQuestions(headers, tab === 'questions' ? query : { limit: 1 }),
  ])
  return <AdminContentLibraryView tab={tab} concepts={concepts} questions={questions} query={query} />
}

function normalizeQuery(params: Record<string, string | string[] | undefined>): AdminLibraryQuery {
  const sort = first(params.sort)
  const flagged = first(params.flagged)
  const limit = Number(first(params.limit))
  return {
    search: first(params.search) || undefined,
    sourceId: first(params.sourceId) || undefined,
    orgId: first(params.orgId) || undefined,
    flagged: flagged === 'true' || flagged === 'false' ? flagged : undefined,
    sort: SORTS.has(sort as AdminLibrarySort) ? (sort as AdminLibrarySort) : 'created_desc',
    cursor: first(params.cursor) || undefined,
    limit: [25, 50, 100].includes(limit) ? limit : 25,
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}