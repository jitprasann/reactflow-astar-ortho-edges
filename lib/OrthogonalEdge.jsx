import React from 'react';
import { BaseEdge, useNodes } from 'reactflow';
import { computeOrthogonalPath, waypointsToSvgPath } from './orthogonalRouter.js';
import { DEFAULTS } from './defaults.js';
import { useEdgeRouting } from './EdgeRoutingProvider.jsx';

export default function OrthogonalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  source,
  target,
  data,
  markerEnd,
  style,
}) {
  const cfg = { ...DEFAULTS, ...(data?.routingConfig || {}) };

  // Try pre-computed path from EdgeRoutingProvider (includes separation + rounding)
  const routed = useEdgeRouting(id);

  // Fallback: compute independently when no provider is present
  const nodes = useNodes();
  let edgePath;

  if (routed) {
    edgePath = routed.path;
  } else {
    const allRects = nodes
      .filter((n) => n.id !== source && n.id !== target)
      .map((n) => ({
        id: n.id,
        x: n.positionAbsolute?.x ?? n.position.x,
        y: n.positionAbsolute?.y ?? n.position.y,
        width: n.width ?? n.data?.width ?? cfg.nodeWidth,
        height: n.height ?? n.data?.height ?? cfg.nodeHeight,
      }));

    const { points } = computeOrthogonalPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      allRects,
      cfg
    );
    edgePath = waypointsToSvgPath(points, cfg.bendRadius || 0);
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: cfg.edgeStrokeColor,
        strokeWidth: cfg.edgeStrokeWidth,
        ...style,
      }}
    />
  );
}
