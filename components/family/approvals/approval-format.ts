import type { ApprovalRequest } from '@/lib/api/family-approvals'

export const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'a recent date' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
export const requesterText = (request: ApprovalRequest) => request.requestedBy
  ? `${request.requestedBy.displayName} (${request.requestedBy.role === 'TEACHER' ? 'teacher' : 'school administrator'})`
  : request.school?.name ?? 'Your child’s school'
export const classText = (request: ApprovalRequest) => [request.className, request.subject].filter(Boolean).join(' · ')

export const consequence = {
  APPROVE: (r: ApprovalRequest) => `${r.child.nickname} will be able to open “${r.plan.title}” and its teacher lessons right away. The teacher will see ${r.disclosure.teacherSees.length ? 'only what is listed under “What the teacher will see”.' : 'progress in this plan.'}`,
  DECLINE: (r: ApprovalRequest) => `${r.child.nickname} will not get “${r.plan.title}”. ${r.child.nickname} will see that you said no. You cannot undo this here; the teacher or school would have to send a new request.`,
  REVOKE: (r: ApprovalRequest) => `${r.child.nickname} loses access to “${r.plan.title}” immediately, on their next screen. To get access back, the teacher or school must send a new request.`,
} as const
