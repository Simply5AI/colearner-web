'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { getDisplaySubjects } from '@/lib/constants/subjects'
import { useCreateRoadmap } from '@/lib/hooks/use-roadmap'
import { useProfile } from '@/lib/hooks/use-profile'
import { useSubjects } from '@/lib/hooks/use-onboarding'
import { cn } from '@/lib/utils'
import type { GradeLevel, RoadmapMode } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSubjectId?: string | null
}

type StudentPlanHelpMode = 'FULL_SUBJECT' | 'TEST_PREP' | 'SYLLABUS'

function formatGradeLevel(gradeLevel?: GradeLevel | null) {
  if (!gradeLevel) return null
  if (gradeLevel.startsWith('CLASS_')) {
    return `Class ${gradeLevel.replace('CLASS_', '')}`
  }
  return gradeLevel
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function CreateRoadmapModal({ open, onOpenChange, initialSubjectId }: Props) {
  const router = useRouter()
  const createRoadmap = useCreateRoadmap()
  const { data: profile } = useProfile()
  const { data: subjects = [] } = useSubjects()

  const [step, setStep] = useState<1 | 2>(1)
  const [mode, setMode] = useState<RoadmapMode>('TOPIC')
  const [studentHelpMode, setStudentHelpMode] = useState<StudentPlanHelpMode>('FULL_SUBJECT')
  const [topic, setTopic] = useState('')
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? '')
  const [phases, setPhases] = useState('3')
  const [syllabusText, setSyllabusText] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examTopics, setExamTopics] = useState('')
  const isStudent = profile?.learnerType === 'STUDENT'
  const displaySubjects = getDisplaySubjects(subjects)
  const selectedSubject = displaySubjects.find((subject) => subject.id === subjectId)
  const gradeLabel = formatGradeLevel(profile?.gradeLevel)
  const planTypes: Array<{ value: RoadmapMode; label: string; description: string }> = [
    { value: 'TOPIC', label: 'Topic', description: 'Learn a skill or concept' },
    { value: 'SYLLABUS', label: 'Course', description: 'Turn a course outline into a plan' },
    { value: 'EXAM_PREP', label: 'Certification', description: 'Prepare for an assessment' },
  ]
  const studentHelpOptions: Array<{ value: StudentPlanHelpMode; label: string; description: string }> = [
    { value: 'FULL_SUBJECT', label: 'Full subject plan', description: 'Build a plan from this subject' },
    { value: 'TEST_PREP', label: 'Prepare for a test', description: 'Focus on exam revision and practice' },
    { value: 'SYLLABUS', label: 'Use syllabus or chapters', description: 'Paste the topics your teacher gave you' },
  ]

  useEffect(() => {
    if (open) {
      setStep(1)
      setStudentHelpMode('FULL_SUBJECT')
      setSubjectId(initialSubjectId ?? '')
    }
  }, [initialSubjectId, open])

  const handleSubmit = async () => {
    const subjectExistsInApi = subjects.some((subject) => subject.id === subjectId)
    const studentMode: RoadmapMode =
      studentHelpMode === 'SYLLABUS'
        ? 'SYLLABUS'
        : studentHelpMode === 'TEST_PREP'
        ? 'EXAM_PREP'
        : 'TOPIC'
    const effectiveMode = isStudent ? studentMode : mode
    const topicFromProfile =
      isStudent
        ? [gradeLabel, selectedSubject?.name ?? 'Syllabus'].filter(Boolean).join(' ')
        : topic.trim()
    const normalizedTopic = selectedSubject && !subjectExistsInApi
      ? `${selectedSubject.name}: ${topicFromProfile}`
      : topicFromProfile
    const phaseCount = Math.min(Math.max(parseInt(phases, 10) || 3, 1), 8)

    const input = {
      mode: effectiveMode,
      topic: normalizedTopic,
      phases: isStudent ? 4 : phaseCount,
      ...(subjectId && subjectExistsInApi ? { subjectId } : {}),
      ...(effectiveMode === 'SYLLABUS' && syllabusText ? { syllabusText } : {}),
      ...(effectiveMode === 'EXAM_PREP' && examDate ? { examDate } : {}),
      ...(effectiveMode === 'EXAM_PREP' && examTopics
        ? { examTopics: examTopics.split(',').map((t) => t.trim()).filter(Boolean) }
        : {}),
    }

    const result = await createRoadmap.mutateAsync(input)
    onOpenChange(false)
    router.push(`/roadmaps/${result.roadmap.id}`)
  }

  const studentNeedsDetail = studentHelpMode === 'SYLLABUS' || studentHelpMode === 'TEST_PREP'
  const canContinue = isStudent ? Boolean(subjectId) : topic.trim().length > 0
  const canSubmit = canContinue && !createRoadmap.isPending
  const topicLabel = isStudent
    ? mode === 'SYLLABUS'
      ? ''
      : mode === 'EXAM_PREP'
      ? 'Exam or subject focus'
      : 'What are you studying?'
    : mode === 'SYLLABUS'
    ? 'Course Name'
    : mode === 'EXAM_PREP'
    ? 'Subject'
    : 'What do you want to learn?'
  const topicPlaceholder = isStudent
    ? mode === 'SYLLABUS'
      ? 'e.g., Grade 10 Biology'
      : mode === 'EXAM_PREP'
      ? 'e.g., Algebra final exam'
      : 'e.g., Photosynthesis, Linear equations'
    : mode === 'SYLLABUS'
    ? 'e.g., CS101 Introduction to Computer Science'
    : mode === 'EXAM_PREP'
    ? 'e.g., Data Structures and Algorithms'
    : 'e.g., I want to learn REST APIs'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Study Plan</DialogTitle>
          <DialogDescription>
            {isStudent
              ? 'Choose a subject, then Colearner will build a simple plan and help you add captures.'
              : `Step ${step} of 2. AI will generate a practical path, then you choose which sources to capture.`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="mt-4 space-y-4">
            {isStudent && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label>Choose subject</Label>
                  {subjectId && (
                    <button
                      type="button"
                      onClick={() => setSubjectId('')}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {displaySubjects.map((subject) => {
                    const isSelected = subjectId === subject.id
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => setSubjectId(isSelected ? '' : subject.id)}
                        className={cn(
                          'flex min-h-12 items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                          isSelected
                            ? 'border-brand-orange bg-brand-orange/5'
                            : 'border-border hover:border-brand-orange/40',
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="pointer-events-none border-brand-orange data-checked:bg-brand-orange"
                        />
                        <span className="min-w-0 text-sm font-medium">{subject.name}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {gradeLabel ? `${gradeLabel} is already saved in your profile. ` : ''}
                  Your captures and practice will stay organized under this subject.
                </p>
              </div>
            )}

            {isStudent ? (
              <div>
                <Label>What do you want help with?</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {studentHelpOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStudentHelpMode(option.value)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        studentHelpMode === option.value
                          ? 'border-brand-orange bg-brand-orange/5'
                          : 'border-border hover:border-brand-orange/40',
                      )}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label>Plan type</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {planTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setMode(type.value)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          mode === type.value
                            ? 'border-brand-orange bg-brand-orange/5'
                            : 'border-border hover:border-brand-orange/40',
                        )}
                      >
                        <span className="block text-sm font-semibold">{type.label}</span>
                        <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                          {type.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="topic">{topicLabel}</Label>
                  <Input
                    id="topic"
                    placeholder={topicPlaceholder}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">

            {!isStudent && (
              <div>
              <Label htmlFor="phases">Number of phases</Label>
              <Input
                id="phases"
                type="number"
                min={1}
                max={8}
                value={phases}
                onChange={(e) => setPhases(e.target.value)}
                className="mt-1"
              />
              </div>
            )}

            {(!isStudent && mode === 'SYLLABUS') || (isStudent && studentHelpMode === 'SYLLABUS') ? (
              <div>
                <Label htmlFor="syllabus">{isStudent ? 'Paste syllabus or chapter list' : 'Paste your syllabus'}</Label>
                <Textarea
                  id="syllabus"
                  placeholder={isStudent ? 'e.g., Motion, Force and Laws of Motion, Gravitation...' : 'Paste your course syllabus or topic list here...'}
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  className="mt-1 min-h-[120px]"
                />
              </div>
            ) : null}

            {(!isStudent && mode === 'EXAM_PREP') || (isStudent && studentHelpMode === 'TEST_PREP') ? (
              <>
              <div>
                <Label htmlFor="examDate">{isStudent ? 'Test date' : 'Exam Date'}</Label>
                <Input
                  id="examDate"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="examTopics">{isStudent ? 'Chapters or topics to revise' : 'Key Topics (comma-separated)'}</Label>
                <Input
                  id="examTopics"
                  placeholder={isStudent ? 'e.g., acids and bases, metals, light' : 'e.g., trees, graphs, sorting, dynamic programming'}
                  value={examTopics}
                  onChange={(e) => setExamTopics(e.target.value)}
                  className="mt-1"
                />
              </div>
              </>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (isStudent && !studentNeedsDetail) {
                    void handleSubmit()
                  } else {
                    setStep(2)
                  }
                }}
                disabled={!canContinue || createRoadmap.isPending}
              >
                {isStudent && !studentNeedsDetail && createRoadmap.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isStudent && !studentNeedsDetail ? 'Generate Study Plan' : 'Continue'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {createRoadmap.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Study Plan
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
