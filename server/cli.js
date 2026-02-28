import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';

/**
 * Resolve the actual node.exe + index.js path for the Cursor Agent CLI.
 * On Windows, `agent` is a .ps1 script that delegates to a versioned node binary.
 * We resolve it once at startup to avoid shell-encoding issues with cmd.exe.
 */
function resolveAgentBinary() {
  if (process.platform === 'win32') {
    const agentDir = path.join(process.env.LOCALAPPDATA || '', 'cursor-agent');
    const versionsDir = path.join(agentDir, 'versions');

    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir)
        .filter(d => /^\d{4}\.\d{1,2}\.\d{1,2}-[a-f0-9]+$/.test(d))
        .sort()
        .reverse();

      if (versions.length > 0) {
        const latest = versions[0];
        const nodePath = path.join(versionsDir, latest, 'node.exe');
        const indexPath = path.join(versionsDir, latest, 'index.js');
        if (fs.existsSync(nodePath) && fs.existsSync(indexPath)) {
          return { nodePath, indexPath };
        }
      }
    }

    const directNode = path.join(agentDir, 'node.exe');
    const directIndex = path.join(agentDir, 'index.js');
    if (fs.existsSync(directNode) && fs.existsSync(directIndex)) {
      return { nodePath: directNode, indexPath: directIndex };
    }
  }

  return null;
}

const resolved = resolveAgentBinary();

/**
 * Spawn Cursor Agent CLI in headless print mode and stream parsed events.
 *
 * Returns an EventEmitter that emits:
 *   - 'text'   (string)           incremental assistant text delta
 *   - 'tool'   ({ name, status }) tool call started / completed
 *   - 'done'   (fullText)         generation finished
 *   - 'error'  (Error)            process error
 */
export function runAgent(prompt, { model, workspace } = {}) {
  const emitter = new EventEmitter();

  const cliArgs = [
    '-p',
    '--output-format', 'stream-json',
    '--stream-partial-output',
    '--trust',
  ];

  if (model) {
    cliArgs.push('--model', model);
  }
  if (workspace) {
    cliArgs.push('--workspace', workspace);
  }

  cliArgs.push(prompt);

  let proc;
  const env = {
    ...process.env,
    CURSOR_INVOKED_AS: 'agent',
    NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE
      || path.join(process.env.LOCALAPPDATA || '', 'cursor-compile-cache'),
  };

  if (resolved) {
    proc = spawn(resolved.nodePath, [resolved.indexPath, ...cliArgs], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      windowsHide: true,
    });
  } else {
    proc = spawn('agent', cliArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env,
    });
  }

  let accumulated = '';
  let buffer = '';
  const acc = {
    get: () => accumulated,
    append: (t) => { accumulated += t; },
  };

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed);
        handleEvent(event, emitter, acc, finish);
      } catch {
        // non-JSON output, skip
      }
    }
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    if (text.trim()) {
      emitter.emit('stderr', text);
    }
  });

  let finished = false;
  const finish = (text) => {
    if (finished) return;
    finished = true;
    emitter.emit('done', text);
  };

  proc.on('close', (code) => {
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        handleEvent(event, emitter, acc, finish);
      } catch { /* ignore */ }
    }
    if (!finished) {
      if (code !== 0 && code !== null && !accumulated) {
        emitter.emit('error', new Error(`agent exited with code ${code}`));
      } else {
        finish(accumulated);
      }
    }
  });

  proc.on('error', (err) => {
    emitter.emit('error', new Error(`Failed to start agent CLI: ${err.message}`));
  });

  emitter.kill = () => {
    try { proc.kill(); } catch { /* already dead */ }
  };

  return emitter;
}

function handleEvent(event, emitter, acc, finish) {
  const { type, subtype } = event;

  if (type === 'assistant') {
    const content = event.message?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.text) {
          acc.append(part.text);
          emitter.emit('text', part.text);
        }
      }
    }
  } else if (type === 'tool_call') {
    const toolCall = event.tool_call || {};
    const toolName = Object.keys(toolCall).find(k => k.endsWith('ToolCall')) || 'unknown';
    emitter.emit('tool', {
      name: toolName.replace('ToolCall', ''),
      status: subtype || 'unknown',
    });
  } else if (type === 'result') {
    finish(acc.get());
  } else if (type === 'system' && subtype === 'init') {
    emitter.emit('init', { model: event.model });
  }
}
