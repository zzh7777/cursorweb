import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';

const API = '/api';

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeIdRef = useRef(activeId);
  const streamingConvIdRef = useRef(null);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const fetchConversations = useCallback(async () => {
    const res = await fetch(`${API}/conversations`);
    const data = await res.json();
    setConversations(data);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const loadMessages = useCallback(async (convId) => {
    const res = await fetch(`${API}/conversations/${convId}/messages`);
    const data = await res.json();
    setMessages(data);
    setActiveId(convId);

    if (streamingConvIdRef.current === convId) {
      setStreaming(true);
    }
  }, []);

  const handleNewChat = () => {
    setActiveId(null);
    setMessages([]);
  };

  const handleDeleteConversation = async (id) => {
    await fetch(`${API}/conversations/${id}`, { method: 'DELETE' });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    fetchConversations();
  };

  const handleSend = async (text) => {
    if (streaming) return;

    const userMsg = { role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const assistantMsg = { role: 'assistant', content: '', created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, assistantMsg]);

    let currentConvId = activeId;
    streamingConvIdRef.current = currentConvId;

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeId,
          message: text,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          try {
            const event = JSON.parse(payload);

            if (event.type === 'conversation') {
              currentConvId = event.id;
              streamingConvIdRef.current = currentConvId;
              setActiveId(event.id);
              activeIdRef.current = event.id;
              fetchConversations();
            } else if (event.type === 'text') {
              if (activeIdRef.current === currentConvId) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: last.content + event.content };
                  }
                  return updated;
                });
              }
            } else if (event.type === 'done') {
              fetchConversations();
              if (activeIdRef.current === currentConvId) {
                setStreaming(false);
              }
            } else if (event.type === 'error') {
              if (activeIdRef.current === currentConvId) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content || `Error: ${event.message}`,
                      error: true,
                    };
                  }
                  return updated;
                });
              }
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      if (activeIdRef.current === currentConvId) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: `Connection error: ${err.message}`,
              error: true,
            };
          }
          return updated;
        });
      }
    } finally {
      streamingConvIdRef.current = null;
      if (activeIdRef.current === currentConvId) {
        setStreaming(false);
      }
    }
  };

  return (
    <div className="flex h-full">
      {/* Mobile sidebar toggle */}
      <button
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-surface hover:bg-surface-hover lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => {
            loadMessages(id);
            setSidebarOpen(false);
          }}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
        />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <ChatWindow messages={messages} streaming={streaming} />
        <MessageInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  );
}
