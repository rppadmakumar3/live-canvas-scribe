/**
 * WebMCP Polyfill for browsers without native document.modelContext support.
 * Allows tools to be registered via document.modelContext.registerTool and
 * invoked via document.modelContext.tools.<tool_name>.execute(input).
 */

export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (input: any) => Promise<any> | any;
}

export interface ModelContext {
  tools: Record<string, { execute: (input?: any) => Promise<any> }>;
  registerTool: (tool: WebMCPTool) => { unregister: () => void };
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Window {
    modelContext?: ModelContext;
  }
}

export function initWebMCPPolyfill(): ModelContext {
  const doc = globalThis.document as any;
  const win = globalThis as any;

  if (!doc) {
    return { tools: {}, registerTool: () => ({ unregister: () => {} }) };
  }

  if (!doc.modelContext) {
    const toolsMap: Record<string, { execute: (input?: any) => Promise<any> }> = {};

    const modelContext: ModelContext = {
      tools: toolsMap,
      registerTool: (tool: WebMCPTool) => {
        toolsMap[tool.name] = {
          execute: async (input: any = {}) => {
            return await tool.execute(input);
          },
        };
        return {
          unregister: () => {
            delete toolsMap[tool.name];
          },
        };
      },
    };

    doc.modelContext = modelContext;
    win.modelContext = modelContext;
  }

  return doc.modelContext;
}
