import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlan } from '@/lib/api/teacher-plans'
import { MaterialsListView } from '@/components/teacher/materials/materials-list-view'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { Button } from '@/components/ui/button'
import { findTreeNode } from '@/lib/teacher/plan-tree-utils'
import { listTeacherMaterials } from '@/lib/teacher/materials-dev-store'

export default async function TeacherTopicMaterialsPage({
  params,
}: {
  params: Promise<{ planId: string; topicId: string }>
}) {
  const { planId, topicId } = await params
  const session = await auth()
  if (!session?.accessToken) return null

  const headers: Record<string, string> = { Authorization: `Bearer ${session.accessToken}` }
  const plan = await fetchTeacherPlan(headers, planId)
  const topic = plan ? findTreeNode(plan.tree, topicId) : null
  if (!plan || !topic) notFound()

  const materials = listTeacherMaterials({ planId, topicId })

  return (
    <TeacherPage title="Materials" subtitle={`${plan.title} · ${topic.title}`}>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href={`/teacher/plans/${planId}/topics/${topicId}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to topic
        </Link>
      </Button>
      <MaterialsListView planId={planId} topicId={topicId} initialMaterials={materials} />
    </TeacherPage>
  )
}