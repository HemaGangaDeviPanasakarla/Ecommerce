/**
 * WebMCP Registry Implementation
 * Handles tool lifecycle, AbortSignal cleanups, duplicate prevention, and native browser delegation.
 */

import type { WebMCPTool, ModelContext, ModelContextRegisterToolOptions } from './types';

class WebMCPRegistry implements ModelContext {
  private tools = new Map<string, { tool: WebMCPTool; cleanup?: () => void }>();

  constructor() {
    this.registerTool = this.registerTool.bind(this);
    this.getTools = this.getTools.bind(this);
    this.executeTool = this.executeTool.bind(this);
  }

  async registerTool(tool: WebMCPTool, options?: ModelContextRegisterToolOptions): Promise<void> {
    if (!tool || !tool.name || typeof tool.execute !== 'function') {
      throw new Error(`Invalid WebMCP tool definition: ${JSON.stringify(tool)}`);
    }

    // Clean up any previous registration under the same name to prevent duplicates
    this.unregisterTool(tool.name);

    let cleanup: (() => void) | undefined;

    if (options?.signal) {
      const signal = options.signal;
      if (signal.aborted) return;

      const onAbort = () => this.unregisterTool(tool.name);
      signal.addEventListener('abort', onAbort, { once: true });
      cleanup = () => signal.removeEventListener('abort', onAbort);
    }

    this.tools.set(tool.name, { tool, cleanup });

    const nativeToolDefinition = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: {
        readOnlyHint: tool.readOnlyHint ?? false,
        consequentialHint: tool.consequentialHint ?? false,
      },
      readOnlyHint: tool.readOnlyHint,
      consequentialHint: tool.consequentialHint,
      execute: async (args: any) => {
        console.log(`[WebMCP Invocation] Tool "${tool.name}" called with:`, args);
        return await tool.execute(args);
      },
    };

    const nativeTargets = [
      typeof navigator !== 'undefined' ? { label: 'navigator', host: navigator } : null,
      typeof document !== 'undefined' ? { label: 'document', host: document } : null,
    ];

    for (const target of nativeTargets) {
      const ctx = target?.host.modelContext;
      if (ctx && ctx !== this && typeof ctx.registerTool === 'function') {
        try {
          await ctx.registerTool(nativeToolDefinition, options);
        } catch (err) {
          console.warn(`[WebMCP] Native ${target.label}.modelContext.registerTool failed for ${tool.name}:`, err);
        }
      }
    }
  }

  private unregisterTool(name: string): boolean {
    const entry = this.tools.get(name);
    if (!entry) return false;
    entry.cleanup?.();
    return this.tools.delete(name);
  }

  async getTools(): Promise<WebMCPTool[]> {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  async executeTool(name: string, input: Record<string, any> = {}): Promise<any> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`WebMCP tool "${name}" not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    try {
      return await entry.tool.execute(input);
    } catch (err: any) {
      return {
        error: true,
        tool: name,
        message: err?.message || 'Execution failed',
      };
    }
  }
}

export const webMCPRegistry = new WebMCPRegistry();

/**
 * Binds WebMCP registry to document, navigator, and window contexts if not natively provided.
 */
export function initializeWebMCP(): ModelContext {
  if (typeof document !== 'undefined' && !document.modelContext) {
    document.modelContext = webMCPRegistry;
  }
  if (typeof navigator !== 'undefined' && !navigator.modelContext) {
    navigator.modelContext = webMCPRegistry;
  }
  if (typeof window !== 'undefined' && !window.modelContext) {
    window.modelContext = webMCPRegistry;
  }
  return webMCPRegistry;
}
