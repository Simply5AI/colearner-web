import { TopBar } from '@/components/shared/TopBar'

interface TeacherPageProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function TeacherPage({ title, subtitle, actions, children }: TeacherPageProps) {
  return (
    <>
      <TopBar title={title} subtitle={subtitle}>
        {actions}
      </TopBar>
      <div className="space-y-5 p-5 md:p-7">{children}</div>
    </>
  )
}