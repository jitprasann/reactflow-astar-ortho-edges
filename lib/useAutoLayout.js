import { useCallback, useRef } from 'react';
import { layoutGraph, addNodesToLayout, getVisibleGraph } from './layoutEngine.js';
import { DEFAULTS } from './defaults.js';

/**
 * React hook integrating elkjs layout + collapse with React Flow.
 *
 * @param {Object} [config] - optional config overrides (horizontalGap, verticalGap, etc.)
 * @returns {{ layoutAll, addNodes, applyVisibility }}
 *
 * Usage:
 *   const { layoutAll, addNodes, applyVisibility } = useAutoLayout(config);
 *
 *   // Full re-layout (resets all positions)
 *   const positioned = await layoutAll(nodes, edges);
 *   setNodes(positioned);
 *
 *   // Add nodes below a parent
 *   const updated = await addNodes(nodes, edges, parentId, newNodes, newEdges);
 *   setNodes(updated.filter(n => ...));
 *   setEdges([...edges, ...newEdges]);
 *
 *   // Compute visible graph (respecting collapsed state)
 *   const { visibleNodes, visibleEdges } = applyVisibility(nodes, edges);
 */
export default function useAutoLayout(config) {
  const cfgRef = useRef(config);
  cfgRef.current = config;

  const layoutAll = useCallback(
    async (nodes, edges) => {
      const cfg = { ...DEFAULTS, ...(cfgRef.current || {}) };
      return layoutGraph(nodes, edges, cfg);
    },
    []
  );

  const addNodes = useCallback(
    async (existingNodes, existingEdges, parentId, newNodes, newEdges) => {
      const cfg = { ...DEFAULTS, ...(cfgRef.current || {}) };
      return addNodesToLayout(
        existingNodes,
        existingEdges,
        parentId,
        newNodes,
        newEdges,
        cfg
      );
    },
    []
  );

  const applyVisibility = useCallback(
    (nodes, edges) => {
      return getVisibleGraph(nodes, edges);
    },
    []
  );

  return { layoutAll, addNodes, applyVisibility };
}
