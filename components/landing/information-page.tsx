import Link from 'next/link'
import { PublicHeader, PublicFooter } from './landing-page'
interface InformationPageProps { title: string; introduction: string; children: React.ReactNode }
export function InformationPage({ title, introduction, children }: InformationPageProps) {
  return <div className="bg-background text-foreground"><a href="#information-content" className="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:absolute">Skip to content</a><PublicHeader /><main id="information-content" className="mx-auto max-w-3xl px-6 py-12 sm:py-20"><Link href="/" className="inline-flex min-h-11 items-center font-semibold text-primary">Back to overview</Link><h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-extrabold">{title}</h1><p className="mt-5 text-lg text-muted-foreground">{introduction}</p><div className="mt-8 space-y-7 leading-relaxed">{children}</div></main><PublicFooter /></div>
}
