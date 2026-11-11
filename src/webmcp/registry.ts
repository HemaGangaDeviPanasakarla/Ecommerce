/**
 * WebMCP Registry Implementation
 * Compliant with W3C Web Machine Learning Model Context Protocol draft.
 * Handles lifecycle, AbortSignal cleanups, duplicate prevention, and native browser delegation.
 */

import type { WebMCPTool, ModelContext, ModelContextRegisterToolOptions } from './types';

class WebMCPRegistry implements ModelContext {
  private tools = new Map<string, { tool: WebMCPTool; cleanup?: () => void }>();

  constructor() {
    this.registerTool = this.registerTool.bind(this);
    this.getTools = this.getTools.bind(this);
    this.executeTool = this.executeTool.bind(this);
  }

  /**
   * Register a WebMCP tool imperatively.
   * If the browser natively provides navigator.modelContext or document.modelContext,
   * we also register with the native browser engine so Chrome DevTools WebMCP panel detects it.
   */
  async registerTool(tool: WebMCPTool, options?: ModelContextRegisterToolOptions): Promise<void> {
    if (!tool || !tool.name || typeof tool.execute !== 'function') {
      throw new Error(`Invalid WebMCP tool definition: ${JSON.stringify(tool)}`);
    }

    // Clean up any previous registration under the same name to prevent duplicates
    if (this.tools.has(tool.name)) {
      const existing = this.tools.get(tool.name);
      if (existing?.cleanup) {
        existing.cleanup();
      }
      this.tools.delete(tool.name);
    }

    let cleanup: (() => void) | undefined;

    if (options?.signal) {
      const signal = options.signal;
      const onAbort = () => {
        this.unregisterTool(tool.name);
      };

      if (signal.aborted) {
        return;
      }

      signal.addEventListener('abort', onAbort, { once: true });
      cleanup = () => {
        signal.removeEventListener('abort', onAbort);
      };
    }

    this.tools.set(tool.name, { tool, cleanup });

    // Format tool for native browser compatibility (supports both annotations object and flat hints)
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

    // Delegate to native browser navigator.modelContext if provided by Chrome/Chromium
    if (
      typeof navigator !== 'undefined' &&
      (navigator as any).modelContext &&
      (navigator as any).modelContext !== this &&
      typeof (navigator as any).modelContext.registerTool === 'function'
    ) {
      try {
        await (navigator as any).modelContext.registerTool(nativeToolDefinition, options);
      } catch (err) {
        console.warn(`[WebMCP] Native navigator.modelContext.registerTool failed for ${tool.name}:`, err);
      }
    }

    // Delegate to native browser document.modelContext if provided by Chrome/Chromium
    if (
      typeof document !== 'undefined' &&
      (document as any).modelContext &&
      (document as any).modelContext !== this &&
      typeof (document as any).modelContext.registerTool === 'function'
    ) {
      try {
        await (document as any).modelContext.registerTool(nativeToolDefinition, options);
      } catch (err) {
        console.warn(`[WebMCP] Native document.modelContext.registerTool failed for ${tool.name}:`, err);
      }
    }
  }

  /**
   * Unregisters a tool by name.
   */
  unregisterTool(name: string): boolean {
    const entry = this.tools.get(name);
    if (!entry) return false;
    if (entry.cleanup) {
      entry.cleanup();
    }
    return this.tools.delete(name);
  }

  /**
   * Retrieve all currently registered tools.
   */
  async getTools(): Promise<WebMCPTool[]> {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  /**
   * Execute a tool by name.
   */
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

  /**
   * Clear all registered tools.
   */
  clear(): void {
    for (const [, entry] of this.tools) {
      if (entry.cleanup) {
        entry.cleanup();
      }
    }
    this.tools.clear();
  }
}

export const webMCPRegistry = new WebMCPRegistry();

/**
 * Initializes and binds WebMCP to document, navigator, and window contexts.
 * Preserves native browser objects if already present, while polyfilling if missing.
 */
export function initializeWebMCP(): ModelContext {
  if (typeof document !== 'undefined') {
    if (!document.modelContext) {
      document.modelContext = webMCPRegistry;
    }
  }

  if (typeof navigator !== 'undefined') {
    if (!(navigator as any).modelContext) {
      (navigator as any).modelContext = webMCPRegistry;
    }
  }

  if (typeof window !== 'undefined') {
    if (!(window as any).modelContext) {
      (window as any).modelContext = webMCPRegistry;
    }
  }

  return webMCPRegistry;
}
