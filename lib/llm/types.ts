export type BYOKProvider = 'OPENAI' | 'GEMINI' | 'ANTHROPIC'

export interface ChatOptions {
  model: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

export interface ChatResponse {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
}

export interface LLMProviderClient {
  chat(options: ChatOptions): Promise<ChatResponse>
  testConnection?(): Promise<boolean>
}
