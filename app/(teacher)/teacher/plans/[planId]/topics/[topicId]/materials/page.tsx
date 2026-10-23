import { redirect } from 'next/navigation'

/** Materials now live inside the topic workspace. The old address keeps working. */
export default async function TeacherTopicMaterialsPage({
  params,
}: {
  params: Promise<{ planId: string; topicId: string }>
}) {
  const { planId, topicId } = await params
  redirect(`/teacher/plans/${encodeURIComponent(planId)}/topics/${encodeURIComponent(topicId)}`)
}
