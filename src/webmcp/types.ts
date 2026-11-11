/**
 * WebMCP (Web Model Context Protocol) Type Definitions
 * Based on the W3C Web Machine Learning Community Group Specification Draft
 * https://webmachinelearning.github.io/webmcp/
 */

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number)[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  default?: any;
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ModelContextRegisterToolOptions {
  /**
   * Signal used to abort / unregister the tool during cleanup (e.g., component unmount).
   */
  signal?: AbortSignal;
  /**
   * Security origin list allowed to access the tool.
   */
  exposedTo?: string[];
}

export interface WebMCPTool {
  /**
   * Unique name of the tool (e.g., search_products, add_to_cart).
   */
  name: string;
  /**
   * Human & LLM-readable description of the tool's behavior and constraints.
   */
  description: string;
  /**
   * JSON Schema specifying parameter shapes and validation rules.
   */
  inputSchema: JSONSchema;
  /**
   * Tool execution handler invoked when an AI agent requests execution.
   */
  execute: (input: any) => Promise<any> | any;
  /**
   * WebMCP behavioral hint: true if the tool does not modify state (safe to query idempotently).
   */
  readOnlyHint?: boolean;
  /**
   * WebMCP behavioral hint: true if the tool makes consequential/state changes.
   */
  consequentialHint?: boolean;
}

export interface ModelContext {
  /**
   * Registers a tool imperatively with the model context.
   */
  registerTool: (tool: WebMCPTool, options?: ModelContextRegisterToolOptions) => Promise<void>;
  /**
   * Retrieves all currently registered tools.
   */
  getTools: () => Promise<WebMCPTool[]>;
  /**
   * Executes a registered tool by name with arguments.
   */
  executeTool: (name: string, input?: Record<string, any>) => Promise<any>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    modelContext?: ModelContext;
  }
  interface Window {
    modelContext?: ModelContext;
  }
}

