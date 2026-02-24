import React, { useState, useCallback } from 'react';
import { BaseEdge, EdgeLabelRenderer, useNodes } from 'reactflow';
import { computeOrthogonalPath, waypointsToSvgPath } from './orthogonalRouter.js';
import { DEFAULTS } from './defaults.js';
import { useEdgeRouting } from './EdgeRoutingProvider.jsx';
import './orthogonalEdge.css';

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
  const cfg = {
    ...DEFAULTS,
    ...(data?.routingConfig || {}),
    earlyBendBias: data?.label ? (data?.routingConfig?.earlyBendBias ?? DEFAULTS.earlyBendBias) : 0,
  };
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    // Position at the start of the last vertical segment, 8px below
    const last = edgePoints.length - 1;
    labelX = edgePoints[last].x;
    labelY = edgePoints[last - 1].y + 16;
  }

  const labelContent = label
    ? (data?.labelClassName
        ? <span className={data.labelClassName}>{label}</span>
        : label)
    : undefined;

  // --- Midpoint toolbar (delete + inline add) ---
  const mid = (hovered || selected) ? pathMidpoint(edgePoints) : null;
  const hasEdgeMenu = !!data?.renderEdgeMenu;
  const showToolbar = !!(mid && (data?.onDeleteEdge || hasEdgeMenu));

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      if (data?.onDeleteEdge) data.onDeleteEdge(id);
    },
    [data?.onDeleteEdge, id]
  );

  const toggleMenu = useCallback((e) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }, []);

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
      {showToolbar && mid && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            <div className="eq-pipeline-canvas-edge-toolbar">
              {/* Inline add button — only when app provides renderEdgeMenu */}
              {hasEdgeMenu && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={toggleMenu}
                    className="eq-pipeline-canvas-edge-toolbar-btn"
                    title="Add node here"
                  >
                    +
                  </button>
                  {menuOpen && (
                    <div
                      className="eq-pipeline-canvas-edge-toolbar-menu"
                      onMouseEnter={onMouseEnter}
                      onMouseLeave={onMouseLeave}
                      onClick={() => setMenuOpen(false)}
                    >
                      {data.renderEdgeMenu()}
                    </div>
                  )}
                </div>
              )}

              {/* Delete button */}
              {data?.onDeleteEdge && (
                data?.deleteButton || (
                  <button
                    onClick={handleDelete}
                    className="eq-pipeline-canvas-edge-toolbar-btn"
                    title="Delete edge"
                  >
                    ×
                  </button>
                )
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
