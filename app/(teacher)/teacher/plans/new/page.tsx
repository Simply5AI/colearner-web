import { TeachingPlansList } from "@/components/teacher/plans/teaching-plans-list";
import { TeachingWorkspace } from "@/components/teacher/teaching-workspace";
import { TeacherPage } from "@/components/teacher/teacher-page";

/** Deep link to the New plan dialog over the plan list. */
export default function TeacherPlanNewPage() {
  return (
    <TeachingWorkspace>
      <TeacherPage
        title="Plans"
        subtitle="Plans for the classes and subjects you teach. Students see a plan only after you publish and assign it."
      >
        <TeachingPlansList openNewInitially />
      </TeacherPage>
    </TeachingWorkspace>
  );
}
