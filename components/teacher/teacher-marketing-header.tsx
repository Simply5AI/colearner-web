import Link from 'next/link'

export function TeacherMarketingHeader() {
  return (
    <div className="border-b border-border/50 bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-orange to-brand-orange-hover">
            <span className="text-[10px] font-black text-white">CL</span>
          </div>
          <span className="text-sm font-extrabold tracking-tight">
            Co<span className="text-brand-orange">Learner</span>
          </span>
        </Link>
        <Link
          href="/login?callbackUrl=/teacher/dashboard"
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-brand-orange"
        >
          Teacher sign in
        </Link>
      </div>
    </div>
  )
}