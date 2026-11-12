import { QuestionEditor } from "@/components/teacher/questions/question-editor";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

export default async function TeacherQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="Edit question"
        subtitle="Changes to a published question are saved as a draft revision until you publish them."
      >
        <QuestionEditor questionId={questionId} />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
