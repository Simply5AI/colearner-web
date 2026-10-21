'use client'

import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'
import type { LearnBand } from '@/lib/api/learn'
import { isPracticeId, practiceRoutes, type SessionRow } from '@/lib/api/practice'
import { dateLabel } from '@/components/learn/learn-format'
import { durationLabel, modeLabel, scoreText, statusText } from './hub-model'
import { StarRow } from './states-parts'

/** The routes that exist for one past session. Ids are validated, so nothing is built from a strange value. */
export function sessionLinks(row: Pick<SessionRow, 'id' | 'status'>) {
  if (!isPracticeId(row.id)) return { summary: null, sheet: null, resume: null }
  return {
    summary: row.status === 'COMPLETED' ? practiceRoutes.summary(row.id) : null,
    sheet: row.status === 'COMPLETED' ? practiceRoutes.answerSheet(row.id) : null,
    resume: row.status === 'IN_PROGRESS' ? practiceRoutes.session(row.id) : null,
  }
}

const when = (row: SessionRow) => dateLabel(row.completedAt ?? row.startedAt) ?? ''

/** Kids: a timeline of rounds with stars only. No scores, no failures, and no stickers (those arrive with rewards in a later release). */
export function KidsTimeline({ rows }: { rows: readonly SessionRow[] }) {
  return <ol aria-label="Rounds you played" data-testid="kids-history" className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
    {rows.map(row => {
      const links = sessionLinks(row)
      const status = statusText(row, 'kids')
      return <li key={row.id} data-session={row.id} className="ds-card flex flex-col items-center gap-3 p-5 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-secondary text-primary"><Gamepad2 size={40} aria-hidden="true" /></span>
        <p className="break-words text-[length:var(--ds-h3)] font-extrabold">{row.title}</p>
        {row.status === 'COMPLETED' && row.stars !== null ? <StarRow stars={row.stars} size={28} /> : status && <p className="font-semibold text-muted-foreground">{status}</p>}
        <p className="text-[length:var(--ds-small)] text-muted-foreground">{when(row)}</p>
        {links.resume && <Link href={links.resume} className="ds-button ds-button-primary">Keep playing</Link>}
        {links.summary && <Link href={links.summary} className="ds-button ds-button-secondary">See it</Link>}
      </li>
    })}
  </ol>
}

function RowActions({ row, band }: { row: SessionRow; band: LearnBand }) {
  const links = sessionLinks(row)
  return <div className="flex flex-wrap items-center gap-2">
    {links.resume && <Link href={links.resume} className="ds-button ds-button-primary">Continue</Link>}
    {links.summary && <Link href={links.summary} className="ds-button ds-button-ghost">Summary</Link>}
    {links.sheet && band !== 'kids' && <Link href={links.sheet} className="ds-button ds-button-ghost">Answer sheet</Link>}
  </div>
}

/** Tweens: a friendly list with the score and stars. */
export function SessionList({ rows, band }: { rows: readonly SessionRow[]; band: LearnBand }) {
  return <ul aria-label="Past sessions" data-testid="session-list" className="space-y-3">
    {rows.map(row => {
      const score = scoreText(row)
      const status = statusText(row, band)
      const duration = durationLabel(row.durationSec)
      return <li key={row.id} data-session={row.id} className="ds-card flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="break-words font-bold">{row.title}</p>
          <p className="text-[length:var(--ds-small)] text-muted-foreground">{[modeLabel(row.mode, band), when(row), duration].filter(Boolean).join(' · ')}</p>
        </div>
        {score && <p className="font-bold">{score} right</p>}
        {row.status === 'COMPLETED' && row.stars !== null && <StarRow stars={row.stars} />}
        {status && <p className="text-muted-foreground">{status}</p>}
        <RowActions row={row} band={band} />
      </li>
    })}
  </ul>
}

/** Teens: the past sessions table (date, session, score, duration, answer sheet). On a phone it scrolls inside its own region. */
export function SessionTable({ rows }: { rows: readonly SessionRow[] }) {
  return <div role="region" aria-label="Past practice sessions" tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-border focus-visible:outline-2 focus-visible:outline-ring">
    <table data-testid="session-table" className="w-full min-w-[40rem] border-collapse text-start">
      <caption className="sr-only">Past practice sessions</caption>
      <thead className="bg-muted"><tr>
        {['Date', 'Session', 'Score', 'Duration', 'Answers'].map(title => <th key={title} scope="col" className="px-3 py-2 text-start text-[length:var(--ds-small)] font-bold">{title}</th>)}
      </tr></thead>
      <tbody>
        {rows.map(row => {
          const score = scoreText(row)
          const status = statusText(row, 'teens')
          return <tr key={row.id} data-session={row.id} className="border-t border-border">
            <td className="px-3 py-3">{when(row)}</td>
            <th scope="row" className="px-3 py-3 text-start font-semibold"><span className="break-words">{row.title}</span><span className="block text-[length:var(--ds-caption)] font-normal text-muted-foreground">{modeLabel(row.mode, 'teens')}{status ? ` · ${status}` : ''}</span></th>
            <td className="px-3 py-3">{score ?? '–'}</td>
            <td className="px-3 py-3">{durationLabel(row.durationSec) ?? '–'}</td>
            <td className="px-3 py-3"><RowActions row={row} band="teens" /></td>
          </tr>
        })}
      </tbody>
    </table>
  </div>
}

/** Past sessions in the shape the band gets. */
export function SessionHistoryView({ rows, band }: { rows: readonly SessionRow[]; band: LearnBand }) {
  return band === 'kids' ? <KidsTimeline rows={rows} /> : band === 'tweens' ? <SessionList rows={rows} band={band} /> : <SessionTable rows={rows} />
}
