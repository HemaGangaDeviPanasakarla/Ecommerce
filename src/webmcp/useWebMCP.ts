/**
 * React Hook for WebMCP Tool Lifecycle Management
 * Registers and cleans up tools using AbortController compliant with the WebMCP spec.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks';
import { store } from '../store';
import { initializeWebMCP, webMCPRegistry } from './registry';
import { createProductTools } from './tools/productTools';
import { createCartTools } from './tools/cartTools';
import { createCheckoutTools } from './tools/checkoutTools';

export function useWebMCP() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    // Ensure WebMCP is globally initialized on document, navigator, and window
    initializeWebMCP();

    // Create an AbortController for lifecycle cleanup
    const abortController = new AbortController();
    const { signal } = abortController;

    const productTools = createProductTools();
    const cartTools = createCartTools({
      dispatch,
      getState: () => store.getState(),
    });
    const checkoutTools = createCheckoutTools({
      getState: () => store.getState(),
      navigate,
    });

    const allTools = [...productTools, ...cartTools, ...checkoutTools];

    // Register each tool with the AbortSignal
    Promise.all(
      allTools.map((tool) =>
        webMCPRegistry.registerTool(tool, { signal }).catch((err) => {
          console.error(`Failed to register WebMCP tool ${tool.name}:`, err);
        })
      )
    ).then(() => {
      console.log(
        `%c[WebMCP]%c Successfully registered ${allTools.length} tools:`,
        'color: #0ea5e9; font-weight: bold;',
        'color: inherit;',
        allTools.map((t) => t.name)
      );
    });

    return () => {
      // Abort signal automatically triggers unregistration of all tools
      abortController.abort();
    };
  }, [dispatch, navigate]);
}

