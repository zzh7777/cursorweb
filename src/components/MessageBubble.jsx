import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content && isStreaming;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mt-1">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div className={`
        max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? 'bg-primary text-white rounded-br-md'
          : 'bg-surface-hover text-zinc-200 rounded-bl-md'
        }
        ${message.error ? 'border border-red-500/50 bg-red-500/10' : ''}
      `}>
        {isEmpty ? (
          <div className="flex gap-1 py-1">
            <span className="typing-dot w-2 h-2 rounded-full bg-zinc-400" />
            <span className="typing-dot w-2 h-2 rounded-full bg-zinc-400" />
            <span className="typing-dot w-2 h-2 rounded-full bg-zinc-400" />
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="message-content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* User avatar */}
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
