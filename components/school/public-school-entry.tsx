import Link from 'next/link'
export function PublicSchoolEntry() {
  return (
    <div className="space-y-3">
      <h2 className="font-bold">School access</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            title: 'Student',
            detail:
              'Use your school account. Learner entry follows verified membership and consent.',
          },
          {
            title: 'Teacher',
            detail: 'Use the bound invitation from your school administrator.',
          },
          {
            title: 'School administrator',
            detail:
              'Use your provisioned school membership; this role cannot be self-selected.',
          },
          {
            title: 'Parent / guardian',
            detail:
              'School membership alone does not verify child relationships. Use a school-issued child invitation to verify your relationship and give consent.',
          },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border p-3">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/login?callbackUrl=/workspaces"
          className="ds-button ds-button-secondary"
        >
          Sign in for school workspaces
        </Link>
        <Link href="/profiles" className="ds-button ds-button-secondary">Shared-device profiles</Link>
        <Link href="/consent" className="ds-button ds-button-secondary">Guardian consent</Link>
        <Link href="/invite" className="ds-button ds-button-ghost">
          Accept an invitation
        </Link>
      </div>
    </div>
  )
}
