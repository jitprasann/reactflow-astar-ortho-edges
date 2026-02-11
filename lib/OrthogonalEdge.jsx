import React from 'react';
import { BaseEdge, useNodes } from 'reactflow';
import { computeOrthogonalPath } from './orthogonalRouter.js';
import { DEFAULTS } from './defaults.js';

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
  const nodes = useNodes();

  const cfg = { ...DEFAULTS, ...(data?.routingConfig || {}) };

  // Convert nodes to simple rects, excluding source and target nodes from obstacles
  const allRects = nodes
    .filter((n) => n.id !== source && n.id !== target)
    .map((n) => ({
      id: n.id,
      x: n.positionAbsolute?.x ?? n.position.x,
      y: n.positionAbsolute?.y ?? n.position.y,
      width: n.width ?? n.data?.width ?? cfg.nodeWidth,
      height: n.height ?? n.data?.height ?? cfg.nodeHeight,
    }));

  const { path } = computeOrthogonalPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    allRects,
    cfg
  );

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: cfg.edgeStrokeColor,
        strokeWidth: cfg.edgeStrokeWidth,
        ...style,
      }}
    />
  );
}
