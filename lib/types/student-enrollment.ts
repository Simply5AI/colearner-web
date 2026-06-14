import type { MaterialType, MaterialVisibility, TreeNode } from '@/lib/types/teacher'

export interface StudentEnrollmentSummary {
  id: string
  masterPlanId: string
  clonedPlanId: string
  planTitle: string
  planDescription: string
  teacherName: string
  teacherId: string | null
  enrolledAt: string
  status: 'active' | 'revoked' | 'completed'
  progressPercent: number
  nextTopicTitle: string | null
}

export interface StudentEnrolledMaterial {
  id: string
  planId: string
  topicId: string
  title: string
  type: MaterialType
  visibility: MaterialVisibility
  downloadable: boolean
  url?: string
  contentUrl?: string
  externalUrl?: string
  richTextContent?: Record<string, unknown>
  mimeType?: string
}

export interface StudentEnrolledPlan {
  id: string
  masterPlanId: string
  enrollmentId: string
  title: string
  description: string
  teacherName: string
  teacherId: string | null
  subjectTags: string[]
  enrolledAt: string
  progressPercent: number
  tree: TreeNode[]
  materialsByTopic: Record<string, StudentEnrolledMaterial[]>
  questionCountsByTopic: Record<string, number>
}

export interface RedeemInviteResult {
  planId: string
  enrollmentId: string
  clonedPlanId: string
}