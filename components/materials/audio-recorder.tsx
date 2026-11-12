'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/design-system'

export function AudioPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next) }, [file])
  return url ? <audio controls src={url} aria-label="Preview your audio" className="w-full" /> : null
}

/** The browser requests a microphone only after the learner presses Record. Stopping releases every track. */
export function AudioRecorder({ onRecording, maxBytes, disabled }: { onRecording: (file: File) => void; maxBytes: number; disabled?: boolean }) {
  const [recording, setRecording] = useState(false)
  const [opening, setOpening] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [problem, setProblem] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted = useRef(true)
  const release = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; if (timer.current) clearInterval(timer.current); timer.current = null }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); release() }
  }, [])
  const start = async () => {
    if (opening || recording) return
    setOpening(true)
    setProblem('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable in this browser. Upload an audio file instead.')
      const input = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return }
      stream.current = input
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      const next = new MediaRecorder(input, mimeType ? { mimeType } : undefined)
      recorder.current = next
      const chunks: Blob[] = []
      let size = 0, elapsed = 0, overLimit = false, failed = false
      next.ondataavailable = event => { if (event.data.size) { size += event.data.size; if (size > maxBytes) { overLimit = true; if (next.state === 'recording') next.stop() } else chunks.push(event.data) } }
      next.onerror = () => { failed = true; release(); if (mounted.current) { setRecording(false); setProblem('The microphone stopped working. Upload audio or try recording again.') } }
      next.onstop = () => {
        release()
        if (!mounted.current) return
        setRecording(false)
        if (failed) return
        if (overLimit) { setProblem('This recording exceeded the upload limit. Make a shorter recording.'); return }
        const type = (next.mimeType || mimeType || 'audio/webm').split(';')[0]!
        const blob = new Blob(chunks, { type })
        if (!blob.size) { setProblem('No audio was recorded. Try again.'); return }
        onRecording(new File([blob], `recording.${type === 'audio/mp4' ? 'm4a' : type === 'audio/ogg' ? 'ogg' : 'webm'}`, { type }))
      }
      next.start(1000)
      setSeconds(0); setRecording(true)
      timer.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= 300 && next.state === 'recording') next.stop() }, 1000)
    } catch (error) {
      release()
      setProblem(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser settings or upload audio instead.' : error instanceof Error ? error.message : 'The microphone could not open. Upload audio instead.')
    } finally { if (mounted.current) setOpening(false) }
  }
  return <div className="space-y-2 rounded-xl border border-border p-4">
    <p className="font-bold">Record your explanation</p>
    {recording ? <><p role="status">Recording · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p><Button type="button" onClick={() => recorder.current?.stop()}><Square size={18} aria-hidden="true" />Stop recording</Button></> : <Button type="button" variant="secondary" disabled={disabled || opening} onClick={() => void start()}><Mic size={18} aria-hidden="true" />{opening ? 'Opening microphone…' : 'Record audio'}</Button>}
    <p className="text-sm text-muted-foreground">Up to 5 minutes. Review the recording before sending it for transcription.</p>
    {problem && <p role="alert">{problem}</p>}
  </div>
}
