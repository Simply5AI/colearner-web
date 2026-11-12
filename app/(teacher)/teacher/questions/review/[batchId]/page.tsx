import { CoReviewQueue } from "@/components/teacher/questions/co-review-queue";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

export default async function TeacherCoReviewPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="Review Co's draft"
        subtitle="Accept, edit or reject each question. Co never publishes on its own."
      >
        <CoReviewQueue batchId={batchId} />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
