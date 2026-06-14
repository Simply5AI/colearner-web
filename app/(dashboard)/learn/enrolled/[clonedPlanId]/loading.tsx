export default function EnrolledPlanLoading() {
  return (
    <div className="space-y-6 p-7">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-96 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    </div>
  )
}