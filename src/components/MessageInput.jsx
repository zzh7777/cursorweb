import { useState, useRef, useEffect } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [model, setModel] = useState('');
  const [showModelSelect, setShowModelSelect] = useState(false);
  const textareaRef = useRef(null);

  const models = [
    { value: '', label: 'Default Model' },
    { value: 'claude-sonnet', label: 'Claude Sonnet' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ];

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, model);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-zinc-950 px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-surface rounded-2xl border border-border
                        focus-within:border-primary/50 transition-colors px-4 py-2">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelSelect(!showModelSelect)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-500
                         hover:text-zinc-300 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
              title="Select model"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{models.find(m => m.value === model)?.label || 'Model'}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showModelSelect && (
              <div className="absolute bottom-full left-0 mb-2 py-1 bg-zinc-800 border border-border
                              rounded-lg shadow-xl min-w-[160px] z-10">
                {models.map(m => (
                  <button
                    key={m.value}
                    onClick={() => { setModel(m.value); setShowModelSelect(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer
                      ${model === m.value ? 'text-primary bg-primary/10' : 'text-zinc-300 hover:bg-surface-hover'}
                    `}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Waiting for response...' : 'Type a message... (Shift+Enter for new line)'}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-zinc-100
                       placeholder-zinc-600 py-1.5 max-h-[200px]"
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            className="shrink-0 p-2 rounded-lg bg-primary hover:bg-primary-hover
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-2">
          Powered by Cursor CLI &middot; Press Enter to send
        </p>
      </div>
    </div>
  );
}
