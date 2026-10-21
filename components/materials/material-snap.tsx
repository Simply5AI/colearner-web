'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Input } from '@/components/design-system'
import { materialApi } from '@/lib/api/materials'
import { MaterialFrame, MaterialLoadState, MaterialSelectors, materialKeys, useMaterialConfig } from './material-common'
import { PageCamera } from './page-camera'

export function MaterialSnap() {
  const config = useMaterialConfig()
  const router = useRouter()
  const cache = useQueryClient()
  const key = useRef<string | null>(null)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [planId, setPlanId] = useState('')
  const submit = useMutation({ mutationFn: async (files: File[]) => {
    if (!title.trim() || !subjectId) throw new Error('Add a title and choose a subject before sending your pages.')
    const source = config.data?.sources.find(item => item.type === 'image')
    if (!config.data?.enabled || !source?.available) throw new Error(source?.reason ?? 'Photo processing is currently unavailable.')
    if (files.reduce((total, file) => total + file.size, 0) > config.data.limits.maxBytes) throw new Error('The combined pages exceed the configured school upload limit.')
    const idempotencyKey = key.current ?? crypto.randomUUID(); key.current = idempotencyKey
    return materialApi.import({ idempotencyKey, title: title.trim(), sourceType: 'image', subjectId, ...(planId ? { planId } : {}) }, files)
  }, retry: false, onSuccess: result => {
    void cache.invalidateQueries({ queryKey: materialKeys.root })
    const ids = result.items.map(item => item.id)
    if (ids.length) router.push(`/learn/import?material=${encodeURIComponent(ids[0]!)}&batch=${encodeURIComponent(ids.join(','))}`)
  } })
  const source = config.data?.sources.find(item => item.type === 'image')
  return <MaterialFrame title="Show Co your page" description="Capture book pages, notes or a worksheet. Review and order your photos before sending." config={config.data}>
    <MaterialLoadState loading={config.isPending} error={config.error} retry={() => void config.refetch()} />
    {config.data && !config.error && <><Card className="space-y-4 p-5"><Input label="Material title" value={title} maxLength={300} onChange={event => { setTitle(event.target.value); key.current = null }} /><MaterialSelectors config={config.data} subjectId={subjectId} planId={planId} setSubjectId={value => { setSubjectId(value); key.current = null }} setPlanId={value => { setPlanId(value); key.current = null }} /></Card><PageCamera band={config.data.band} maxPages={Math.min(config.data.limits.maxPages, config.data.limits.maxFiles)} maxBytes={config.data.limits.maxBytes} faceRedactionVerified={config.data.faceRedaction.verified} unavailableReason={!source?.available || !config.data.enabled ? source?.reason ?? 'Photo processing is unavailable.' : undefined} submitting={submit.isPending} onPagesChange={() => { key.current = null }} onSubmit={async files => { await submit.mutateAsync(files) }} /></>}
  </MaterialFrame>
}

