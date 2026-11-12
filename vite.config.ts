import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

declare function fetch(
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

interface NodeRequest {
  url?: string;
  method?: string;
  setEncoding(encoding: string): void;
  on(event: 'data', listener: (chunk: string) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: unknown) => void): void;
  destroy(): void;
}

interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const MAX_BODY_CHARS = 2 * 1024 * 1024;

function sendJson(res: NodeResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: NodeRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    req.setEncoding('utf8');
    let raw = '';

    req.on('data', (chunk: string) => {
      raw += chunk;
      if (raw.length > MAX_BODY_CHARS) {
        reject(new Error('Request payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        reject(new Error('Invalid JSON request body'));
      }
    });

    req.on('error', (err: unknown) => {
      reject(err instanceof Error ? err : new Error('Request stream error'));
    });
  });
}

function resolveGroqEnv(mode: string): { apiKey: string; defaultModel: string } {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = (env.GROQ_API_KEY || process.env.GROQ_API_KEY || '').trim();
  const defaultModel = (env.GROQ_MODEL || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL).trim();
  return { apiKey, defaultModel };
}

function attachGroqMiddleware(middlewares: Connect.Server, mode: string, basePath: string): void {
  const trimmedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const statusPaths = new Set(['/api/groq/status', `${trimmedBase}/api/groq/status`]);
  const chatPaths = new Set(['/api/groq/chat', `${trimmedBase}/api/groq/chat`]);

  const handler = async (req: NodeRequest, res: NodeResponse, next: () => void): Promise<void> => {
    const pathname = (req.url || '').split('?')[0];

    if (req.method === 'GET' && statusPaths.has(pathname)) {
      const { apiKey, defaultModel } = resolveGroqEnv(mode);
      sendJson(res, 200, {
        configured: Boolean(apiKey),
        defaultModel,
      });
      return;
    }

    if (req.method === 'POST' && chatPaths.has(pathname)) {
      const { apiKey, defaultModel } = resolveGroqEnv(mode);
      if (!apiKey) {
        sendJson(res, 503, {
          error: {
            message:
              'GROQ_API_KEY is not configured on the server. Add GROQ_API_KEY to .env.local or enter your Groq API key in the AI Assistant settings.',
          },
        });
        return;
      }

      let body: Record<string, unknown>;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        sendJson(res, 400, {
          error: { message: err instanceof Error ? err.message : 'Invalid request body' },
        });
        return;
      }

      try {
        const upstreamBody = {
          ...body,
          model: typeof body.model === 'string' && body.model.trim() ? body.model : defaultModel,
        };

        const upstream = await fetch(GROQ_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(upstreamBody),
        });

        const responseText = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        res.end(responseText);
      } catch (err) {
        sendJson(res, 502, {
          error: {
            message: err instanceof Error ? `Failed to reach Groq API: ${err.message}` : 'Upstream Groq request failed',
          },
        });
      }
      return;
    }

    next();
  };

  middlewares.use(handler as unknown as Connect.NextHandleFunction);
}

function groqProxyPlugin(mode: string, basePath: string): Plugin {
  return {
    name: 'groq-llm-proxy',
    configureServer(server) {
      attachGroqMiddleware(server.middlewares, mode, basePath);
    },
    configurePreviewServer(server) {
      attachGroqMiddleware(server.middlewares, mode, basePath);
    },
  };
}

export default defineConfig(({ mode }) => {
  const base = '/Ecommerce/';
  return {
    base,
    plugins: [react(), tailwindcss(), groqProxyPlugin(mode, base)],
  };
});
