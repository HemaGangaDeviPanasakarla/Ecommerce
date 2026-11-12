import { webMCPRegistry } from '../webmcp/registry';
import type { WebMCPTool } from '../webmcp/types';
import type { Product } from '../features/products/types';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

export const GROQ_MODEL_OPTIONS = [
  {
    id: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B (Recommended • Ultra Fast ~1000 tok/s)',
  },
  {
    id: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B (Higher Reasoning • ~500 tok/s)',
  },
] as const;

const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY_MESSAGES = 24;

interface GroqToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCallTrace {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: unknown;
}

interface GroqConfig {
  apiKey?: string;
  model?: string;
}

export interface GroqServerStatus {
  configured: boolean;
  defaultModel: string;
}

interface AgentTurnResult {
  text: string;
  toolCalls: ToolCallTrace[];
  products: Product[];
  pendingConfirmation: boolean;
  updatedHistory: LlmMessage[];
}

interface GroqApiResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: GroqToolCall[];
    };
  }>;
  error?: {
    message?: string;
  };
}

const SYSTEM_PROMPT = [
  'You are an intelligent, helpful AI Shopping Assistant inside an e-commerce store, connected to live storefront tools via WebMCP.',
  'Always rely on the WebMCP tools to search products, inspect details, view or modify the shopping cart, check coupons, and initiate checkout. Never invent product IDs, titles, prices, ratings, cart totals, or discounts.',
  'Catalog & Search Guidance:',
  '- Store prices are displayed in INR (Rs.).',
  '- Product categories are strictly: "men\'s clothing", "women\'s clothing", "jewelery", and "electronics".',
  '- search_products matches keywords against product titles (all words must appear in the title). Prefer concise singular keywords (e.g., "jacket", "shirt", "backpack", "bracelet", "drive").',
  '- If search_products returns 0 matches, try filter_products (using category, price bounds, minRating, or without query) before saying nothing was found.',
  'Safety & Confirmation Rules:',
  '- When adding items to cart (add_to_cart) or initiating checkout (start_checkout): if the user has not explicitly confirmed that exact action yet, invoke the tool with confirmed: false first or ask for confirmation with the exact product title, quantity, and price.',
  '- Only pass confirmed: true when the user explicitly confirms (e.g. "yes", "confirm", "go ahead", or a confirmed quick-add action).',
  '- If apply_coupon reports status "UNAVAILABLE", inform the user honestly that promotional coupons are not supported by the store backend.',
  '- Never ask for credit card numbers or execute payments in chat; start_checkout safely navigates the user to the checkout screen.',
  'Presentation:',
  '- Keep responses concise, friendly, and clear. When tools return products, the UI renders interactive product cards automatically below your message, so summarize the highlights cleanly without listing raw image URLs.',
].join('\n');

function getProxyUrl(suffix: 'status' | 'chat'): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}api/groq/${suffix}`;
}

function toOpenAITools(tools: WebMCPTool[]) {
  return tools.map((tool) => {
    const hints = [
      tool.readOnlyHint ? 'read-only' : '',
      tool.consequentialHint ? 'mutates state' : '',
    ]
      .filter(Boolean)
      .join(', ');

    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: hints ? `${tool.description} [${hints}]` : tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || [],
        },
      },
    };
  });
}

function trimHistory(messages: LlmMessage[]): LlmMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) {
    return messages;
  }

  let startIndex = messages.length - MAX_HISTORY_MESSAGES;
  while (startIndex < messages.length && messages[startIndex]?.role !== 'user') {
    startIndex += 1;
  }

  return startIndex < messages.length ? messages.slice(startIndex) : [];
}

function collectProductsFromToolResult(output: unknown, productMap: Map<number, Product>): void {
  if (!output || typeof output !== 'object') return;
  const record = output as Record<string, unknown>;

  if (Array.isArray(record.products)) {
    for (const item of record.products) {
      if (item && typeof item === 'object' && typeof (item as Product).id === 'number') {
        const prod = item as Product;
        productMap.set(prod.id, prod);
      }
    }
  }

  if (record.found === true && record.product && typeof record.product === 'object') {
    const prod = record.product as Product;
    if (typeof prod.id === 'number') {
      productMap.set(prod.id, prod);
    }
  }
}

function parseToolArguments(rawArgs: string): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = rawArgs.trim();
  if (!trimmed) {
    return { ok: true, args: {} };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, args: parsed as Record<string, unknown> };
    }
    return { ok: false, error: 'Tool arguments must be a JSON object.' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `Invalid JSON tool arguments: ${err.message}` : 'Invalid JSON tool arguments',
    };
  }
}

async function requestGroqCompletion(
  payload: Record<string, unknown>,
  config: GroqConfig
): Promise<GroqApiResponse> {
  const customEndpoint = (import.meta.env.VITE_GROQ_API_URL || '').trim();
  const userApiKey = (config.apiKey || '').trim();

  let targetUrl: string;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (customEndpoint) {
    targetUrl = customEndpoint;
    if (userApiKey) {
      headers.Authorization = `Bearer ${userApiKey}`;
    }
  } else if (userApiKey) {
    targetUrl = GROQ_CHAT_COMPLETIONS_URL;
    headers.Authorization = `Bearer ${userApiKey}`;
  } else {
    targetUrl = getProxyUrl('chat');
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      response.status === 404
        ? 'Local Groq proxy endpoint is unavailable in static preview. Please enter your Groq API key in Settings (⚙️).'
        : `Unexpected response from LLM endpoint (HTTP ${response.status}).`
    );
  }

  const data = (await response.json()) as GroqApiResponse;
  if (!response.ok) {
    throw new Error(data?.error?.message || `Groq API request failed with HTTP ${response.status}.`);
  }

  return data;
}

export async function checkGroqServerStatus(): Promise<GroqServerStatus> {
  try {
    const response = await fetch(getProxyUrl('status'));
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      return { configured: false, defaultModel: DEFAULT_GROQ_MODEL };
    }

    const data = (await response.json()) as { configured?: boolean; defaultModel?: string };
    return {
      configured: Boolean(data.configured),
      defaultModel: data.defaultModel || DEFAULT_GROQ_MODEL,
    };
  } catch {
    return { configured: false, defaultModel: DEFAULT_GROQ_MODEL };
  }
}

export async function runGroqShoppingAgent(params: {
  userPrompt: string;
  history: LlmMessage[];
  config: GroqConfig;
}): Promise<AgentTurnResult> {
  const { userPrompt, history, config } = params;
  const model = (config.model || DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL;

  const registeredTools = await webMCPRegistry.getTools();
  const openAITools = toOpenAITools(registeredTools);

  const conversation: LlmMessage[] = [
    ...trimHistory(history),
    { role: 'user', content: userPrompt },
  ];

  const executedTraces: ToolCallTrace[] = [];
  const productMap = new Map<number, Product>();
  let pendingConfirmation = false;
  let finalReply = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const apiMessages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversation,
    ];

    const completion = await requestGroqCompletion(
      {
        model,
        messages: apiMessages,
        tools: openAITools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_completion_tokens: 2048,
        ...(model.startsWith('openai/gpt-oss-') ? { reasoning_effort: 'low' } : {}),
      },
      config
    );

    const assistantMsg = completion.choices?.[0]?.message;
    if (!assistantMsg) {
      throw new Error('Groq API returned an empty response.');
    }

    const toolCalls = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : [];
    conversation.push({
      role: 'assistant',
      content: assistantMsg.content ?? null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });

    if (toolCalls.length === 0) {
      finalReply = (assistantMsg.content || '').trim();
      break;
    }

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      const parsed = parseToolArguments(tc.function.arguments || '{}');

      let toolOutput: unknown;
      let traceInput: Record<string, unknown> = {};

      if (!parsed.ok) {
        toolOutput = { error: true, message: parsed.error };
      } else {
        traceInput = parsed.args;
        try {
          toolOutput = await webMCPRegistry.executeTool(toolName, parsed.args);
        } catch (err) {
          toolOutput = {
            error: true,
            tool: toolName,
            message: err instanceof Error ? err.message : 'Tool execution failed',
          };
        }
      }

      executedTraces.push({
        id: tc.id,
        name: toolName,
        input: traceInput,
        output: toolOutput,
      });

      collectProductsFromToolResult(toolOutput, productMap);

      if (toolOutput && typeof toolOutput === 'object') {
        const resultObj = toolOutput as Record<string, unknown>;
        if (
          resultObj.requiresConfirmation === true &&
          (resultObj.action === 'add_to_cart' || resultObj.action === 'start_checkout')
        ) {
          pendingConfirmation = true;
        } else if (
          resultObj.success === true &&
          (toolName === 'add_to_cart' || toolName === 'start_checkout')
        ) {
          pendingConfirmation = false;
        }
      }

      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: toolName,
        content: JSON.stringify(toolOutput),
      });
    }
  }

  if (!finalReply) {
    finalReply =
      executedTraces.length > 0
        ? 'I completed the requested store actions. Let me know if you need anything else!'
        : 'I could not generate a response. Please try rephrasing your request.';
  }

  return {
    text: finalReply,
    toolCalls: executedTraces,
    products: Array.from(productMap.values()),
    pendingConfirmation,
    updatedHistory: trimHistory(conversation),
  };
}
