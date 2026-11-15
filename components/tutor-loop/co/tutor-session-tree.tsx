'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import type { TutorTreeGroupNode, TutorTreeTopicNode } from './tutor-types'

export interface TutorSessionTreeProps {
  groups: TutorTreeGroupNode[]
  groupBy: 'SUBJECT' | 'PLAN'
  onGroupByChange: (next: 'SUBJECT' | 'PLAN') => void
  searchQuery: string
  onSearchQueryChange: (next: string) => void
  selectedTopicId: string | null
  selectedSessionId: string | null
  onSelectTopic: (topic: TutorTreeTopicNode) => void
  onSelectSession: (sessionId: string, topic: TutorTreeTopicNode) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => Promise<void> | void
  deletingSessionId?: string | null
}

function formatMasteryLabel(state?: string | null): string {
  switch (state?.toUpperCase()) {
    case 'NONE':
    case 'NOT_STARTED':
      return 'Not started'
    case 'LEARNING':
      return 'Learning'
    case 'PRACTISING':
    case 'PRACTICING':
      return 'Practising'
    case 'SECURE':
      return 'Secure'
    case 'MASTERED':
      return 'Mastered'
    default:
      return 'Practising'
  }
}

export function TutorSessionTree({
  groups,
  groupBy,
  onGroupByChange,
  searchQuery,
  onSearchQueryChange,
  selectedTopicId,
  selectedSessionId,
  onSelectTopic,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  deletingSessionId,
}: TutorSessionTreeProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  return (
    <nav
      aria-label="My subjects"
      data-testid="tutor-session-tree"
      className="flex w-full shrink-0 flex-col gap-3 border-b border-border bg-background p-4 lg:w-[280px] lg:border-b-0 lg:border-e"
    >
      <button
        type="button"
        onClick={onNewSession}
        className="ds-button ds-button-primary flex min-h-[42px] w-full items-center justify-center gap-2 font-extrabold"
      >
        <Plus size={16} aria-hidden="true" />
        New session
      </button>

      <label className="flex min-h-[40px] items-center gap-2 rounded-xl border border-border bg-card px-3">
        <Search size={15} aria-hidden="true" className="text-muted-foreground" />
        <input
          type="search"
          value={searchQuery}
          onChange={event => onSearchQueryChange(event.target.value)}
          placeholder="Search topics and sessions"
          aria-label="Search topics and sessions"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div
        role="radiogroup"
        aria-label="Group by"
        className="flex gap-1 rounded-full bg-muted p-1"
      >
        <button
          type="button"
          role="radio"
          aria-checked={groupBy === 'SUBJECT'}
          onClick={() => onGroupByChange('SUBJECT')}
          className={`min-h-[34px] flex-1 rounded-full text-xs font-bold transition ${
            groupBy === 'SUBJECT'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground'
          }`}
        >
          By subject
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={groupBy === 'PLAN'}
          onClick={() => onGroupByChange('PLAN')}
          className={`min-h-[34px] flex-1 rounded-full text-xs font-bold transition ${
            groupBy === 'PLAN'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground'
          }`}
        >
          By plan
        </button>
      </div>

      <span className="px-1 pt-1 text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
        {groupBy === 'SUBJECT' ? 'My subjects' : 'My plans'}
      </span>

      {groups.length === 0 ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">
          No matching topics or sessions found.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(group => {
            const isExpanded = !collapsedGroups[group.id]
            return (
              <div key={group.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(group.id)}
                  className="flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-start font-extrabold hover:bg-muted/60"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                  <span className="flex-1 truncate">{group.title}</span>
                </button>

                {isExpanded && (
                  <div className="ms-4 flex flex-col gap-1">
                    {group.topics.map(topic => {
                      const isTopicSelected =
                        selectedTopicId === topic.topicId && !selectedSessionId
                      return (
                        <div key={topic.topicId} className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectTopic(topic)}
                            aria-current={isTopicSelected ? 'true' : undefined}
                            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-sm font-bold transition ${
                              isTopicSelected
                                ? 'bg-primary/15 text-primary'
                                : 'hover:bg-muted/60'
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">{topic.title}</span>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              {formatMasteryLabel(topic.state)}
                            </span>
                          </button>

                          {topic.sessions.length > 0 && (
                            <div className="ms-4 flex flex-col gap-1 border-s-2 border-border ps-2">
                              {topic.sessions.map(session => {
                                const isActiveSession = selectedSessionId === session.id
                                const isConfirmingDelete = confirmDeleteId === session.id
                                return (
                                  <div
                                    key={session.id}
                                    data-testid={`session-tree-item-${session.id}`}
                                    className={`flex flex-col gap-1.5 rounded-lg p-1.5 ${
                                      isActiveSession ? 'bg-primary/10' : 'hover:bg-muted/40'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={() => onSelectSession(session.id, topic)}
                                        aria-current={isActiveSession ? 'page' : undefined}
                                        className="flex min-w-0 flex-1 flex-col items-start text-start"
                                      >
                                        <span className="w-full truncate text-xs font-bold">
                                          {session.title}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                          {session.mode} ·{' '}
                                          {session.status === 'CLOSED' ? 'Closed' : 'Active'}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Delete session ${session.title}`}
                                        onClick={() =>
                                          setConfirmDeleteId(
                                            isConfirmingDelete ? null : session.id,
                                          )
                                        }
                                        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 size={13} aria-hidden="true" />
                                      </button>
                                    </div>

                                    {isConfirmingDelete && (
                                      <div
                                        role="region"
                                        aria-label={`Confirm deleting ${session.title}`}
                                        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2 text-xs"
                                      >
                                        <p className="text-muted-foreground">
                                          Delete this chat session? Saved notes from this session
                                          remain in your Notes.
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={deletingSessionId === session.id}
                                            onClick={async () => {
                                              await onDeleteSession(session.id)
                                              setConfirmDeleteId(null)
                                            }}
                                            className="rounded-full bg-destructive px-2.5 py-1 font-bold text-white"
                                          >
                                            {deletingSessionId === session.id
                                              ? 'Deleting…'
                                              : 'Confirm delete'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmDeleteId(null)}
                                            className="rounded-full border border-border px-2.5 py-1 font-semibold"
                                          >
                                            Keep
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )
}
