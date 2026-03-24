'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Upload, Mic, Square, Play, Info, X, FileAudio, Cloud, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { captureAudio } from '@/lib/api/capture'
import { useCaptureStore } from '@/lib/stores/capture-store'

const ACCEPTED_TYPES = ['.mp3', '.wav', '.m4a']
const MAX_SIZE_MB = 100

export function AudioSource() {
  const { data: session } = useSession()
  const activeTab = useCaptureStore((s) => s.activeAudioTab)
  const setActiveTab = useCaptureStore((s) => s.setActiveAudioTab)
  const isRecording = useCaptureStore((s) => s.isRecording)
  const setRecording = useCaptureStore((s) => s.setRecording)
  const duration = useCaptureStore((s) => s.recordingDuration)
  const setDuration = useCaptureStore((s) => s.setRecordingDuration)
  const selectedFile = useCaptureStore((s) => s.selectedFile)
  const setSelectedFile = useCaptureStore((s) => s.setSelectedFile)
  const setExtractionId = useCaptureStore((s) => s.setExtractionId)

  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) return
      setSelectedFile(file)
    },
    [setSelectedFile]
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => {
        setDuration(useCaptureStore.getState().recordingDuration + 1)
      }, 1000)
    } catch {
      // Microphone permission denied
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function handleSubmit() {
    if (submitting || !session?.accessToken) return
    const fileToUpload = activeTab === 'upload' ? selectedFile : recordedBlob
    if (!fileToUpload) return
    setSubmitting(true)
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      const { extractionId } = await captureAudio(headers, fileToUpload)
      setExtractionId(extractionId)
    } catch {
      setSubmitting(false)
    }
  }

  const hasContent =
    activeTab === 'upload' ? !!selectedFile : !!recordedBlob

  return (
    <div>
      {/* Tab toggle */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-accent/30 p-1">
        {(['upload', 'record'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
              activeTab === tab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'upload' ? 'Upload File' : 'Record Live'}
          </button>
        ))}
      </div>

      {activeTab === 'upload' ? (
        <>
          {!selectedFile ? (
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'mb-3.5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-7 text-center transition-colors',
                dragOver
                  ? 'border-[#059669] bg-[#059669]/5'
                  : 'border-border hover:border-muted-foreground hover:bg-accent/50'
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]">
                <Upload className="h-5 w-5" />
              </div>
              <div className="text-[13px] font-semibold text-foreground/80">
                Drag & drop or{' '}
                <span className="font-bold text-primary">browse</span>
              </div>
              <div className="text-[11px] text-muted-foreground/60">
                Max {MAX_SIZE_MB}MB
              </div>
              <div className="flex gap-1.5">
                {ACCEPTED_TYPES.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-[#ECFDF5] px-2 py-0.5 text-[9px] font-bold uppercase text-[#059669]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
                className="hidden"
              />
            </label>
          ) : (
            <div className="mb-3.5 flex items-center gap-3 rounded-lg border border-border bg-accent/30 px-3.5 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669]">
                <FileAudio className="h-[18px] w-[18px]" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-foreground">
                  {selectedFile.name}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mb-3.5">
          <div className="mb-3.5 flex items-center gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                isRecording
                  ? 'animate-pulse bg-destructive text-white'
                  : 'bg-[#ECFDF5] text-[#059669] hover:bg-[#059669] hover:text-white'
              )}
            >
              {isRecording ? (
                <Square className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
            <div>
              <div className="text-xs font-bold text-foreground">
                {isRecording
                  ? 'Recording...'
                  : recordedBlob
                    ? 'Recording complete'
                    : 'Ready to record'}
              </div>
              {isRecording && (
                <div className="font-mono text-lg font-bold text-destructive">
                  {formatTime(duration)}
                </div>
              )}
              {!isRecording && !recordedBlob && (
                <div className="text-[10px] text-muted-foreground">
                  Click to start recording
                </div>
              )}
            </div>
          </div>

          {/* Waveform placeholder */}
          {isRecording && (
            <div className="mb-3.5 flex h-10 items-end justify-center gap-0.5 rounded-lg bg-[#ECFDF5] px-2 py-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] animate-pulse rounded bg-[#059669]"
                  style={{
                    height: `${Math.random() * 24 + 4}px`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hasContent && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mb-3.5 flex items-center gap-1.5 rounded-lg bg-[#059669] px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {submitting ? 'Processing...' : 'Start Capture'}
        </button>
      )}

      <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2 text-[10px] text-muted-foreground">
        <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <span>Cloud processing — Whisper transcription → concept extraction on our servers</span>
      </div>

      {useCaptureStore.getState().processingMode === 'local' && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Audio transcription requires cloud processing. Your audio will be processed on our servers.</span>
        </div>
      )}
    </div>
  )
}
