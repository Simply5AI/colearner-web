export default function EnrolledPlansLoading() {
  return (
    <div className="p-7">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-48 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    </div>
  )
}