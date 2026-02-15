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
  let edgePoints;

  if (routed) {
    edgePath = routed.path;
    edgePoints = routed.points;
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
    edgePoints = points;
    edgePath = waypointsToSvgPath(points, cfg.bendRadius || 0);
  }

  // --- Edge label ---
  const label = data?.label;
  let labelX, labelY;

  if (label && edgePoints && edgePoints.length >= 2) {
    // Position on the last vertical segment (target stub start → target port)
    const last = edgePoints.length - 1;
    labelX = edgePoints[last].x;
    labelY = (edgePoints[last - 1].y + edgePoints[last].y) / 2 + cfg.edgeLabelOffset;
  }

  // Wrap in a span when user provides a CSS class
  const labelContent = label
    ? (data?.labelClassName
        ? <span className={data.labelClassName}>{label}</span>
        : label)
    : undefined;

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
      label={labelContent}
      labelX={labelX}
      labelY={labelY}
      labelStyle={{
        fontSize: cfg.edgeLabelFontSize,
        ...(data?.labelStyle || {}),
      }}
      labelShowBg={!!label}
      labelBgStyle={{
        fill: cfg.edgeLabelBackground,
      }}
      labelBgPadding={[2, 4]}
      labelBgBorderRadius={2}
    />
  );
}
