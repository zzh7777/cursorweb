import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import {
  createConversation,
  getConversations,
  getConversation,
  updateConversationTitle,
  deleteConversation,
  addMessage,
  getMessages,
} from './db.js';
import { runAgent } from './cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// --- Conversations API ---

app.get('/api/conversations', (_req, res) => {
  const conversations = getConversations();
  res.json(conversations);
});

app.post('/api/conversations', (req, res) => {
  const id = uuidv4();
  const title = req.body.title || 'New Chat';
  const conversation = createConversation(id, title);
  res.status(201).json(conversation);
});

app.get('/api/conversations/:id', (req, res) => {
  const conversation = getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Not found' });
  res.json(conversation);
});

app.patch('/api/conversations/:id', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  updateConversationTitle(req.params.id, title);
  res.json({ ok: true });
});

app.delete('/api/conversations/:id', (req, res) => {
  deleteConversation(req.params.id);
  res.json({ ok: true });
});

// --- Messages API ---

app.get('/api/conversations/:id/messages', (req, res) => {
  const messages = getMessages(req.params.id);
  res.json(messages);
});

// --- Chat SSE endpoint ---

app.post('/api/chat', (req, res) => {
  const { conversationId, message, model } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  let convId = conversationId;
  if (!convId) {
    convId = uuidv4();
    const preview = message.length > 30 ? message.slice(0, 30) + '...' : message;
    createConversation(convId, preview);
  }

  addMessage(convId, 'user', message);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Conversation-Id': convId,
  });
  res.flushHeaders();

  const write = (obj) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    }
  };

  write({ type: 'conversation', id: convId });

  const agent = runAgent(message, { model });
  let responseDone = false;

  agent.on('text', (text) => {
    write({ type: 'text', content: text });
  });

  agent.on('tool', (tool) => {
    write({ type: 'tool', ...tool });
  });

  agent.on('init', (info) => {
    write({ type: 'init', ...info });
  });

  agent.on('done', (fullText) => {
    responseDone = true;
    if (fullText) {
      addMessage(convId, 'assistant', fullText);
    }
    write({ type: 'done' });
    if (!res.writableEnded) res.end();
  });

  agent.on('error', (err) => {
    responseDone = true;
    write({ type: 'error', message: err.message });
    if (!res.writableEnded) res.end();
  });

  res.on('close', () => {
    if (!responseDone) {
      console.log('[api] Client disconnected before response complete, killing agent');
      agent.kill();
    }
  });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
