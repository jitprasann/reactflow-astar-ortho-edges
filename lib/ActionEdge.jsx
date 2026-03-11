import React from 'react';
import { BaseEdge } from 'reactflow';
import { waypointsToSvgPath } from './orthogonalRouter.js';
import { DEFAULTS } from './defaults.js';

/**
 * ActionEdge — orthogonal edge connecting a node to its action "+" button.
 *
 * Draws a right-angle path:
 *   - Straight down from source
 *   - Horizontal turn toward target
 *   - Straight down into target
 *
 * When source and target are vertically aligned, draws a simple vertical line.
 */
export default function ActionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}) {
  const bendRadius = DEFAULTS.bendRadius;
  const points = [];

  if (Math.abs(sourceX - targetX) < 1) {
    // Vertically aligned — straight line
    points.push({ x: sourceX, y: sourceY });
    points.push({ x: targetX, y: targetY });
  } else {
    // L-shaped or Z-shaped orthogonal path
    const midY = sourceY + (targetY - sourceY) / 2;
    points.push({ x: sourceX, y: sourceY });
    points.push({ x: sourceX, y: midY });
    points.push({ x: targetX, y: midY });
    points.push({ x: targetX, y: targetY });
  }

  const edgePath = waypointsToSvgPath(points, bendRadius);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#999',
        strokeWidth: 1,
        strokeDasharray: '4 3',
        ...style,
      }}
    />
  );
}
