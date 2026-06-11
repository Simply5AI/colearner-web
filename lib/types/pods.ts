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
    avatarUrl?: string | null
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
  _count?: {
    members: number
    sharedCaptures: number
  }
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
    questionCount: number
  }
  sharer: {
    id: string
    name: string
    avatarUrl?: string | null
  }
  commentCount: number
  isSavedByCurrentUser: boolean
}

export interface PodSavedCapture {
  id: string
  podCaptureId: string
  userId: string
  savedAt: string
  lastPracticedAt: string | null
  podCapture: PodCapture
}

export interface PodCapturePreview {
  id: string
  podId: string
  extractionId: string
  extraction: {
    id: string
    title: string
    description: string | null
    summary: string | null
    sourceType: string
    status: string
    conceptCount: number
    questionCount: number
    concepts: Array<{
      id: string
      title: string
      description: string | null
      order: number
      questions: Array<{
        id: string
        type: string
        text: string
        options: unknown
        difficulty: string | null
        intent: string | null
      }>
    }>
  }
}

export interface PodMessage {
  id: string
  podId: string
  userId: string
  parentId?: string | null
  body: string
  createdAt: string
  attachments?: PodAttachment[]
  user: {
    id: string
    name: string
    avatarUrl?: string | null
  }
}

export interface PodCaptureComment {
  id: string
  podCaptureId: string
  userId: string
  body: string
  createdAt: string
  attachments?: PodAttachment[]
  user: {
    id: string
    name: string
    avatarUrl?: string | null
  }
}

export interface PodAttachment {
  id: string
  podId: string
  userId: string
  messageId?: string | null
  commentId?: string | null
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
}

export interface PodAttachmentDownload {
  url: string
  fileName: string
  mimeType: string
  fileSize: number
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
  weeklyRecalls: number | null
  weeklyCorrect: number | null
  weeklyAccuracy: number | null
  currentStreak: number | null
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
    avatarUrl?: string | null
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

export interface CreateMessageInput {
  body: string
  attachmentIds?: string[]
  parentId?: string
}

export interface CreateCommentInput {
  body: string
  attachmentIds?: string[]
}
