import { cn } from '@/lib/utils'

interface GoalCardProps {
  emoji: string
  name: string
  description: string
  isSelected: boolean
  onClick: () => void
}

export function GoalCard({ emoji, name, description, isSelected, onClick }: GoalCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center rounded-xl border-[1.5px] bg-background p-5 text-center transition-all duration-200',
        isSelected
          ? 'border-brand-orange bg-brand-orange/5 shadow-[0_0_0_3px_rgba(196,98,26,0.12)]'
          : 'border-border hover:-translate-y-0.5 hover:border-brand-orange/50 hover:shadow-sm'
      )}
    >
      <span className="mb-2 text-[32px]">{emoji}</span>
      <span className="text-[13px] font-bold text-foreground">{name}</span>
      <span className="mt-0.5 text-[10px] text-muted-foreground">{description}</span>
    </button>
  )
}
