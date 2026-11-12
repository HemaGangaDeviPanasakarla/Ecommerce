/**
 * WebMCP (Web Model Context Protocol) Type Definitions
 * Based on the W3C Web Machine Learning Community Group Specification Draft
 */

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
}

export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute: (input: any) => Promise<any> | any;
  readOnlyHint?: boolean;
  consequentialHint?: boolean;
}

export interface ModelContext {
  registerTool: (tool: WebMCPTool, options?: ModelContextRegisterToolOptions) => Promise<void>;
  getTools: () => Promise<WebMCPTool[]>;
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
