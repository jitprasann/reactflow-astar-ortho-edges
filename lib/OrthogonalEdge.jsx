import React, { useState, useCallback } from 'react';
import { BaseEdge, EdgeLabelRenderer, useNodes } from 'reactflow';
import { computeOrthogonalPath, waypointsToSvgPath } from './orthogonalRouter.js';
import { DEFAULTS, resolveNodeX, resolveNodeY, resolveNodeWidth, resolveNodeHeight } from './defaults.js';
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

function resolveEarlyBendBias(data) {
  if (!(data && data.label)) return 0;
  if (data && data.routingConfig && data.routingConfig.earlyBendBias != null) {
    return data.routingConfig.earlyBendBias;
  }
  return DEFAULTS.earlyBendBias;
}

function buildNodeRect(n, cfg) {
  return {
    id: n.id,
    x: resolveNodeX(n),
    y: resolveNodeY(n),
    width: resolveNodeWidth(n, cfg.nodeWidth),
    height: resolveNodeHeight(n, cfg.nodeHeight),
  };
}

function computeFallbackEdgePath(nodes, source, target, sourceX, sourceY, targetX, targetY, cfg) {
  const allRects = nodes
    .filter((n) => n.id !== source && n.id !== target)
    .map((n) => buildNodeRect(n, cfg));

  const { points } = computeOrthogonalPath(
    sourceX, sourceY, targetX, targetY, allRects, cfg
  );
  return {
    edgePoints: points,
    edgePath: waypointsToSvgPath(points, cfg.bendRadius || 0),
  };
}

function resolveLabelContent(data, label) {
  if (!label) return undefined;
  if (data && data.labelClassName) {
    return <span className={data.labelClassName}>{label}</span>;
  }
  return label;
}

function renderEdgeToolbar(data, id, mid, hasEdgeMenu, menuOpen, handlers) {
  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
          pointerEvents: 'all',
        }}
        className="nodrag nopan"
        onMouseEnter={handlers.onMouseEnter}
        onMouseLeave={handlers.onMouseLeave}
      >
        <div className="eq-pipeline-canvas-edge-toolbar">
          {/* Inline add button — only when app provides renderEdgeMenu */}
          {hasEdgeMenu && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={handlers.toggleMenu}
                className="eq-pipeline-canvas-edge-toolbar-btn"
                title="Add node here"
              >
                +
              </button>
              {menuOpen && (
                <div
                  className="eq-pipeline-canvas-edge-toolbar-menu"
                  onMouseEnter={handlers.onMouseEnter}
                  onMouseLeave={handlers.onMouseLeave}
                  onClick={() => handlers.setMenuOpen(false)}
                >
                  {data.renderEdgeMenu()}
                </div>
              )}
            </div>
          )}

          {/* Delete button */}
          {data && data.onDeleteEdge && (
            (data && data.deleteButton) || (
              <button
                onClick={handlers.handleDelete}
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
  );
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
    ...((data && data.routingConfig) || {}),
    earlyBendBias: resolveEarlyBendBias(data),
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
    const result = computeFallbackEdgePath(nodes, source, target, sourceX, sourceY, targetX, targetY, cfg);
    edgePoints = result.edgePoints;
    edgePath = result.edgePath;
  }

  // --- Selection styling ---
  const edgeStyle = {
    stroke: selected ? cfg.edgeSelectedColor : cfg.edgeStrokeColor,
    strokeWidth: selected ? cfg.edgeSelectedWidth : cfg.edgeStrokeWidth,
    ...style,
  };

  // --- Edge label ---
  const label = data && data.label;
  let labelX, labelY;

  if (label && edgePoints && edgePoints.length >= 2) {
    const last = edgePoints.length - 1;
    labelX = edgePoints[last].x;
    labelY = edgePoints[last - 1].y + 16;
  }

  const labelContent = resolveLabelContent(data, label);

  // --- Midpoint toolbar (delete + inline add) ---
  const mid = (hovered || selected) ? pathMidpoint(edgePoints) : null;
  const hasEdgeMenu = !!(data && data.renderEdgeMenu);
  const showToolbar = !!(mid && ((data && data.onDeleteEdge) || hasEdgeMenu));

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      if (data && data.onDeleteEdge) data.onDeleteEdge(id);
    },
    [data && data.onDeleteEdge, id]
  );

  const toggleMenu = useCallback((e) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }, []);

  return (
    <React.Fragment>
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
          ...((data && data.labelStyle) || {}),
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
      {showToolbar && mid && renderEdgeToolbar(data, id, mid, hasEdgeMenu, menuOpen, { toggleMenu, handleDelete, onMouseEnter, onMouseLeave, setMenuOpen })}
    </React.Fragment>
  );
}
