import { Separator } from '@/components/ui/separator'

export function AuthDivider() {
  return (
    <div className="relative flex items-center gap-4">
      <Separator className="flex-1" />
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        or continue with email
      </span>
      <Separator className="flex-1" />
    </div>
  )
}
