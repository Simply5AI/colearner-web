interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  model: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

interface ChatResponse {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
}

interface OllamaModel {
  name: string
  size: number
  parameterSize: string
  digest: string
  modifiedAt: string
}

export class OllamaClient {
  constructor(private baseUrl: string = 'http://localhost:11434') {}

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      throw new Error(`Failed to list models: ${res.status}`)
    }

    const data = (await res.json()) as {
      models: {
        name: string
        size: number
        details: { parameter_size: string }
        digest: string
        modified_at: string
      }[]
    }

    return data.models.map((m) => ({
      name: m.name,
      size: m.size,
      parameterSize: m.details.parameter_size,
      digest: m.digest,
      modifiedAt: m.modified_at,
    }))
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: false,
        options: {
          num_predict: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.7,
        },
      }),
      signal: options.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Ollama error (${res.status}): ${text}`)
    }

    const data = (await res.json()) as {
      message: { content: string }
      model: string
      prompt_eval_count?: number
      eval_count?: number
    }

    return {
      content: data.message.content,
      model: data.model,
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
    }
  }
}
