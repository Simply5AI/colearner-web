'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StudyPlanOption {
  id: string
  title: string
}

interface StudyPlanFilterProps {
  plans: StudyPlanOption[]
}

const ALL_VALUE = '__all__'

export function StudyPlanFilter({ plans }: StudyPlanFilterProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const current = searchParams.get('roadmapId') || ALL_VALUE

  function onChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === ALL_VALUE) {
      params.delete('roadmapId')
    } else {
      params.set('roadmapId', value)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[200px] text-xs">
        <SelectValue placeholder="All study plans" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All study plans</SelectItem>
        {plans.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
