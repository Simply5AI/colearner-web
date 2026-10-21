'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card } from '@/components/design-system'
import { lessonDisabledReason, materialApi } from '@/lib/api/materials'
import { MaterialFrame, MaterialLoadState, MaterialProgress, materialKeys, useMaterialConfig } from './material-common'

export function MaterialReader({ id }: { id: string }) {
  const config = useMaterialConfig()
  const detail = useQuery({ queryKey: materialKeys.detail(config.actor, id), queryFn: () => materialApi.detail(id), enabled: !!config.data && !config.isError, retry: false, staleTime: 0, gcTime: 0 })
  return <MaterialFrame title={detail.data?.title ?? 'Read your material'} description="The original source and validated key ideas are shown separately. School and learner permissions are checked again when you open this page." config={config.data}>
    <MaterialLoadState loading={config.isPending || (!!config.data && detail.isPending)} error={config.error ?? detail.error} retry={() => { void config.refetch(); void detail.refetch() }} />
    {!config.error && !detail.error && detail.data && <><MaterialProgress material={detail.data} /><Card className="space-y-4 p-5"><h2 className="text-xl font-bold">Original source</h2>{detail.data.source ? <><p className="text-xs text-muted-foreground">Source version: {detail.data.sourceVersionRef} · {detail.data.source.anchors.length} source anchors</p><div className="max-w-prose whitespace-pre-wrap break-words leading-relaxed">{detail.data.source.text}</div></> : <p>The source is not ready to read. Return to processing for its current status.</p>}</Card>{detail.data.links.lesson ? <div className="flex flex-wrap items-center gap-3"><Link href={detail.data.links.lesson} className="ds-button ds-button-primary">Start lesson</Link><p className="text-sm text-muted-foreground">Co makes a short five-step lesson from this material.</p></div> : <p className="text-sm text-muted-foreground" data-testid="lesson-unavailable">{lessonDisabledReason(detail.data) ?? 'This reader does not create a lesson or practice activity. Those controls open only when their validated artifacts are available.'}</p>}</>}
  </MaterialFrame>
}
