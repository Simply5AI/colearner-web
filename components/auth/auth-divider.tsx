import { Separator } from '@/components/ui/separator'

export function AuthDivider() {
  return (
    <div className="relative flex items-center gap-4">
      <Separator className="flex-1" />
      <span className="text-sm font-semibold text-muted-foreground">
        or continue with email
      </span>
      <Separator className="flex-1" />
    </div>
  )
}
