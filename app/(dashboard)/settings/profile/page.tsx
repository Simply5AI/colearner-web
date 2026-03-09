'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { useProfile, useUpdateProfileMutation } from '@/lib/hooks/use-profile'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfileMutation()

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setBio(profile.bio || '')
      setAvatarPreview(profile.profileImageUrl || null)
    }
  }, [profile])

  function handleSave() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    updateProfile.mutate(
      { name: name.trim(), bio: bio.trim() },
      {
        onSuccess: () => toast.success('Profile updated'),
        onError: () => toast.error('Failed to update profile'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading profile...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Update your personal information.
        </p>
      </div>

      <div className="space-y-6">
        <AvatarUpload
          previewUrl={avatarPreview}
          onFileSelect={(_file, previewUrl) => setAvatarPreview(previewUrl)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={session?.user?.email || profile?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us a bit about yourself..."
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-6">
          <Button
            onClick={handleSave}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
