import type { BYOKProvider } from './types'

export interface ProviderInfo {
  name: string
  fast: string
  smart: string
  docsUrl: string
  description: string
}

export const PROVIDER_DEFAULTS: Record<BYOKProvider, ProviderInfo> = {
  OPENAI: {
    name: 'OpenAI',
    fast: 'gpt-4o-mini',
    smart: 'gpt-4o',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: 'GPT-4o-mini & GPT-4o',
  },
  GEMINI: {
    name: 'Google Gemini',
    fast: 'gemini-2.0-flash',
    smart: 'gemini-2.5-pro',
    docsUrl: 'https://aistudio.google.com/apikey',
    description: 'Gemini 2.0 Flash & Gemini 2.5 Pro',
  },
  ANTHROPIC: {
    name: 'Anthropic',
    fast: 'claude-haiku-4-5-20251001',
    smart: 'claude-sonnet-4-20250514',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Claude Haiku & Claude Sonnet',
  },
}
