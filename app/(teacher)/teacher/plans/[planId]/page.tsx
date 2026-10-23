import { PlanWorkspace } from "@/components/teacher/plans/plan-workspace";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

export default async function TeacherPlanEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{
    topic?: string | string[];
    assign?: string | string[];
  }>;
}) {
  const { planId } = await params;
  const query = await searchParams;
  const topic = Array.isArray(query.topic) ? query.topic[0] : query.topic;
  const assign = Array.isArray(query.assign) ? query.assign[0] : query.assign;
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="Plan editor"
        subtitle="Organise phases and topics, add material and write lessons."
      >
        <PlanWorkspace
          planId={planId}
          initialTopicId={topic ?? null}
          assignOpen={assign === "1"}
        />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
