import React from 'react';
import { useWebMCP } from './useWebMCP';

/**
 * Component that binds WebMCP lifecycle inside the React component hierarchy.
 * Must be rendered within Redux Provider and React Router Router context.
 */
export const WebMCPManager: React.FC = () => {
  useWebMCP();
  return null;
};

