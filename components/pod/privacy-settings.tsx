'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useUpdatePrivacy } from '@/lib/hooks/use-pods'
import type { PodMember } from '@/lib/types/pods'

interface PrivacySettingsProps {
  podId: string
  member: PodMember
}

const privacyOptions = [
  { key: 'showRecallScores' as const, label: 'Show practice scores', description: 'Let pod members see your weekly scores on the leaderboard' },
  { key: 'showStreaks' as const, label: 'Show streaks', description: 'Display your current learning streak to other members' },
  { key: 'showActivityFeed' as const, label: 'Show activity', description: 'Show your learning activity in the pod feed' },
]

export function PrivacySettings({ podId, member }: PrivacySettingsProps) {
  const updatePrivacy = useUpdatePrivacy()

  const handleToggle = (key: 'showRecallScores' | 'showStreaks' | 'showActivityFeed', value: boolean) => {
    updatePrivacy.mutate({ podId, data: { [key]: value } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Privacy Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {privacyOptions.map((option) => (
          <label key={option.key} className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
            <Checkbox
              checked={member[option.key]}
              onCheckedChange={(checked: boolean) => handleToggle(option.key, checked)}
              disabled={updatePrivacy.isPending}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  )
}
