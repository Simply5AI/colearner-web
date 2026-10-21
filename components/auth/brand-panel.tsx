import Link from 'next/link'
import { BrandMark, CoCharacter } from '@/components/design-system'

export function BrandPanel() {
  return (
    <aside className="relative flex flex-col justify-between gap-6 rounded-b-[2rem] bg-secondary p-6 lg:rounded-none lg:p-12">
      <Link href="/" className="w-fit rounded-lg" aria-label="CoLearner home"><BrandMark /></Link>
      <div className="mx-auto flex max-w-md items-center gap-5 lg:flex-col lg:items-start">
        <CoCharacter band="kids" state="waving" size={72} decorative className="shrink-0 lg:hidden" />
        <CoCharacter band="kids" state="waving" size={220} decorative className="hidden lg:block" />
        <div>
          <p className="mb-3 text-sm font-semibold text-primary">A little curiosity goes a long way.</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight sm:text-3xl lg:text-5xl">Learning feels better with a friend.</h2>
          <p className="mt-4 hidden text-muted-foreground lg:block">Bring your questions. Take one step at a time. Build understanding with Co.</p>
        </div>
      </div>
      <p className="hidden text-sm text-muted-foreground lg:block">School-first learning · CBSE and ICSE · English</p>
    </aside>
  )
}
