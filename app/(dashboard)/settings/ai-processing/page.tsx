'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Server,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Cloud,
  Key,
  ChevronDown,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { OllamaClient } from '@/lib/ollama/ollama-client'
import { useProfile } from '@/lib/hooks/use-profile'
import { updateAISettings } from '@/lib/api/user'
import { createByokClient } from '@/lib/llm/provider-factory'
import { PROVIDER_DEFAULTS } from '@/lib/llm/provider-defaults'
import type { BYOKProvider } from '@/lib/llm/types'

const MODEL_RECOMMENDATIONS = [
  { hardware: '8GB RAM', fast: 'phi4-mini, llama3.2:3b', smart: 'Same model' },
  { hardware: '16GB RAM', fast: 'mistral, gemma3:4b', smart: 'deepseek-r1:7b, mistral' },
  { hardware: '32GB+ RAM', fast: 'mistral, llama3.1:8b', smart: 'deepseek-r1:14b, qwen3:14b' },
]

const PROCESSING_MODES = [
  {
    value: 'cloud' as const,
    label: 'Cloud',
    description: 'CoLearner AI â€” uses your plan quota',
    icon: Cloud,
  },
  {
    value: 'byok' as const,
    label: 'Bring Your Own Key',
    description: 'Use your own API key â€” unlimited',
    icon: Key,
  },
  {
    value: 'local' as const,
    label: 'Local LLM (Ollama)',
    description: 'Free, private, on-device',
    icon: Server,
  },
]

const BYOK_PROVIDERS: { value: BYOKProvider; name: string; description: string }[] = [
  { value: 'OPENAI', name: 'OpenAI', description: PROVIDER_DEFAULTS.OPENAI.description },
  { value: 'GEMINI', name: 'Google Gemini', description: PROVIDER_DEFAULTS.GEMINI.description },
  { value: 'ANTHROPIC', name: 'Anthropic', description: PROVIDER_DEFAULTS.ANTHROPIC.description },
]

export default function AiProcessingPage() {
  const { data: session } = useSession()
  const { data: profile } = useProfile()
  const hydrated = useRef(false)

  const {
    processingMode,
    setProcessingMode,
    ollamaStatus,
    setOllamaStatus,
    ollamaModels,
    setOllamaModels,
    localConfig,
    setLocalConfig,
    hydrateFromProfile,
    byokProvider,
    setByokProvider,
    byokApiKey,
    setByokApiKey,
    byokFastModel,
    setByokFastModel,
    byokSmartModel,
    setByokSmartModel,
    byokKeyVerified,
    setByokKeyVerified,
  } = useCaptureStore()

  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [byokTesting, setByokTesting] = useState(false)
  const [byokTestError, setByokTestError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)

  // Hydrate store from profile on first load
  useEffect(() => {
    if (profile && !hydrated.current) {
      hydrated.current = true
      hydrateFromProfile({
        processingMode: profile.processingMode,
        ollamaBaseUrl: profile.ollamaBaseUrl,
        ollamaPass1Model: profile.ollamaPass1Model,
        ollamaPass2Model: profile.ollamaPass2Model,
      })
    }
  }, [profile, hydrateFromProfile])

  const saveToBackend = async (data: Record<string, unknown>) => {
    if (!session?.accessToken) return
    setSaving(true)
    try {
      await updateAISettings(session.accessToken, data)
    } catch {
      // Silently fail â€” localStorage still has the value as fallback
    }
    setSaving(false)
  }

  // â”€â”€â”€ Ollama Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const testConnection = async () => {
    setTesting(true)
    setOllamaStatus('checking')
    const client = new OllamaClient(localConfig.baseUrl)

    try {
      const healthy = await client.checkHealth()
      if (!healthy) {
        setOllamaStatus('unavailable')
        setOllamaModels([])
        setTesting(false)
        return
      }

      const models = await client.listModels()
      setOllamaModels(models.map((m) => m.name))
      setOllamaStatus('available')

      const firstName = models[0]?.name
      if (!localConfig.pass1Model && firstName) {
        setLocalConfig({ pass1Model: firstName })
      }
      if (!localConfig.pass2Model && firstName) {
        setLocalConfig({ pass2Model: firstName })
      }
    } catch {
      setOllamaStatus('unavailable')
      setOllamaModels([])
    }
    setTesting(false)
  }

  useEffect(() => {
    if (processingMode === 'local' && ollamaStatus === 'unchecked') {
      testConnection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingMode])

  const handleModeChange = (mode: 'cloud' | 'local' | 'byok') => {
    setProcessingMode(mode)
    saveToBackend({ processingMode: mode })
    if (mode === 'local') testConnection()
  }

  const handleBaseUrlChange = (value: string) => {
    setLocalConfig({ baseUrl: value })
  }

  const handleBaseUrlBlur = () => {
    saveToBackend({ ollamaBaseUrl: localConfig.baseUrl })
  }

  const handlePass1Change = (value: string) => {
    setLocalConfig({ pass1Model: value })
    saveToBackend({ ollamaPass1Model: value })
  }

  const handlePass2Change = (value: string) => {
    setLocalConfig({ pass2Model: value })
    saveToBackend({ ollamaPass2Model: value })
  }

  // â”€â”€â”€ BYOK Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleByokProviderChange = (provider: BYOKProvider) => {
    setByokProvider(provider)
    setByokTestError(null)
  }

  const handleByokKeyChange = (value: string) => {
    setByokApiKey(value || null)
    setByokTestError(null)
  }

  const handleByokTest = async () => {
    if (!byokProvider || !byokApiKey) return
    setByokTesting(true)
    setByokTestError(null)

    try {
      const client = createByokClient(byokProvider, byokApiKey)
      const valid = await client.testConnection?.()
      if (valid) {
        setByokKeyVerified(true)
      } else {
        setByokTestError('Key is invalid or the provider is unreachable')
        setByokKeyVerified(false)
      }
    } catch (err) {
      setByokTestError(err instanceof Error ? err.message : 'Connection test failed')
      setByokKeyVerified(false)
    }
    setByokTesting(false)
  }

  const handleClearKey = () => {
    setByokApiKey(null)
    setByokKeyVerified(false)
    setByokTestError(null)
  }

  const isByok = processingMode === 'byok'
  const isLocal = processingMode === 'local'

  const selectedProviderDefaults = byokProvider ? PROVIDER_DEFAULTS[byokProvider] : null

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold">AI Processing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how your content is processed â€” cloud, your own API key, or locally on your machine.
        </p>
      </div>

      {/* Processing Mode Selection */}
      <div className="space-y-2">
        {PROCESSING_MODES.map((mode) => {
          const Icon = mode.icon
          const isActive = processingMode === mode.value
          return (
            <button
              key={mode.value}
              onClick={() => handleModeChange(mode.value)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                  : 'border-border hover:bg-accent/50'
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{mode.label}</p>
                <p className="text-xs text-muted-foreground">{mode.description}</p>
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  isActive ? 'border-primary' : 'border-muted-foreground/30'
                }`}
              >
                {isActive && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </div>
              {saving && isActive && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </button>
          )
        })}
      </div>

      {/* â”€â”€â”€ BYOK Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isByok && (
        <>
          {/* Provider Selection */}
          <div className="rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold">Choose Provider</h3>
            <div className="grid grid-cols-3 gap-3">
              {BYOK_PROVIDERS.map((p) => {
                const isSelected = byokProvider === p.value
                return (
                  <button
                    key={p.value}
                    onClick={() => handleByokProviderChange(p.value)}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    <p className="text-xs font-semibold">{p.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{p.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* API Key Input */}
          {byokProvider && (
            <div className="rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">API Key</h3>
                <div className="flex items-center gap-2">
                  {byokKeyVerified && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  )}
                  {byokTestError && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                      Invalid
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {selectedProviderDefaults?.name} API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type={keyVisible ? 'text' : 'password'}
                    value={byokApiKey ?? ''}
                    onChange={(e) => handleByokKeyChange(e.target.value)}
                    placeholder={`Enter your ${selectedProviderDefaults?.name} API key`}
                    className="flex-1 rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    onClick={() => setKeyVisible(!keyVisible)}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    {keyVisible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={handleByokTest}
                    disabled={byokTesting || !byokApiKey}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${byokTesting ? 'animate-spin' : ''}`} />
                    Test
                  </button>
                </div>
              </div>

              {byokTestError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                  <p className="font-semibold">Key verification failed</p>
                  <p className="mt-1">{byokTestError}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Your key is stored only in this browser â€” never sent to our servers for storage.
                </p>
                <div className="flex gap-3">
                  {byokApiKey && (
                    <button
                      onClick={handleClearKey}
                      className="text-[10px] font-medium text-red-500 hover:underline"
                    >
                      Clear key
                    </button>
                  )}
                  <a
                    href={selectedProviderDefaults?.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                  >
                    Where to get a key
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Advanced: Model Selection */}
          {byokProvider && byokApiKey && (
            <div className="rounded-xl border border-border p-5">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between text-left"
              >
                <h3 className="text-sm font-semibold">Advanced: Model Selection</h3>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    showAdvanced ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Fast Model â€” Extraction &amp; Questions
                    </label>
                    <input
                      type="text"
                      value={byokFastModel ?? ''}
                      onChange={(e) => setByokFastModel(e.target.value || null)}
                      placeholder={selectedProviderDefaults?.fast}
                      className="w-full rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Leave empty to use default: {selectedProviderDefaults?.fast}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Smart Model â€” Concept Ranking
                    </label>
                    <input
                      type="text"
                      value={byokSmartModel ?? ''}
                      onChange={(e) => setByokSmartModel(e.target.value || null)}
                      placeholder={selectedProviderDefaults?.smart}
                      className="w-full rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Leave empty to use default: {selectedProviderDefaults?.smart}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* How It Works */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold">How it works</h3>
            <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  1
                </span>
                Content is fetched via CoLearner&apos;s server (text only, no video/audio data)
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  2
                </span>
                Your browser sends text to <strong>{selectedProviderDefaults?.name ?? 'the provider'}</strong> using YOUR key
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  3
                </span>
                Concepts &amp; questions are extracted and saved to your account
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  4
                </span>
                Your API key stays in this browser â€” never stored on our servers
              </li>
            </ol>
            <p className="mt-3 text-[10px] text-muted-foreground/70">
              Keep the browser tab open during processing. Speed depends on the provider and model selected.
            </p>
          </div>
        </>
      )}

      {/* â”€â”€â”€ Local (Ollama) Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isLocal && (
        <>
          {/* Connection Status */}
          <div className="rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ollama Connection</h3>
              <div className="flex items-center gap-2">
                {ollamaStatus === 'available' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </span>
                )}
                {ollamaStatus === 'unavailable' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                    <XCircle className="h-3.5 w-3.5" />
                    Not reachable
                  </span>
                )}
                {ollamaStatus === 'checking' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking...
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Ollama URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={localConfig.baseUrl}
                  onChange={(e) => handleBaseUrlChange(e.target.value)}
                  onBlur={handleBaseUrlBlur}
                  placeholder="http://localhost:11434"
                  className="flex-1 rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <button
                  onClick={testConnection}
                  disabled={testing}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                  Test
                </button>
              </div>
            </div>

            {ollamaStatus === 'unavailable' && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                <p className="font-semibold">Cannot connect to Ollama</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>
                    Install Ollama from{' '}
                    <a
                      href="https://ollama.com/download"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      ollama.com/download
                    </a>
                  </li>
                  <li>Start Ollama (it runs in the background)</li>
                  <li>
                    Set CORS:{' '}
                    <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                      OLLAMA_ORIGINS=* ollama serve
                    </code>
                  </li>
                  <li>Click &quot;Test&quot; again</li>
                </ol>
              </div>
            )}
          </div>

          {/* Model Selection */}
          {ollamaStatus === 'available' && (
            <div className="rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-sm font-semibold">Model Selection</h3>

              {ollamaModels.length === 0 ? (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  <p className="font-semibold">No models installed</p>
                  <p className="mt-1">
                    Pull a model in your terminal:{' '}
                    <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">
                      ollama pull mistral
                    </code>
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Fast Model â€” Extraction &amp; Questions
                    </label>
                    <select
                      value={localConfig.pass1Model}
                      onChange={(e) => handlePass1Change(e.target.value)}
                      className="w-full rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                    >
                      {ollamaModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Used for concept extraction and question generation â€” pick a fast, cheap model
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Smart Model â€” Concept Ranking
                    </label>
                    <select
                      value={localConfig.pass2Model}
                      onChange={(e) => handlePass2Change(e.target.value)}
                      className="w-full rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                    >
                      {ollamaModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Ranks concepts by importance and assigns question counts â€” pick a smart, reasoning model
                    </p>
                  </div>
                </>
              )}

              {/* Recommendations Table */}
              <div className="mt-4 rounded-lg bg-accent/50 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Recommended Models by Hardware
                </p>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-1 font-medium">Hardware</th>
                      <th className="pb-1 font-medium">Fast</th>
                      <th className="pb-1 font-medium">Smart</th>
                    </tr>
                  </thead>
                  <tbody className="text-foreground/80">
                    {MODEL_RECOMMENDATIONS.map((r) => (
                      <tr key={r.hardware}>
                        <td className="py-0.5 font-medium">{r.hardware}</td>
                        <td className="py-0.5 font-mono">{r.fast}</td>
                        <td className="py-0.5 font-mono">{r.smart}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <a
                href="https://ollama.com/library"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Browse all models
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* How It Works */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold">How it works</h3>
            <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  1
                </span>
                Your browser fetches the YouTube transcript via our server (text only, no video)
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  2
                </span>
                <strong>Fast model</strong> extracts concepts from transcript chunks locally
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  3
                </span>
                <strong>Smart model</strong> ranks concepts by importance and assigns question counts
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  4
                </span>
                <strong>Fast model</strong> generates questions per concept, then results are saved
              </li>
            </ol>
            <p className="mt-3 text-[10px] text-muted-foreground/70">
              Keep the browser tab open during processing. Time depends on your hardware (3-8 min typical).
            </p>
          </div>
        </>
      )}
    </div>
  )
}
