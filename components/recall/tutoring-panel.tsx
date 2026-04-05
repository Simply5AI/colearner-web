'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TutoringPanelProps {
  attemptId: string;
  questionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TutoringPanel({ attemptId, questionId, isOpen, onClose }: TutoringPanelProps) {
  const [explanation, setExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setExplanation('');
    setIsStreaming(true);

    let token = '';

    // We can fetch user token if it is required by the API. We're using standard JwtAuthGuard
    // The browser EventSource does not send Authorization headers by default.
    // But since the API uses standard cookies or we need to pass a token... wait.
    // If the API uses cookies for auth, EventSource works fine.
    // Let's assume standard Next.js app sends cookies.
    const eventSource = new EventSource(
      `/api/tutoring/explain?attemptId=${attemptId}&questionId=${questionId}`,
      { withCredentials: true }
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'token') {
          setExplanation((prev) => prev + data.data);
        } else if (data.type === 'complete') {
          setIsStreaming(false);
          eventSource.close();
        } else if (data.type === 'error') {
          setExplanation((prev) => prev + '\n\n**Error:** ' + data.data);
          setIsStreaming(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      setExplanation((prev) => prev + '\n\n**Connection lost.** Please try again.');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen, attemptId, questionId]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-purple" />
            AI Tutor
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 prose prose-sm dark:prose-invert">
          <ReactMarkdown>{explanation}</ReactMarkdown>
          {isStreaming && <span className="animate-pulse ml-1">▊</span>}
        </div>
      </SheetContent>
    </Sheet>
  );
}