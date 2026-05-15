'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getApiUrl } from '@/lib/api/client';

interface TutoringPanelProps {
  attemptId: string;
  questionId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SseEvent {
  type: 'token' | 'complete' | 'error';
  data: string;
}

interface StreamState {
  text: string;
  isStreaming: boolean;
  controller: AbortController | null;
}

interface TutoringStreamStore {
  streamCache: Map<string, StreamState>;
  listeners: Map<string, Set<() => void>>;
}

const STORE_KEY = '__colearnerTutoringStreams__';

function getStore(): TutoringStreamStore {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: TutoringStreamStore;
  };

  globalStore[STORE_KEY] ??= {
    streamCache: new Map<string, StreamState>(),
    listeners: new Map<string, Set<() => void>>(),
  };

  return globalStore[STORE_KEY];
}

/**
 * Browser-global cache so tutoring streams survive panel unmount/remount and
 * Next dev module re-evaluation. One stream per (attemptId, questionId).
 */
const { streamCache, listeners } = getStore();

function notify(key: string) {
  const subs = listeners.get(key);
  if (subs) for (const cb of subs) cb();
}

function subscribe(key: string, cb: () => void): () => void {
  let subs = listeners.get(key);
  if (!subs) {
    subs = new Set();
    listeners.set(key, subs);
  }
  subs.add(cb);
  return () => {
    subs!.delete(cb);
    if (subs!.size === 0) listeners.delete(key);
  };
}

async function* streamSse(
  url: string,
  token: string,
  signal: AbortSignal,
): AsyncGenerator<SseEvent> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => '')}`);
  }
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart());
      if (dataLines.length === 0) continue;
      try {
        yield JSON.parse(dataLines.join('\n')) as SseEvent;
      } catch {
        // ignore keepalives / unparseable frames
      }
    }
  }
}

function startStream(key: string, url: string, token: string) {
  if (streamCache.has(key)) return; // already streamed / streaming
  const controller = new AbortController();
  const state: StreamState = { text: '', isStreaming: true, controller };
  streamCache.set(key, state);
  notify(key);

  (async () => {
    try {
      for await (const event of streamSse(url, token, controller.signal)) {
        if (event.type === 'token') {
          state.text += event.data;
          notify(key);
        } else if (event.type === 'complete') {
          state.isStreaming = false;
          if (state.text.trim().length === 0) {
            state.text = 'The tutor finished without returning an explanation. Please try again.';
          }
          notify(key);
          return;
        } else if (event.type === 'error') {
          state.text += `\n\n**Error:** ${event.data}`;
          state.isStreaming = false;
          notify(key);
          return;
        }
      }
      state.isStreaming = false;
      if (state.text.trim().length === 0) {
        state.text = 'The tutor finished without returning an explanation. Please try again.';
      }
      notify(key);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      state.text += `\n\n**Connection failed.** ${(err as Error)?.message ?? 'Please try again.'}`;
      state.isStreaming = false;
      notify(key);
    }
  })();
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="h-4 w-4 text-brand-purple animate-pulse" />
      <span>Thinking</span>
      <span className="flex gap-0.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-brand-purple/70 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-brand-purple/70 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-brand-purple/70 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </span>
    </div>
  );
}

export function TutoringPanel({ attemptId, questionId, isOpen, onClose }: TutoringPanelProps) {
  const { data: session } = useSession();
  const key = `${attemptId}::${questionId}`;
  const [, force] = useState(0);
  const state = streamCache.get(key);

  // Subscribe before kicking off the request so the initial "streaming" state
  // is not missed when the sheet opens.
  useEffect(() => {
    return subscribe(key, () => force((n) => n + 1));
  }, [key]);

  // Kick off the stream when the panel opens for a new question.
  useEffect(() => {
    if (!isOpen) return;
    const token = session?.accessToken;
    if (!token) return;
    if (streamCache.has(key)) return;
    const url = `${getApiUrl()}/api/tutoring/explain?attemptId=${encodeURIComponent(attemptId)}&questionId=${encodeURIComponent(questionId)}`;
    startStream(key, url, token);
  }, [isOpen, key, attemptId, questionId, session?.accessToken]);

  const text = state?.text ?? '';
  const isStreaming = state?.isStreaming ?? (isOpen && !text);
  const showThinking = isStreaming && text.length === 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full !max-w-[min(100vw,560px)] gap-0 overflow-hidden p-0"
      >
        <SheetHeader className="border-b border-border px-6 py-5 pr-14">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-purple" />
            AI Tutor
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {showThinking ? (
            <ThinkingDots />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown>{text}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-block ml-0.5 align-text-bottom h-4 w-1.5 bg-brand-purple/70 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
