import { Scissors } from 'lucide-react'
import type { Material } from '@/lib/api/materials'

/** Honest scope: shown when only the first part of a longer source was imported, with the server's short reason. */
export function MaterialPartialNotice({ material }: { material: Pick<Material, 'partial' | 'partialReason'> }) {
  if (!material.partial) return null
  return <p role="note" data-testid="material-partial" className="flex min-w-0 items-start gap-2 rounded-xl border border-border bg-muted p-3 text-sm"><Scissors size={16} aria-hidden="true" className="mt-0.5 shrink-0" /><span><strong>Only the first part of this was imported.</strong> {material.partialReason ?? 'This source is longer than CoLearner can read at once.'} Key ideas and answers come from that first part.</span></p>
}

/** A small "Partial" tag for library cards. */
export function PartialTag({ material }: { material: Pick<Material, 'partial'> }) {
  return material.partial ? <span data-testid="partial-tag" title="Only the first part of this source was imported" className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold">Partial</span> : null
}
