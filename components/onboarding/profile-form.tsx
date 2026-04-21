'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { profileStepSchema, type ProfileStepInput } from '@/lib/validators/onboarding'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { useProfile } from '@/lib/hooks/use-profile'
import { GRADE_LEVEL_OPTIONS, GENDER_OPTIONS } from '@/lib/constants/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarUpload } from '@/components/ui/avatar-upload'

export function ProfileForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const store = useOnboardingStore()
  const { data: profile } = useProfile()
  const hydrated = useRef(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProfileStepInput>({
    resolver: standardSchemaResolver(profileStepSchema),
    defaultValues: {
      displayName: store.displayName || session?.user?.name || '',
      bio: store.bio || '',
      dateOfBirth: store.dateOfBirth || undefined,
      gradeLevel: (store.gradeLevel || undefined) as ProfileStepInput['gradeLevel'],
      gender: (store.gender || undefined) as ProfileStepInput['gender'],
      learnerType: (store.learnerType || undefined) as ProfileStepInput['learnerType'],
    },
  })

  useEffect(() => {
    if (profile && !hydrated.current && !store.displayName) {
      hydrated.current = true
      store.hydrate(profile)
      reset({
        displayName: profile.name || session?.user?.name || '',
        bio: profile.bio || '',
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : undefined,
        gradeLevel: (profile.gradeLevel || undefined) as ProfileStepInput['gradeLevel'],
        gender: (profile.gender || undefined) as ProfileStepInput['gender'],
        learnerType: (profile.learnerType || undefined) as ProfileStepInput['learnerType'],
      })
    }
  }, [profile, store, reset, session])

  const onSubmit = (data: ProfileStepInput) => {
    store.setProfile({
      displayName: data.displayName,
      bio: data.bio || '',
      avatarPreviewUrl: store.avatarPreviewUrl,
      dateOfBirth: data.dateOfBirth || '',
      gradeLevel: data.gradeLevel || '',
      gender: data.gender || '',
      learnerType: data.learnerType || '',
    })
    router.push('/onboarding/goal')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])} className="space-y-7">
      <AvatarUpload
        previewUrl={store.avatarPreviewUrl}
        onFileSelect={(file, previewUrl) => {
          store.setProfile({
            displayName: store.displayName,
            bio: store.bio,
            avatarPreviewUrl: previewUrl,
            avatarFile: file,
          })
        }}
      />

      <div className="space-y-1.5">
        <Label htmlFor="displayName" className="text-xs font-semibold">
          Display Name
        </Label>
        <Input
          {...register('displayName')}
          id="displayName"
          className="h-11"
          placeholder="How should we call you?"
        />
        {errors.displayName && (
          <p className="text-[11px] text-destructive">{errors.displayName.message}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          This is how other learners will see you
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio" className="text-xs font-semibold">
          Bio <span className="font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <textarea
          {...register('bio')}
          id="bio"
          rows={3}
          placeholder="I'm interested in learning about..."
          className="flex w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-brand-orange focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-orange/12 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ resize: 'vertical' }}
        />
        {errors.bio && <p className="text-[11px] text-destructive">{errors.bio.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dateOfBirth" className="text-xs font-semibold">
          Date of Birth <span className="font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          {...register('dateOfBirth')}
          id="dateOfBirth"
          type="date"
          className="h-11"
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">I am a...</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'STUDENT' as const, label: 'Student', desc: 'School, college, or university' },
            { value: 'PROFESSIONAL' as const, label: 'Professional', desc: 'Working or career-focused' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer flex-col rounded-xl border-2 p-4 text-center transition-all ${
                watch('learnerType') === opt.value
                  ? 'border-brand-orange bg-brand-orange/5'
                  : 'border-border hover:border-brand-orange/30'
              }`}
            >
              <input type="radio" value={opt.value} {...register('learnerType')} className="sr-only" />
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="gradeLevel" className="text-xs font-semibold">
            Grade / Class <span className="font-normal text-muted-foreground">(Optional)</span>
          </Label>
          <select
            {...register('gradeLevel')}
            id="gradeLevel"
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors focus-visible:border-brand-orange focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-orange/12"
          >
            <option value="">Select</option>
            {GRADE_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gender" className="text-xs font-semibold">
            Gender <span className="font-normal text-muted-foreground">(Optional)</span>
          </Label>
          <select
            {...register('gender')}
            id="gender"
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors focus-visible:border-brand-orange focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-orange/12"
          >
            <option value="">Select</option>
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
      >
        Continue &rarr;
      </Button>
    </form>
  )
}
