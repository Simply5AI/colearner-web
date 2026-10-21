import Link from 'next/link'
import { BrandMark } from '@/components/design-system'

export default function TeacherSignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6"><Link href="/" className="inline-flex min-h-11 items-center"><BrandMark /></Link><Link className="ds-button ds-button-secondary" href="/login?callbackUrl=/workspaces">School sign-in</Link></header>
      {children}
    </div>
  )
}
