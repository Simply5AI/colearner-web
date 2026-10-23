'use client'

import { useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button, Checkbox, Input } from '@/components/design-system'
import { useTeaching } from '@/components/teacher/teaching-context'
import { classifyTeachingError, TeachingApiError } from '@/lib/api/teaching/core'
import {
  requestPhotoUpload,
  saveProfileStep,
  validatePhoto,
  type TeacherOnboardingState,
} from '@/lib/api/teaching/onboarding'
import {
  PROFILE_LIMITS,
  profileToDraft,
  validateProfile,
  type ProfileDraft,
  type ProfileErrors,
} from '@/lib/api/teaching/profile'

const GRADES = Array.from({ length: 10 }, (_, index) => index + 1)

export function ProfileStep({
  state,
  onSaved,
  onRefresh,
}: {
  state: TeacherOnboardingState
  onSaved: (state: TeacherOnboardingState) => void
  /** Called on a revision conflict so the screen shows the newest server state. The local draft is kept. */
  onRefresh: () => void
}) {
  const { request } = useTeaching()
  // The draft lives here and survives every error; it is only initialised from the server once.
  const [draft, setDraft] = useState<ProfileDraft>(() => profileToDraft(state.profile))
  const [subjectInput, setSubjectInput] = useState('')
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [photoKey, setPhotoKey] = useState<string | null>(state.profile.photoStorageKey)
  const [photoName, setPhotoName] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bioId = useId()
  const subjectsErrorId = useId()
  const gradesErrorId = useId()

  const addSubject = () => {
    const value = subjectInput.trim()
    if (!value) return
    if (draft.subjects.some((subject) => subject.toLowerCase() === value.toLowerCase())) {
      setSubjectInput('')
      return
    }
    setDraft({ ...draft, subjects: [...draft.subjects, value.slice(0, PROFILE_LIMITS.subject)] })
    setSubjectInput('')
  }

  const toggleGrade = (grade: number) =>
    setDraft({
      ...draft,
      grades: draft.grades.includes(grade) ? draft.grades.filter((g) => g !== grade) : [...draft.grades, grade].sort((a, b) => a - b),
    })

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    const problem = validatePhoto(file)
    if (problem) return setPhotoError(problem)
    setPhotoBusy(true)
    try {
      const target = await requestPhotoUpload(request, file)
      const put = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) throw new Error('upload')
      setPhotoKey(target.storageKey)
      setPhotoName(file.name)
    } catch {
      setPhotoError('The photo could not be uploaded. You can continue without it, or try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Late subject typed but not added yet: take it rather than lose it.
    const pending = subjectInput.trim()
    const next = pending && !draft.subjects.some((s) => s.toLowerCase() === pending.toLowerCase()) ? { ...draft, subjects: [...draft.subjects, pending] } : draft
    if (next !== draft) {
      setDraft(next)
      setSubjectInput('')
    }
    const found = validateProfile(next)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setFailure(null)
    try {
      onSaved(await saveProfileStep(request, state, next, photoKey))
    } catch (error) {
      if (error instanceof TeachingApiError && (error.status === 409 || error.code === 'REVISION_CONFLICT')) {
        setFailure('Your setup changed somewhere else. Your answers below are kept; review and save again.')
        onRefresh()
      } else {
        setFailure(`${classifyTeachingError(error).message} Your answers are kept.`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5" data-testid="t8-profile-form">
      <Input
        label="Name students will see"
        value={draft.displayName}
        maxLength={PROFILE_LIMITS.name}
        autoComplete="name"
        error={errors.displayName}
        onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Subjects you teach</legend>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Input
              label="Add a subject"
              value={subjectInput}
              maxLength={PROFILE_LIMITS.subject}
              hint="Press Enter or choose Add."
              onChange={(event) => setSubjectInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSubject()
                }
              }}
            />
          </div>
          <Button variant="secondary" onClick={addSubject} disabled={!subjectInput.trim()}>Add</Button>
        </div>
        {draft.subjects.length > 0 && (
          <ul data-testid="t8-subjects" className="flex flex-wrap gap-2">
            {draft.subjects.map((subject) => (
              <li key={subject} className="inline-flex items-center gap-1 rounded-full border border-border bg-card ps-3 text-sm">
                {subject}
                <button
                  type="button"
                  aria-label={`Remove ${subject}`}
                  onClick={() => setDraft({ ...draft, subjects: draft.subjects.filter((s) => s !== subject) })}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.subjects && <p id={subjectsErrorId} role="alert" className="text-sm font-semibold text-destructive">{errors.subjects}</p>}
      </fieldset>

      <fieldset className="space-y-2" aria-describedby={errors.grades ? gradesErrorId : undefined}>
        <legend className="text-sm font-semibold">Grades you teach</legend>
        <div className="flex flex-wrap gap-2">
          {GRADES.map((grade) => (
            <Checkbox key={grade} label={`Grade ${grade}`} checked={draft.grades.includes(grade)} onChange={() => toggleGrade(grade)} />
          ))}
        </div>
        {errors.grades && <p id={gradesErrorId} role="alert" className="text-sm font-semibold text-destructive">{errors.grades}</p>}
      </fieldset>

      <div className="space-y-1">
        <label htmlFor={bioId} className="text-sm font-semibold">Short bio <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea
          id={bioId}
          value={draft.bio}
          maxLength={PROFILE_LIMITS.bio}
          rows={3}
          onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
          aria-invalid={errors.bio ? true : undefined}
          className="w-full rounded-xl border border-border bg-background p-3 text-sm"
        />
        <p className="text-xs text-muted-foreground">{draft.bio.length} of {PROFILE_LIMITS.bio}. Only you see this for now.</p>
        {errors.bio && <p role="alert" className="text-sm font-semibold text-destructive">{errors.bio}</p>}
      </div>

      {state.photoUpload.available && (
        <div className="space-y-1" data-testid="t8-photo">
          <label htmlFor="t8-photo-input" className="text-sm font-semibold">Photo <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input
            id="t8-photo-input"
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={photoBusy}
            onChange={(event) => void choosePhoto(event.target.files?.[0])}
            className="block min-h-11 w-full text-sm"
          />
          <p className="text-xs text-muted-foreground" role="status">
            {photoBusy ? 'Uploading…' : photoName ? `${photoName} is ready.` : photoKey ? 'A photo is already saved.' : 'JPEG, PNG or WebP, 2 MB at most.'}
          </p>
          {photoError && <p role="alert" className="text-sm font-semibold text-destructive">{photoError}</p>}
        </div>
      )}

      {failure && <p role="alert" data-testid="t8-profile-failure" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm font-semibold">{failure}</p>}

      <Button type="submit" loading={saving} disabled={photoBusy}>Save and continue</Button>
    </form>
  )
}
