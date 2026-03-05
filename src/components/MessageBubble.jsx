import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function ImageLightbox({ src, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm
                 animate-[fadeIn_0.15s_ease-out] cursor-zoom-out"
      onClick={onClose}
    >
      <img
        src={src}
        alt="Full size"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70
                   text-white text-xl flex items-center justify-center transition-colors cursor-pointer"
      >
        ×
      </button>
    </div>
  );
}

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content && isStreaming;
  const startTimeRef = useRef(Date.now());
  const [lightboxSrc, setLightboxSrc] = useState(null);

  useEffect(() => {
    if (isEmpty) startTimeRef.current = Date.now();
  }, [isEmpty]);

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

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
            <div>
              {message.images && message.images.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {message.images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Attached ${i + 1}`}
                      className="max-h-40 max-w-[200px] rounded-lg object-cover cursor-zoom-in
                                 hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxSrc(src)}
                    />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ) : (
            <div className="message-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
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
    </>
  );
}
