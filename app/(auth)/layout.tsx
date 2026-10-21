import Link from 'next/link'
import { BrandPanel } from '@/components/auth/brand-panel'
import { ThemeToggle } from '@/components/design-system'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <a href="#auth-content" className="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:absolute">Skip to form</a>
      <BrandPanel />
      <div className="flex min-w-0 flex-col">
        <div className="flex justify-end p-4"><ThemeToggle /></div>
        <main id="auth-content" className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:px-14">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
        <footer className="flex flex-wrap justify-center gap-5 px-6 py-6 text-sm text-muted-foreground">
          <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Help</Link>
        </footer>
      </div>
    </div>
  )
}
