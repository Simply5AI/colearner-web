import Link from 'next/link'
import { ApiError } from '@/lib/api/client'
import { TeacherPage } from '@/components/teacher/teacher-page'

function LegacyLater({ title }: { title: string }) {
  return (
    <TeacherPage title={title} subtitle="Arrives with a later release for school teachers.">
      <div data-testid="legacy-teacher-later" className="rounded-lg border border-dashed border-border/70 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This view is not available for school teacher accounts yet. Your classes, plans, lessons and assignments are in Classes &amp; plans.
        </p>
        <Link href="/teacher/plans" className="ds-button ds-button-secondary mt-4 inline-flex">Go to classes &amp; plans</Link>
      </div>
    </TeacherPage>
  )
}

/**
 * Legacy teacher pages call org-wide endpoints behind legacy RBAC. When the platform answers 403 (a school teacher without those
 * grants, reaching the URL from a bookmark) the page shows a truthful "later release" state instead of a generic failure.
 */
export function withLegacyGuard<P>(title: string, Page: (props: P) => Promise<React.ReactNode>) {
  return async function GuardedLegacyPage(props: P) {
    try { return await Page(props) } catch (error) {
      if (error instanceof ApiError && error.status === 403) return <LegacyLater title={title} />
      throw error
    }
  }
}
