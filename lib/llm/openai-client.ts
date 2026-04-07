import type { ChatOptions, ChatResponse, LLMProviderClient } from './types'

/**
 * Browser-side OpenAI client. Routes through /api/llm-proxy to bypass CORS.
 * API key is sent per-request and never stored server-side.
 */
export class OpenAIClient implements LLMProviderClient {
  constructor(private apiKey: string) {}

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const res = await fetch('/api/llm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: this.apiKey,
        model: options.model || 'gpt-4o-mini',
        messages: options.messages,
        maxTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      }),
      signal: options.signal,
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(errBody.error || `Proxy error (${res.status})`)
    }

    return (await res.json()) as ChatResponse
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say OK' }],
        maxTokens: 10,
        signal: AbortSignal.timeout(15000),
      })
      return true
    } catch {
      return false
    }
  }
}
