import type { ChatOptions, ChatResponse, LLMProviderClient } from './types'

/**
 * Browser-side Gemini client. Calls Google's REST API directly (CORS supported).
 * API key is passed per-instance and never stored server-side.
 */
export class GeminiClient implements LLMProviderClient {
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(private apiKey: string) {}

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const model = options.model || 'gemini-2.0-flash'

    // Separate system message from conversation
    const systemMessage = options.messages.find((m) => m.role === 'system')
    const conversationMessages = options.messages.filter((m) => m.role !== 'system')

    // Map to Gemini format: 'assistant' → 'model', content → parts
    const contents = conversationMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      },
    }

    if (systemMessage) {
      body.system_instruction = { parts: [{ text: systemMessage.content }] }
    }

    const res = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options.signal,
      }
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`Gemini API error (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> }
      }>
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
      }
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .join('') ?? ''

    return {
      content: text,
      model,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Say OK' }],
        maxTokens: 10,
        signal: AbortSignal.timeout(10000),
      })
      return true
    } catch {
      return false
    }
  }
}
