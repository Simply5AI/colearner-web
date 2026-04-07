import type { BYOKProvider, LLMProviderClient } from './types'
import { GeminiClient } from './gemini-client'
import { OpenAIClient } from './openai-client'
import { AnthropicBrowserClient } from './anthropic-client'
import { OllamaClient } from '@/lib/ollama/ollama-client'

export function createByokClient(
  provider: BYOKProvider,
  apiKey: string
): LLMProviderClient {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIClient(apiKey)
    case 'GEMINI':
      return new GeminiClient(apiKey)
    case 'ANTHROPIC':
      return new AnthropicBrowserClient(apiKey)
  }
}

export function createOllamaClient(baseUrl: string): LLMProviderClient {
  return new OllamaClient(baseUrl)
}
