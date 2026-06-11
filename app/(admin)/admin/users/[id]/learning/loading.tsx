export default function AdminLearningLoading() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="mb-5 rounded-xl border bg-card p-4">
        <div className="h-14 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-4 flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    </div>
  )
}
