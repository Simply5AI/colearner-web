import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopicCardProps {
  emoji: string
  name: string
  isSelected: boolean
  onClick: () => void
}

export function TopicCard({ emoji, name, isSelected, onClick }: TopicCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center rounded-xl border-[1.5px] bg-background px-3 py-[18px] text-center transition-all duration-200',
        isSelected
          ? 'border-brand-orange bg-brand-orange/5'
          : 'border-border hover:-translate-y-0.5 hover:border-brand-orange/50 hover:shadow-sm'
      )}
    >
      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand-orange">
          <Check className="size-[10px] text-white" strokeWidth={2.5} />
        </div>
      )}
      <span className="mb-1.5 text-[30px]">{emoji}</span>
      <span className="text-[11px] font-bold text-foreground">{name}</span>
    </button>
  )
}
