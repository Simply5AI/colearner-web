'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useRegenerateSuggestions } from '@/lib/hooks/use-profile'

export function RegenerateButton() {
  const mutation = useRegenerateSuggestions()

  const handleRegenerate = async () => {
    try {
      await mutation.mutateAsync()
      toast.success('Suggestions regenerated! Check your goals for new recommendations.')
    } catch {
      toast.error('Failed to regenerate suggestions')
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleRegenerate}
      disabled={mutation.isPending}
      className="gap-2"
    >
      {mutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {mutation.isPending ? 'Regenerating...' : 'Regenerate Suggestions'}
    </Button>
  )
}
