import { newClientId } from '@/lib/api/co'

/*
 * Idempotent requests (F-L18-08). One logical action owns one client id (`clientTurnId`, `clientSessionId`). The id is made
 * when the learner presses the button and is REUSED for every re-send of the same action, so the server (idempotent by that
 * id) returns the stored turn or session and never records a second one. It survives a refresh because it lives in
 * sessionStorage. A different body under the same key gets a new id (the server answers 409 TURN_CONFLICT for the same id with
 * another body). The id is forgotten once the server has accepted the action.
 */
const TTL_MS = 30 * 60 * 1000
export interface IdStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

/** sessionStorage, where it exists. Every access is guarded: private windows and blocked storage must never break the action. */
export function browserIdStorage(): IdStorage | null {
  try { return typeof window === 'undefined' || !window.sessionStorage ? null : window.sessionStorage } catch { return null }
}

const memory = new Map<string, { id: string; sig: string; at: number }>()
const prefix = 'colearner:homework:id:'

/** The id for this action. Same key and same signature (the body) within 30 minutes returns the same id. */
export function stableActionId(key: string, signature: string, storage: IdStorage | null = browserIdStorage(), now = Date.now()): string {
  const full = `${prefix}${key}`
  let saved: { id: string; sig: string; at: number } | undefined
  try {
    const raw = storage?.getItem(full)
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: unknown; sig?: unknown; at?: unknown }
      if (typeof parsed.id === 'string' && typeof parsed.sig === 'string' && typeof parsed.at === 'number') saved = { id: parsed.id, sig: parsed.sig, at: parsed.at }
    }
  } catch { /* unreadable storage is treated as empty */ }
  saved ??= memory.get(full)
  if (saved && saved.sig === signature && now - saved.at < TTL_MS && saved.id.length >= 8) return saved.id
  const created = { id: newClientId(), sig: signature, at: now }
  memory.set(full, created)
  try { storage?.setItem(full, JSON.stringify(created)) } catch { /* the id then lives in memory only */ }
  return created.id
}

export function forgetActionId(key: string, storage: IdStorage | null = browserIdStorage()) {
  const full = `${prefix}${key}`
  memory.delete(full)
  try { storage?.removeItem(full) } catch { /* nothing to forget */ }
}

/** Keys of the actions of one homework session. The create key is global to the entry page. */
export const idKeys = {
  create: 'create',
  restatement: (sessionId: string, confirmed: boolean) => `${sessionId}:restatement:${confirmed}`,
  problem: (sessionId: string) => `${sessionId}:problem`,
  step: (sessionId: string, stepNumber: number) => `${sessionId}:step:${stepNumber}`,
  hint: (sessionId: string, level: number) => `${sessionId}:hint:${level}`,
  final: (sessionId: string) => `${sessionId}:final`,
}

/** Test seam: forgets everything held in memory. */
export function resetActionIds() { memory.clear() }
