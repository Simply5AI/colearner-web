'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Server,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { OllamaClient } from '@/lib/ollama/ollama-client'
import { useProfile } from '@/lib/hooks/use-profile'
import { updateAISettings } from '@/lib/api/user'

const MODEL_RECOMMENDATIONS = [
  { hardware: '8GB RAM', fast: 'phi4-mini, llama3.2:3b', smart: 'Same model' },
  { hardware: '16GB RAM', fast: 'mistral, gemma3:4b', smart: 'deepseek-r1:7b, mistral' },
  { hardware: '32GB+ RAM', fast: 'mistral, llama3.1:8b', smart: 'deepseek-r1:14b, qwen3:14b' },
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
      // Silently fail — localStorage still has the value as fallback
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

      // Auto-select first model if none selected
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

  const isLocal = processingMode === 'local'

  const handleToggleMode = () => {
    const next = isLocal ? 'cloud' : 'local'
    setProcessingMode(next)
    saveToBackend({ processingMode: next })
    if (next === 'local') testConnection()
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold">AI Processing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how your content is processed — cloud or locally on your machine.
        </p>
      </div>

      {/* Processing Mode Toggle */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Use Local LLM (Ollama)</p>
              <p className="text-xs text-muted-foreground">
                Process content on your machine — free, private, no data leaves your device
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            <button
              onClick={handleToggleMode}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isLocal ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isLocal ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

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
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Used for concept extraction and question generation — pick a fast, cheap model
                    </p>
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
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Ranks concepts by importance and assigns question counts — pick a smart, reasoning model
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
