import { TeachingPlansList } from "@/components/teacher/plans/teaching-plans-list";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

export default function TeacherPlansPage() {
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="Plans"
        subtitle="Plans for the classes and subjects you teach. Students see a plan only after you publish and assign it."
      >
        <TeachingPlansList />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
