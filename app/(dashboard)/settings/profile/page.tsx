'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { TopicSelector } from '@/components/shared/TopicSelector'
import { useProfile, useUpdateProfileMutation, useUploadAvatar } from '@/lib/hooks/use-profile'
import { useTopics } from '@/lib/hooks/use-onboarding'
import { cn } from '@/lib/utils'
import type { LearningGoal } from '@/lib/types'

const GOALS: { id: string; emoji: string; name: string; description: string }[] = [
  { id: 'BUILD_KNOWLEDGE', emoji: '\u{1F4DA}', name: 'Build Knowledge', description: 'Deepen understanding' },
  { id: 'RETAIN_MORE', emoji: '\u{1F9E0}', name: 'Retain More', description: 'Remember everything' },
  { id: 'EXAM_PREP', emoji: '\u{1F3AF}', name: 'Exam Prep', description: 'Ace your tests' },
  { id: 'CAREER_GROWTH', emoji: '\u{1F4BC}', name: 'Career Growth', description: 'Level up professionally' },
]

const TIME_OPTIONS = [5, 15, 30, 60] as const

function formatTime(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} hour` : `${minutes} min`
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const { data: profile, isLoading } = useProfile()
  const { data: fetchedTopics } = useTopics()
  const updateProfile = useUpdateProfileMutation()
  const uploadAvatarMutation = useUploadAvatar()

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [learningGoal, setLearningGoal] = useState<string | null>(null)
  const [dailyTimeMinutes, setDailyTimeMinutes] = useState<number>(15)
  const [selectedTopicSlugs, setSelectedTopicSlugs] = useState<string[]>([])

  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setBio(profile.bio || '')
      setAvatarPreview(profile.avatarUrl || null)
      setLearningGoal(profile.learningGoal || null)
      setDailyTimeMinutes(profile.dailyTimeMinutes || 15)
      setSelectedTopicSlugs(
        profile.topics?.map((t) => t.slug) || []
      )
    }
  }, [profile])

  const isSaving = updateProfile.isPending || uploadAvatarMutation.isPending

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    try {
      // Upload avatar if a new file was selected
      if (avatarFile) {
        await uploadAvatarMutation.mutateAsync(avatarFile)
        setAvatarFile(null)
      }

      // Update profile fields
      await updateProfile.mutateAsync({
        name: name.trim(),
        bio: bio.trim() || undefined,
        ...(learningGoal ? { learningGoal } : {}),
        dailyTimeMinutes,
        topicSlugs: selectedTopicSlugs.length > 0 ? selectedTopicSlugs : undefined,
      })

      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  function handleToggleTopic(slug: string) {
    setSelectedTopicSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
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

      <div className="space-y-8">
        {/* Avatar */}
        <AvatarUpload
          previewUrl={avatarPreview}
          onFileSelect={(file, previewUrl) => {
            setAvatarPreview(previewUrl)
            setAvatarFile(file)
          }}
        />

        {/* Name & Email */}
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

        {/* Bio */}
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

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Learning Goal */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold">Learning Goal</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              What best describes your learning objective?
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setLearningGoal(g.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center transition-all',
                  learningGoal === g.id
                    ? 'border-brand-orange bg-brand-orange/5 shadow-[0_0_0_1px_rgba(196,98,26,0.1)]'
                    : 'border-border bg-background hover:border-brand-orange/40'
                )}
              >
                <span className="text-2xl">{g.emoji}</span>
                <span className="text-xs font-semibold">{g.name}</span>
                <span className="text-[10px] text-muted-foreground">{g.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Daily Time */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold">Daily Learning Time</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              How much time do you want to spend learning per day?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDailyTimeMinutes(minutes)}
                className={cn(
                  'rounded-full border-[1.5px] px-5 py-2.5 text-[13px] font-semibold transition-all duration-200',
                  dailyTimeMinutes === minutes
                    ? 'border-brand-orange bg-brand-orange text-white'
                    : 'border-border bg-background text-muted-foreground hover:border-brand-orange/50'
                )}
              >
                {formatTime(minutes)}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Topics of Interest */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold">Topics of Interest</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select the topics you're interested in learning about.
            </p>
          </div>
          <TopicSelector
            topics={fetchedTopics}
            selectedSlugs={selectedTopicSlugs}
            onToggle={handleToggleTopic}
            onRemove={(slug) =>
              setSelectedTopicSlugs((prev) => prev.filter((s) => s !== slug))
            }
            showSearch
            showChips
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 border-t border-border pt-6">
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
