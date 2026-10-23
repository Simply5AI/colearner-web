import { PlanTopicScreen } from "@/components/teacher/plans/plan-topic-screen";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

export default async function TeacherTopicPage({
  params,
}: {
  params: Promise<{ planId: string; topicId: string }>;
}) {
  const { planId, topicId } = await params;
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="Topic"
        subtitle="Material, lesson and student preview for one topic."
      >
        <PlanTopicScreen planId={planId} topicId={topicId} />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
