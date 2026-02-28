import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

function ThinkingIndicator({ startTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="thinking-spinner w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full" />
      <span className="text-zinc-400 text-sm">
        Thinking{elapsed > 0 ? ` (${elapsed}s)` : '...'}
      </span>
    </div>
  );
}

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content && isStreaming;
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (isEmpty) startTimeRef.current = Date.now();
  }, [isEmpty]);

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mt-1">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      )}

      <div className={`
        max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? 'bg-primary text-white rounded-br-md'
          : 'bg-surface-hover text-zinc-200 rounded-bl-md'
        }
        ${message.error ? 'border border-red-500/50 bg-red-500/10' : ''}
      `}>
        {isEmpty ? (
          <ThinkingIndicator startTime={startTimeRef.current} />
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="message-content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center mt-1">
          <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}
