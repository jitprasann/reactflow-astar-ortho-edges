import React, { createContext, useContext, useMemo } from 'react';
import { useStore, useEdges } from 'reactflow';
import { computeOrthogonalPath, separateOverlappingEdges } from './orthogonalRouter.js';
import { DEFAULTS } from './defaults.js';

const EdgeRoutingContext = createContext(null);

/**
 * Hook to read a pre-computed separated path for a specific edge.
 * Returns { path, points } or null if no EdgeRoutingProvider is present.
 */
export function useEdgeRouting(edgeId) {
  const ctx = useContext(EdgeRoutingContext);
  if (!ctx) return null;
  return ctx.get(edgeId) || null;
}

/**
 * Resolve handle position from nodeInternals handleBounds (DOM-measured).
 * Falls back to port formula when handleBounds is unavailable.
 */
function getHandlePosition(node, handleId, handleType, cfg) {
  const nodeX = node.positionAbsolute?.x ?? node.position.x;
  const nodeY = node.positionAbsolute?.y ?? node.position.y;
  const nodeWidth = node.width ?? node.data?.width ?? cfg.nodeWidth;
  const nodeHeight = node.height ?? node.data?.height ?? cfg.nodeHeight;

  // Try DOM-measured handleBounds first
  const bounds = node.handleBounds;
  if (bounds) {
    const handles = handleType === 'source' ? bounds.source : bounds.target;
    if (handles) {
      const handle = handles.find((h) => h.id === handleId);
      if (handle) {
        return {
          x: nodeX + handle.x + handle.width / 2,
          y: nodeY + handle.y + handle.height / 2,
        };
      }
    }
  }

  // Fallback: compute from SquareNode port formula
  const idx = parseInt((handleId || '').split('-')[1], 10) || 0;

  if (handleType === 'source') {
    const total = node.data?.outputs || 1;
    return {
      x: nodeX + ((idx + 1) / (total + 1)) * nodeWidth,
      y: nodeY + nodeHeight,
    };
  } else {
    const total = node.data?.inputs || 1;
    return {
      x: nodeX + ((idx + 1) / (total + 1)) * nodeWidth,
      y: nodeY,
    };
  }
}

/**
 * Centralized edge routing provider. Place as a child of <ReactFlow>.
 * Computes all orthogonal paths in one pass, applies overlap separation,
 * and distributes results via context so each OrthogonalEdge can read its
 * pre-computed path without redundant calculation.
 */
export default function EdgeRoutingProvider({ children, config }) {
  const nodeInternals = useStore((state) => state.nodeInternals);
  const edges = useEdges();

  const pathMap = useMemo(() => {
    const cfg = { ...DEFAULTS, ...(config || {}) };

    if (!nodeInternals || nodeInternals.size === 0 || edges.length === 0) {
      return new Map();
    }

    const edgePaths = [];

    for (const edge of edges) {
      if (edge.type !== 'orthogonal') continue;

      const sourceNode = nodeInternals.get(edge.source);
      const targetNode = nodeInternals.get(edge.target);
      if (!sourceNode || !targetNode) continue;

      const { x: sourceX, y: sourceY } = getHandlePosition(
        sourceNode,
        edge.sourceHandle,
        'source',
        cfg
      );
      const { x: targetX, y: targetY } = getHandlePosition(
        targetNode,
        edge.targetHandle,
        'target',
        cfg
      );

      // Build obstacle list excluding source and target nodes
      const obstacles = [];
      for (const [id, n] of nodeInternals) {
        if (id === edge.source || id === edge.target) continue;
        obstacles.push({
          id,
          x: n.positionAbsolute?.x ?? n.position.x,
          y: n.positionAbsolute?.y ?? n.position.y,
          width: n.width ?? n.data?.width ?? cfg.nodeWidth,
          height: n.height ?? n.data?.height ?? cfg.nodeHeight,
        });
      }

      const edgeCfg = { ...cfg, ...(edge.data?.routingConfig || {}) };
      const { points } = computeOrthogonalPath(
        sourceX,
        sourceY,
        targetX,
        targetY,
        obstacles,
        edgeCfg
      );

      edgePaths.push({ id: edge.id, points });
    }

    // Apply separation and rounding across all edges
    const separated = separateOverlappingEdges(
      edgePaths,
      cfg.edgeSeparation,
      cfg.bendRadius
    );

    const map = new Map();
    for (const ep of separated) {
      map.set(ep.id, { path: ep.path, points: ep.points });
    }
    return map;
  }, [nodeInternals, edges, config]);

  return (
    <EdgeRoutingContext.Provider value={pathMap}>
      {children}
    </EdgeRoutingContext.Provider>
  );
}
