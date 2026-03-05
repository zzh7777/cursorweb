import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = '/api';

function ThinkingIndicator({ startTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const label = elapsed >= 30
    ? `等待响应中 (${elapsed}s)，若长时间无响应请点击停止按钮`
    : elapsed > 0
      ? `思考中 (${elapsed}s)`
      : '思考中...';

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="thinking-spinner w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full" />
      <span className="text-zinc-400 text-sm">{label}</span>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-700/50">
      <div className="streaming-dots flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
      </div>
      <span className="text-zinc-500 text-xs">正在生成...</span>
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

function extractRuleNameFromSQL(sql) {
  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) {
      const comment = trimmed.replace(/^--\s*/, '').trim();
      const cleaned = comment.replace(/^(规则[\d.:：]*\s*)/i, '').trim();
      if (cleaned.length >= 2 && cleaned.length <= 100) return cleaned;
    }
  }
  return '';
}

function SaveRuleDialog({ sql, conversationId, onClose, onSaved }) {
  const defaultName = extractRuleNameFromSQL(sql);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          sql_code: sql,
          category: category.trim(),
          conversation_id: conversationId || null,
        }),
      });
      if (res.ok) {
        onSaved?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-border rounded-xl w-full max-w-md mx-4 shadow-2xl animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">保存为规则</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-zinc-400 hover:text-zinc-200 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">规则名称 *</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="如：重复收费-血常规与血红蛋白"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                         placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="规则说明（可选）"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                         placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">分类</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="如：重复收费、频次限额（可选）"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                         placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 max-h-32 overflow-auto">
            <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono">{sql.slice(0, 500)}{sql.length > 500 ? '...' : ''}</pre>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover transition-colors cursor-pointer">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SqlCodeBlock({ children, conversationId, onRuleSaved }) {
  const [showSave, setShowSave] = useState(false);
  const [saved, setSaved] = useState(false);
  const code = String(children).replace(/\n$/, '');

  const handleSaved = useCallback(() => {
    setSaved(true);
    onRuleSaved?.();
    setTimeout(() => setSaved(false), 3000);
  }, [onRuleSaved]);

  return (
    <div className="relative group/sql">
      <pre className="!mt-1 !mb-1">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/sql:opacity-100 transition-opacity">
        <button
          onClick={() => setShowSave(true)}
          disabled={saved}
          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer
            ${saved
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-primary/80 hover:bg-primary text-white'
            }`}
        >
          {saved ? '已保存' : '保存为规则'}
        </button>
      </div>
      {showSave && (
        <SaveRuleDialog
          sql={code}
          conversationId={conversationId}
          onClose={() => setShowSave(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default function MessageBubble({ message, isStreaming, conversationId, onRuleSaved }) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content && isStreaming;
  const startTimeRef = useRef(Date.now());
  const [lightboxSrc, setLightboxSrc] = useState(null);

  useEffect(() => {
    if (isEmpty) startTimeRef.current = Date.now();
  }, [isEmpty]);

  const markdownComponents = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1] : '';
      const isBlock = className !== undefined;

      if (isBlock && lang === 'sql') {
        return (
          <SqlCodeBlock conversationId={conversationId} onRuleSaved={onRuleSaved}>
            {children}
          </SqlCodeBlock>
        );
      }

      if (isBlock) {
        return <pre><code className={className} {...props}>{children}</code></pre>;
      }

      return <code className={className} {...props}>{children}</code>;
    },
    pre({ children }) {
      return <>{children}</>;
    },
  };

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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && <StreamingIndicator />}
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
