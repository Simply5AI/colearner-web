import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { BookOpen, Home, Settings, Users } from 'lucide-react'
import '@/app/globals.css'
import { RoleShell } from '@/components/roles/role-shell'
import { platformNavigation, studentNavigation, teacherNavigation } from '@/components/roles/role-config'
import type { RoleNavGroup, WorkspaceRole } from '@/components/roles/role-config'
import { ageBands, CoCharacter, coStates, coVariants, Card, Input, Button, ProgressBar, QuestionOptionTile, HintLadder, AnswerFeedback, RewardBadge, CoDock, SpeechBubble, ReadAloudText } from '@/components/design-system'
import type { AgeBand } from '@/components/design-system'
import './styles.css'

const query = new URLSearchParams(window.location.search)
const validRoles: WorkspaceRole[] = ['student', 'parent', 'teacher', 'school-admin', 'platform-admin', 'researcher']
const requestedRole = query.get('role') as WorkspaceRole
const requestedBand = query.get('band') as AgeBand
const role = validRoles.includes(requestedRole) ? requestedRole : 'student'
const band = ageBands.includes(requestedBand) ? requestedBand : 'teens'
document.documentElement.dir = query.get('dir') === 'rtl' ? 'rtl' : 'ltr'
document.documentElement.classList.toggle('dark', query.get('theme') === 'dark')

const fixtureNav: RoleNavGroup[] = [{ title: 'Visual fixture destinations', items: [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/lessons', label: 'Assigned lessons', icon: BookOpen },
  { href: '/people', label: 'People', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
] }]
const nav = role === 'student' ? studentNavigation(band, true) : role === 'teacher' ? teacherNavigation : role === 'platform-admin' ? platformNavigation : fixtureNav
const navigation = query.get('long') === '1' ? nav.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, label: `${item.label} — extended translation` })) })) : nav

function LearningWidgetExamples() {
  const [option, setOption] = useState('picture')
  const [hints, setHints] = useState(0)
  const [hidden, setHidden] = useState(false)
  return <Card className="space-y-5"><h2 className="font-bold">Learning-widget references</h2><p>Illustrative controlled presentation. No grading, earned rewards or voice service is connected.</p>
    <fieldset className="space-y-3"><legend className="mb-3 font-bold">Illustrative option group</legend><QuestionOptionTile name="fixture-options" value="picture" label="Co picture" checked={option === 'picture'} onSelect={setOption} picture={{ src: '/co.svg', alt: 'Co mascot illustration' }} /><QuestionOptionTile name="fixture-options" value="text" label="Text-only option" checked={option === 'text'} onSelect={setOption} /></fieldset>
    <HintLadder hints={['Caller-supplied nudge.', 'Caller-supplied hint.', 'Caller-supplied similar example.']} revealedCount={hints} onReveal={setHints} />
    <AnswerFeedback kind="partial" message="Illustrative caller-provided feedback." band={band} />
    <div className="flex flex-wrap gap-3"><RewardBadge kind="sticker" label="Illustrative sticker" /><RewardBadge label="Illustrative locked badge" locked /></div>
    <CoDock band={band} state="explaining" hidden={hidden} onHiddenChange={setHidden}><SpeechBubble>Caller-supplied Co line.</SpeechBubble></CoDock>
    <ReadAloudText words={['One', 'supplied', 'sentence.']} activeWordIndex={1} />
  </Card>
}

createRoot(document.getElementById('root')!).render(
  <RoleShell role={role} band={band} navigation={navigation} homeHref={nav[0]?.items[0]?.href ?? '/dashboard'} identity="Visual fixture account" workspaceName={query.get('long') === '1' ? 'School workspace with an extended translated name' : undefined}>
    <section className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <div><p className="text-sm text-muted-foreground">Isolated B01 visual fixture — not an application role session</p><h1 className="font-bold text-[length:var(--ds-h1)]">A little warmth. Room to learn.</h1><p>This page exercises the actual shared components without backend access.</p></div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card><h2 className="text-[length:var(--ds-h2)] font-bold">Your material, your next step</h2><p>A longer translated explanation can wrap naturally at every screen size.</p><Input label="What are you learning?" placeholder="Choose a subject" /><Button>Continue</Button></Card>
        <Card><h2 className="text-[length:var(--ds-h2)] font-bold">Co stays curious</h2><CoCharacter state="waving" band={band} /><ProgressBar value={2} max={5} label="Fixture progress" /></Card>
      </div>
      <Card><h2 className="text-[length:var(--ds-h2)] font-bold">Meet the four Co companions</h2><div className="grid grid-cols-2 gap-5 sm:grid-cols-4">{coVariants.map(variant => <div key={variant} className="flex flex-col items-center gap-2"><CoCharacter variant={variant} band={band} size={160} label={`Co ${variant}`} /><span className="text-sm capitalize">{variant}</span></div>)}</div></Card>
      <Card><h2 className="text-[length:var(--ds-h2)] font-bold">Co state references</h2><div className="flex flex-wrap gap-5">{coStates.map((state) => <div key={state} className="flex flex-col items-center gap-2"><CoCharacter state={state} band={band} size={64} /><span className="text-sm">{state}</span></div>)}</div></Card>
      <LearningWidgetExamples />
      <Button>Fixture end action</Button>
    </section>
  </RoleShell>,
)
