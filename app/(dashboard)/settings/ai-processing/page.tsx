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
  Trash2,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { OllamaClient } from '@/lib/ollama/ollama-client'
import { useProfile } from '@/lib/hooks/use-profile'
import {
  updateAISettings,
  getAiCredential,
  upsertAiCredential,
  deleteAiCredential,
  testAiCredential,
  type AiProvider,
  type AiCredentialView,
} from '@/lib/api/user'

const PROVIDER_OPTIONS: Array<{ value: AiProvider; label: string; modelHint: string; docsUrl: string }> = [
  {
    value: 'OPENROUTER',
    label: 'OpenRouter',
    modelHint: 'anthropic/claude-haiku-4.5',
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    value: 'ANTHROPIC',
    label: 'Anthropic',
    modelHint: 'claude-haiku-4-5-20251001',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    modelHint: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    value: 'GEMINI',
    label: 'Google Gemini',
    modelHint: 'gemini-2.0-flash',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
]

const MODEL_RECOMMENDATIONS = [
  { hardware: '8GB RAM', fast: 'phi4-mini, llama3.2:3b', smart: 'Same model' },
  { hardware: '16GB RAM', fast: 'mistral, gemma3:4b', smart: 'deepseek-r1:7b, mistral' },
  { hardware: '32GB+ RAM', fast: 'mistral, llama3.1:8b', smart: 'deepseek-r1:14b, qwen3:14b' },
]

const PROCESSING_MODES = [
  {
    value: 'cloud' as const,
    label: 'Cloud',
    description: 'CoLearner AI — managed pipeline with your plan quota',
    icon: Cloud,
  },
  {
    value: 'local' as const,
    label: 'Local LLM (Ollama)',
    description: 'Free, private, on-device — runs in your browser',
    icon: Server,
  },
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
  } = useCaptureStore()

  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  // BYOK (server-side) state
  const [credential, setCredential] = useState<AiCredentialView | null>(null)
  const [byokProvider, setByokProvider] = useState<AiProvider>('OPENROUTER')
  const [byokKey, setByokKey] = useState('')
  const [byokModel, setByokModel] = useState('')
  const [byokTesting, setByokTesting] = useState(false)
  const [byokSaving, setByokSaving] = useState(false)
  const [byokTestResult, setByokTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [keyVisible, setKeyVisible] = useState(false)

  useEffect(() => {
    if (!session?.accessToken) return
    getAiCredential(session.accessToken)
      .then((c) => {
        setCredential(c)
        if (c) {
          setByokProvider(c.provider)
          setByokModel(c.model ?? '')
        }
      })
      .catch(() => {})
  }, [session?.accessToken])

  async function handleByokTest() {
    if (!session?.accessToken || !byokKey) return
    setByokTesting(true)
    setByokTestResult(null)
    try {
      const res = await testAiCredential(session.accessToken, {
        provider: byokProvider,
        apiKey: byokKey,
        model: byokModel || undefined,
      })
      setByokTestResult(
        res.ok
          ? { ok: true, message: `Connected — model ${res.model ?? 'default'}` }
          : { ok: false, message: res.error ?? 'Connection failed' },
      )
    } catch (err) {
      setByokTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      })
    }
    setByokTesting(false)
  }

  async function handleByokSave() {
    if (!session?.accessToken || !byokKey) return
    setByokSaving(true)
    try {
      const saved = await upsertAiCredential(session.accessToken, {
        provider: byokProvider,
        apiKey: byokKey,
        model: byokModel || undefined,
      })
      setCredential(saved)
      setByokKey('')
      setByokTestResult({ ok: true, message: 'Saved' })
    } catch (err) {
      setByokTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Save failed',
      })
    }
    setByokSaving(false)
  }

  async function handleByokDelete() {
    if (!session?.accessToken) return
    setByokSaving(true)
    try {
      await deleteAiCredential(session.accessToken)
      setCredential(null)
      setByokKey('')
      setByokTestResult(null)
    } catch {
      // ignore
    }
    setByokSaving(false)
  }

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
      // localStorage still has the value as fallback
    }
    setSaving(false)
  }

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

  const handleModeChange = (mode: 'cloud' | 'local') => {
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

  const isLocal = processingMode === 'local'

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold">AI Processing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how your content is processed — cloud (managed) or locally on your machine via Ollama.
        </p>
      </div>

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

      {processingMode === 'cloud' && (
        <div className="rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">AI Provider (BYOK)</h3>
            </div>
            {credential && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {credential.provider} · {credential.apiKeyMasked}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Optional. Bring your own API key to route your captures through the provider of your choice.
            Leave empty to use the CoLearner platform default. Keys are encrypted at rest and never logged.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {PROVIDER_OPTIONS.map((p) => {
              const isSelected = byokProvider === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => {
                    setByokProvider(p.value)
                    setByokTestResult(null)
                  }}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <p className="text-xs font-semibold">{p.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{p.modelHint}</p>
                </button>
              )
            })}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type={keyVisible ? 'text' : 'password'}
                value={byokKey}
                onChange={(e) => {
                  setByokKey(e.target.value)
                  setByokTestResult(null)
                }}
                placeholder={credential ? 'Enter a new key to replace' : 'Paste your API key'}
                className="flex-1 rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <button
                onClick={() => setKeyVisible(!keyVisible)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
              >
                {keyVisible ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Model (optional)
            </label>
            <input
              type="text"
              value={byokModel}
              onChange={(e) => setByokModel(e.target.value)}
              placeholder={PROVIDER_OPTIONS.find((p) => p.value === byokProvider)?.modelHint}
              className="w-full rounded-lg border border-border bg-accent/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Leave empty to use the provider's default model.
            </p>
          </div>

          {byokTestResult && (
            <div
              className={`rounded-lg p-3 text-xs ${
                byokTestResult.ok
                  ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {byokTestResult.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {byokTestResult.message}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleByokTest}
              disabled={byokTesting || !byokKey}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${byokTesting ? 'animate-spin' : ''}`} />
              Test connection
            </button>
            <button
              onClick={handleByokSave}
              disabled={byokSaving || !byokKey}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {byokSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save key
            </button>
            {credential && (
              <button
                onClick={handleByokDelete}
                disabled={byokSaving}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove saved key
              </button>
            )}
            <a
              href={PROVIDER_OPTIONS.find((p) => p.value === byokProvider)?.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
            >
              Where to get a key
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      )}

      {isLocal && (
        <>
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
                      Fast Model — Extraction &amp; Questions
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
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Smart Model — Concept Ranking
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
                  </div>
                </>
              )}

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
        </>
      )}
    </div>
  )
}
