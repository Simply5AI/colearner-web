import { QuestionEditor } from "@/components/teacher/questions/question-editor";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function NewTeacherQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string | string[]; topicId?: string | string[] }>;
}) {
  const query = await searchParams;
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="New question"
        subtitle="Saved as a draft that only you can see until you publish it."
      >
        <QuestionEditor planId={first(query.planId)} topicId={first(query.topicId)} />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
