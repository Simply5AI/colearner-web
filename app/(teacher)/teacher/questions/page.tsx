import { QuestionBankList } from "@/components/teacher/questions/question-bank-list";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function TeacherQuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string | string[]; topicId?: string | string[] }>;
}) {
  const query = await searchParams;
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="Question bank"
        subtitle="Write questions, import them, or ask Co to draft from your material. Learners see a question only after you publish it."
      >
        <QuestionBankList
          initialPlanId={first(query.planId) ?? ""}
          initialTopicId={first(query.topicId) ?? ""}
        />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
