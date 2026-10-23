import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandPanel } from '@/components/auth/brand-panel'
import { ThemeToggle } from '@/components/design-system'
import styles from '@/components/auth/auth.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.layout}>
    <a href="#auth-content" className="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:absolute">Skip to form</a>
    <BrandPanel />
    <div className={styles.formSide}>
      <div className={styles.topBar}><Link href="/"><ArrowLeft size={16} aria-hidden="true" />Back to home</Link><ThemeToggle /></div>
      <main id="auth-content" className={styles.main}><div className={styles.formContent}>{children}</div></main>
      <footer className={styles.footer}><p>A little help is always close by.</p><nav aria-label="Account support"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Help</Link></nav></footer>
    </div>
  </div>
}
