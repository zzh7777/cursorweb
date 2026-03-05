import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ messages, streaming, onHintClick }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">Cursor Web Chat</h2>
        <p className="text-zinc-500 max-w-md text-sm leading-relaxed">
          通过 Cursor CLI 与 AI 对话。输入任何问题、编程任务或指令，
          AI 将通过 Cursor Agent 为你提供帮助。
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {[
            '解释一下 React hooks 的工作原理',
            '帮我写一个 Python 快速排序算法',
            '分析当前项目的代码结构',
            '如何优化数据库查询性能？',
          ].map((hint) => (
            <button
              key={hint}
              onClick={() => onHintClick?.(hint)}
              className="px-4 py-3 rounded-xl bg-surface-hover/50 border border-border
                         text-sm text-zinc-400 hover:text-zinc-200 hover:border-primary/50
                         hover:bg-primary/5 cursor-pointer transition-all text-left"
            >
              {hint}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((msg, i) => {
          const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant' && streaming;
          return <MessageBubble key={i} message={msg} isStreaming={isLastAssistant} />;
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
