'use client'

import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProfile } from '@/lib/hooks/use-profile'
import { useCaptureStore } from '@/lib/stores/capture-store'

const NONE_VALUE = '__none__'

export function SubjectCapturePicker() {
  const { data: profile } = useProfile()
  const selectedSubjectId = useCaptureStore((s) => s.selectedSubjectId)
  const setSelectedSubjectId = useCaptureStore((s) => s.setSelectedSubjectId)

  if (profile?.learnerType !== 'STUDENT') return null

  const activeSubjects = profile.subjects ?? []
  const current = selectedSubjectId ?? NONE_VALUE
  const selectedSubject = activeSubjects.find((subject) => subject.id === selectedSubjectId)

  function onChange(value: string | null) {
    setSelectedSubjectId(!value || value === NONE_VALUE ? null : value)
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
        <BookOpen className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {selectedSubject ? `Capturing for ${selectedSubject.name}` : 'All Captures'}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          {selectedSubject
            ? 'New captures will be tagged to this subject automatically.'
            : 'Choose a subject to keep this organized, or save to All Captures.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={current} onValueChange={onChange}>
            <SelectTrigger className="h-8 w-full max-w-xs text-xs">
              <SelectValue placeholder="All Captures">
                {selectedSubject?.name ?? activeSubjects.find((s) => s.id === current)?.name ?? 'All Captures'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>All Captures</SelectItem>
              {activeSubjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/roadmaps" className="text-xs font-semibold text-brand-orange hover:underline">
            Add subject
          </Link>
        </div>
      </div>
    </div>
  )
}
