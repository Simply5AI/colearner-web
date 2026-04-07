'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { GraduationCap, Award, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { TopicSelector } from '@/components/shared/TopicSelector'
import { EducationCard } from '@/components/profile/education-card'
import { CertificationCard } from '@/components/profile/certification-card'
import { AddEducationDialog } from '@/components/profile/add-education-dialog'
import { AddCertificationDialog } from '@/components/profile/add-certification-dialog'
import { RegenerateButton } from '@/components/profile/regenerate-button'
import { useProfile, useUpdateProfileMutation, useUploadAvatar, useProfileSummary } from '@/lib/hooks/use-profile'
import { useTopics } from '@/lib/hooks/use-onboarding'
import { GRADE_LEVEL_OPTIONS, GENDER_OPTIONS } from '@/lib/constants/profile'
import { cn } from '@/lib/utils'
import type { UserEducation, UserCertification, UserProfile } from '@/lib/types'

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
  const { data: profileSummary } = useProfileSummary()
  const { data: fetchedTopics } = useTopics()
  const updateProfile = useUpdateProfileMutation()
  const uploadAvatarMutation = useUploadAvatar()

  const [eduDialogOpen, setEduDialogOpen] = useState(false)
  const [certDialogOpen, setCertDialogOpen] = useState(false)
  const [editingEducation, setEditingEducation] = useState<UserEducation | null>(null)
  const [editingCertification, setEditingCertification] = useState<UserCertification | null>(null)

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [gender, setGender] = useState('')
  const [learningGoal, setLearningGoal] = useState<string | null>(null)
  const [dailyTimeMinutes, setDailyTimeMinutes] = useState<number>(15)
  const [selectedTopicSlugs, setSelectedTopicSlugs] = useState<string[]>([])

  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setBio(profile.bio || '')
      setAvatarPreview(profile.avatarUrl || null)
      setDateOfBirth(profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] ?? '' : '')
      setGradeLevel(profile.gradeLevel || '')
      setGender(profile.gender || '')
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
      if (avatarFile) {
        await uploadAvatarMutation.mutateAsync(avatarFile)
        setAvatarFile(null)
      }

      await updateProfile.mutateAsync({
        name: name.trim(),
        bio: bio.trim() || undefined,
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(gradeLevel ? { gradeLevel: gradeLevel as UserProfile['gradeLevel'] } : {}),
        ...(gender ? { gender: gender as UserProfile['gender'] } : {}),
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal information, learning preferences, and credentials.
        </p>
      </div>

      <Tabs defaultValue="personal">
        <TabsList variant="line" className="w-full justify-start border-b border-border pb-0">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="learning">Learning Preferences</TabsTrigger>
          <TabsTrigger value="education">Education & Certs</TabsTrigger>
        </TabsList>

        {/* ─── Personal Info ─────────────────────────────────────────── */}
        <TabsContent value="personal" className="pt-6">
          <div className="space-y-6">
            <AvatarUpload
              previewUrl={avatarPreview}
              onFileSelect={(file, previewUrl) => {
                setAvatarPreview(previewUrl)
                setAvatarFile(file)
              }}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select</option>
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Learning Preferences ──────────────────────────────────── */}
        <TabsContent value="learning" className="pt-6">
          <div className="space-y-8">
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

            <div className="border-t border-border" />

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
          </div>
        </TabsContent>

        {/* ─── Education & Certs ─────────────────────────────────────── */}
        <TabsContent value="education" className="pt-6">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-5 text-brand-orange" />
                  <Label className="text-sm font-semibold">Education</Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingEducation(null)
                    setEduDialogOpen(true)
                  }}
                  className="gap-1.5 h-7 text-xs"
                >
                  <Plus className="size-3" /> Add
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gradeLevel" className="text-xs text-muted-foreground">Current Grade / Class</Label>
                <select
                  id="gradeLevel"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select grade / class</option>
                  {GRADE_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {profileSummary?.educations && profileSummary.educations.length > 0 ? (
                <div className="space-y-2">
                  {profileSummary.educations.map((edu) => (
                    <EducationCard
                      key={edu.id}
                      education={edu}
                      onEdit={(e) => {
                        setEditingEducation(e)
                        setEduDialogOpen(true)
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No education entries yet. Add your background to improve AI recommendations.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="size-5 text-brand-orange" />
                  <Label className="text-sm font-semibold">Certifications</Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingCertification(null)
                    setCertDialogOpen(true)
                  }}
                  className="gap-1.5 h-7 text-xs"
                >
                  <Plus className="size-3" /> Add
                </Button>
              </div>

              {profileSummary?.certifications && profileSummary.certifications.length > 0 ? (
                <div className="space-y-2">
                  {profileSummary.certifications.map((cert) => (
                    <CertificationCard
                      key={cert.id}
                      certification={cert}
                      onEdit={(c) => {
                        setEditingCertification(c)
                        setCertDialogOpen(true)
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No certifications yet. Add them to get smarter learning recommendations.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">AI Suggestions</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profileSummary?.suggestedGoalsGenerated
                      ? 'Regenerate for fresh recommendations based on your updated profile.'
                      : 'Add education data above, then generate personalized suggestions.'}
                  </p>
                </div>
                <RegenerateButton />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button — always visible */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-3">
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

      {/* Dialogs */}
      <AddEducationDialog
        open={eduDialogOpen}
        onOpenChange={setEduDialogOpen}
        editData={editingEducation}
      />
      <AddCertificationDialog
        open={certDialogOpen}
        onOpenChange={setCertDialogOpen}
        editData={editingCertification}
      />
    </div>
  )
}
