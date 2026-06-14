import { TeacherMarketingHeader } from '@/components/teacher/teacher-marketing-header'

export default function TeacherSignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <TeacherMarketingHeader />
      {children}
    </div>
  )
}