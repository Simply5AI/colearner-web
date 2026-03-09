import { cn } from '@/lib/utils'

interface StepProgressProps {
  currentStep: number
  totalSteps: number
}

export function StepProgress({ currentStep, totalSteps }: StepProgressProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-full transition-all duration-300',
            i + 1 === currentStep ? 'w-14 bg-brand-orange' : 'w-10',
            i + 1 < currentStep && 'bg-brand-orange',
            i + 1 > currentStep && 'bg-border'
          )}
        />
      ))}
    </div>
  )
}
