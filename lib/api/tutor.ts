export type TutorMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

export interface TutorMessage {
  id: string
  role: TutorMessageRole
  content: string
  conceptId: string | null
  imageUrl: string | null
  createdAt: string
  usedMemoryIds?: string[]
}

export interface TutorHistory {
  chatId: string | null
  messages: TutorMessage[]
}

export async function getTutorHistory(extractionId: string): Promise<TutorHistory> {
  const res = await fetch(`/api/tutor/${extractionId}/history`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load tutor history (${res.status})`)
  const json = await res.json()
  return json.data !== undefined ? (json.data as TutorHistory) : (json as TutorHistory)
}

export async function deleteTutorChat(extractionId: string): Promise<void> {
  const res = await fetch(`/api/tutor/${extractionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to clear tutor chat (${res.status})`)
}
