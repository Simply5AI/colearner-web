import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandMark, CoAvatar } from '@/components/design-system'

export default function DemoPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  const personas = [
    { name: 'Student · age 15', email: 'teen@b03.example.test', path: '/learner', detail: 'Sign in to open Review School A, with a sample study plan, practice history and a saved Ask Co conversation.' },
    { name: 'Parent or guardian', email: 'parent@b03.example.test', path: '/family', detail: 'Manage the linked child and teen profiles, consent, picture PINs and plan approvals.' },
    { name: 'Teacher', email: 'teacher@b03.example.test', path: '/workspaces', detail: 'Choose Review School A. Explore classes, published Mathematics and Science plans, questions and assignments.' },
    { name: 'School administrator', email: 'admin@b03.example.test', path: '/workspaces', detail: 'Choose Review School A to manage school membership, academics and learning policy.' },
  ]
  return <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
    <Link href="/" aria-label="CoLearner home"><BrandMark /></Link>
    <header className="space-y-4"><CoAvatar band="kids" state="waving" size={72} /><p className="text-sm font-bold uppercase tracking-widest text-primary">Local demo</p><h1 className="text-4xl font-bold">A whole school to explore.</h1><p className="max-w-2xl text-lg text-muted-foreground">Fictional accounts with real sign-in, school membership and saved learning data. Start with the teen account for the simplest student journey.</p><p>Shared demo password: <code className="rounded-lg bg-muted px-3 py-2 font-bold">B03Review!Pass2026</code></p></header>
    <section aria-label="Demo accounts" className="grid gap-5 md:grid-cols-2">{personas.map(persona => <article key={persona.email} className="space-y-4 rounded-3xl border bg-card p-6"><h2 className="text-xl font-bold">{persona.name}</h2><p className="break-all font-mono text-sm">{persona.email}</p><p className="text-muted-foreground">{persona.detail}</p><Link href={`/login?callbackUrl=${encodeURIComponent(persona.path)}`} className="ds-button ds-button-primary">Sign in as {persona.name.split(' · ')[0]?.toLowerCase()}</Link></article>)}</section>
    <section className="space-y-3"><h2 className="text-2xl font-bold">Testing the younger learner?</h2><p>The age-8 profile belongs to <code>student@b03.example.test</code>. Enter through the parent account: open My verified family, set the child’s three-picture PIN, then enroll Shared device and unlock the child profile. A direct child account login does not replace this flow.</p><p className="text-muted-foreground">B02 accounts are membership fixtures; they do not include the linked learner and guardian setup.</p></section>
    <section className="space-y-3 border-t pt-6"><h2 className="text-2xl font-bold">What you can test</h2><p>Saved sample lessons and teacher questions are synthetic examples. Live imports, Ask Co, generated practice and teach-back also need the local AI runtime and material worker. Teacher AI drafting, worksheet export, code execution and voice practice are not implemented or enabled in this demo.</p><p className="text-sm text-muted-foreground">Development only. These links use normal authentication; switch accounts explicitly from the signed-in banner. No passwords are submitted automatically.</p></section>
  </main>
}
