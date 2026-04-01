'use client'

import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { profileStepSchema, type ProfileStepInput } from '@/lib/validators/onboarding'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarUpload } from '@/components/ui/avatar-upload'

export function ProfileForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const store = useOnboardingStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileStepInput>({
    resolver: standardSchemaResolver(profileStepSchema),
    defaultValues: {
      displayName: store.displayName || session?.user?.name || '',
      bio: store.bio || '',
    },
  })

  const onSubmit = (data: ProfileStepInput) => {
    store.setProfile({
      displayName: data.displayName,
      bio: data.bio || '',
      avatarPreviewUrl: store.avatarPreviewUrl,
    })
    router.push('/onboarding/goal')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
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

      <Button
        type="submit"
        className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
      >
        Continue &rarr;
      </Button>
    </form>
  )
}
