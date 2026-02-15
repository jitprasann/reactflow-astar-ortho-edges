import React, { useState, useCallback } from 'react';
import { BaseEdge, EdgeLabelRenderer, useNodes } from 'reactflow';
import { computeOrthogonalPath, waypointsToSvgPath } from './orthogonalRouter.js';
import { DEFAULTS } from './defaults.js';
import { useEdgeRouting } from './EdgeRoutingProvider.jsx';

/**
 * Compute the geometric midpoint of an orthogonal path by walking
 * its segments and finding the point at half the total length.
 */
function pathMidpoint(points) {
  if (!points || points.length < 2) return null;

  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    totalLen += Math.abs(points[i].x - points[i - 1].x)
              + Math.abs(points[i].y - points[i - 1].y);
  }

  let half = totalLen / 2;
  for (let i = 1; i < points.length; i++) {
    const segLen = Math.abs(points[i].x - points[i - 1].x)
                 + Math.abs(points[i].y - points[i - 1].y);
    if (half <= segLen) {
      const t = segLen > 0 ? half / segLen : 0;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    half -= segLen;
  }
  // Fallback: last point
  return points[points.length - 1];
}

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
  selected,
}) {
  const cfg = { ...DEFAULTS, ...(data?.routingConfig || {}) };
  const [hovered, setHovered] = useState(false);

  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);

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

  // --- Selection styling ---
  const edgeStyle = {
    stroke: selected ? cfg.edgeSelectedColor : cfg.edgeStrokeColor,
    strokeWidth: selected ? cfg.edgeSelectedWidth : cfg.edgeStrokeWidth,
    ...style,
  };

  // --- Edge label ---
  const label = data?.label;
  let labelX, labelY;

  if (label && edgePoints && edgePoints.length >= 2) {
    // Position on the last vertical segment (target stub start → target port)
    const last = edgePoints.length - 1;
    labelX = edgePoints[last].x;
    labelY = (edgePoints[last - 1].y + edgePoints[last].y) / 2 + cfg.edgeLabelOffset;
  }

  const labelContent = label
    ? (data?.labelClassName
        ? <span className={data.labelClassName}>{label}</span>
        : label)
    : undefined;

  // --- Delete button ---
  const showDelete = (hovered || selected) && data?.onDeleteEdge;
  const mid = showDelete ? pathMidpoint(edgePoints) : null;

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      if (data?.onDeleteEdge) data.onDeleteEdge(id);
    },
    [data?.onDeleteEdge, id]
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
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
      {/* Wider invisible path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      {showDelete && mid && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {data?.deleteButton || (
              <button
                onClick={handleDelete}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '1px solid #999',
                  background: '#fff',
                  color: '#666',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  lineHeight: 1,
                  padding: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
                title="Delete edge"
              >
                ×
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
