// Pod domain types

export type PodRole = 'OWNER' | 'MEMBER'
export type PodVisibility = 'PUBLIC' | 'INVITE_ONLY'
export type PodInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

export interface PodMember {
  id: string
  podId: string
  userId: string
  role: PodRole
  joinedAt: string
  showRecallScores: boolean
  showStreaks: boolean
  showActivityFeed: boolean
  user: {
    id: string
    name: string
    email: string
    image?: string | null
  }
}

export interface Pod {
  id: string
  orgId: string
  name: string
  description: string | null
  code: string
  visibility: PodVisibility
  maxMembers: number
  icon: string | null
  color: string | null
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  members: PodMember[]
}

export interface PodCapture {
  id: string
  podId: string
  extractionId: string
  sharedBy: string
  note: string | null
  createdAt: string
  extraction: {
    id: string
    title: string
    description: string | null
    sourceType: string
    status: string
    conceptCount: number
  }
  sharer: {
    id: string
    name: string
    image?: string | null
  }
}

export interface PodInvite {
  id: string
  podId: string
  invitedEmail: string
  invitedBy: string
  status: PodInviteStatus
  token: string
  expiresAt: string
  createdAt: string
}

export interface LeaderboardEntry {
  userId: string
  name: string
  weeklyCorrect: number
  accuracy: number
  currentStreak: number
  rank: number
  isCurrentUser: boolean
}

export interface PodActivity {
  id: string
  userId: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  user: {
    id: string
    name: string
    image?: string | null
  }
}

export interface CreatePodInput {
  name: string
  description?: string
  visibility?: PodVisibility
  maxMembers?: number
  icon?: string
  color?: string
}

export interface UpdatePodInput {
  name?: string
  description?: string
  visibility?: PodVisibility
  maxMembers?: number
  icon?: string
  color?: string
}

export interface UpdatePrivacyInput {
  showRecallScores?: boolean
  showStreaks?: boolean
  showActivityFeed?: boolean
}

export interface ShareCaptureInput {
  extractionId: string
  note?: string
}
