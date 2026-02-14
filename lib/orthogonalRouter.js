import { DEFAULTS } from './defaults.js';

// ---------- MinHeap priority queue ----------

class MinHeap {
  constructor() {
    this.data = [];
  }

  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].cost < this.data[parent].cost) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }

  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.data[l].cost < this.data[smallest].cost) smallest = l;
      if (r < n && this.data[r].cost < this.data[smallest].cost) smallest = r;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else break;
    }
  }
}

// ---------- Geometry helpers ----------

function inflateObstacles(nodes, padding) {
  return nodes.map((n) => ({
    id: n.id,
    left: n.x - padding,
    right: n.x + n.width + padding,
    top: n.y - padding,
    bottom: n.y + n.height + padding,
  }));
}

function pointStrictlyInsideAnyObstacle(x, y, obstacles) {
  for (const o of obstacles) {
    if (x > o.left && x < o.right && y > o.top && y < o.bottom) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an axis-aligned segment crosses any inflated obstacle.
 * orientation: 'h' (horizontal, fixed y) or 'v' (vertical, fixed x)
 */
function segmentCrossesAnyObstacle(orientation, fixedCoord, start, end, obstacles) {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);

  for (const o of obstacles) {
    if (orientation === 'h') {
      // horizontal segment at y = fixedCoord, from x=lo to x=hi
      if (fixedCoord > o.top && fixedCoord < o.bottom && hi > o.left && lo < o.right) {
        return true;
      }
    } else {
      // vertical segment at x = fixedCoord, from y=lo to y=hi
      if (fixedCoord > o.left && fixedCoord < o.right && hi > o.top && lo < o.bottom) {
        return true;
      }
    }
  }
  return false;
}

// ---------- Path utilities ----------

export function simplifyPath(points) {
  if (points.length <= 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const next = points[i + 1];
    const cur = points[i];
    // Skip collinear intermediate points
    const collinearX = prev.x === cur.x && cur.x === next.x;
    const collinearY = prev.y === cur.y && cur.y === next.y;
    if (collinearX || collinearY) continue;
    result.push(cur);
  }
  result.push(points[points.length - 1]);
  return dedup(result);
}

function dedup(points) {
  if (points.length <= 1) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    if (prev.x !== points[i].x || prev.y !== points[i].y) {
      result.push(points[i]);
    }
  }
  return result;
}

export function waypointsToSvgPath(points, bendRadius = 0) {
  if (!points || points.length === 0) return '';

  // No rounding or too few points for bends
  if (points.length <= 2 || bendRadius <= 0) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];

    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;

    // No bend if segments are collinear
    if ((dx1 === 0 && dx2 === 0) || (dy1 === 0 && dy2 === 0)) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }

    const inLen = Math.abs(dx1) + Math.abs(dy1);  // Manhattan for axis-aligned
    const outLen = Math.abs(dx2) + Math.abs(dy2);

    // Clamp radius to half the shorter adjacent segment
    const r = Math.min(bendRadius, inLen / 2, outLen / 2);

    if (r < 0.5) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }

    // Unit direction vectors (axis-aligned so one component is 0)
    const inDx = dx1 === 0 ? 0 : dx1 / Math.abs(dx1);
    const inDy = dy1 === 0 ? 0 : dy1 / Math.abs(dy1);
    const outDx = dx2 === 0 ? 0 : dx2 / Math.abs(dx2);
    const outDy = dy2 === 0 ? 0 : dy2 / Math.abs(dy2);

    // Arc start: r px before the corner on incoming segment
    const arcStartX = cur.x - inDx * r;
    const arcStartY = cur.y - inDy * r;

    // Arc end: r px after the corner on outgoing segment
    const arcEndX = cur.x + outDx * r;
    const arcEndY = cur.y + outDy * r;

    // Quadratic bezier with control point at the corner
    d += ` L ${arcStartX} ${arcStartY}`;
    d += ` Q ${cur.x} ${cur.y} ${arcEndX} ${arcEndY}`;
  }

  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

// ---------- Stub direction helpers ----------

const STUB_DELTAS = {
  bottom: { dx: 0, dy: 1 },
  top:    { dx: 0, dy: -1 },
  left:   { dx: -1, dy: 0 },
  right:  { dx: 1, dy: 0 },
};

function computeStubEnd(x, y, dir, length) {
  const d = STUB_DELTAS[dir] || STUB_DELTAS.bottom;
  return { x: x + d.dx * length, y: y + d.dy * length };
}

// ---------- Fallback S-shaped path ----------

function fallbackPath(sourceX, sourceY, targetX, targetY, cfg) {
  const srcDir = cfg.sourceDir || 'bottom';
  const tgtDir = cfg.targetDir || 'top';
  const stubSrc = computeStubEnd(sourceX, sourceY, srcDir, cfg.sourceStubLength);
  const stubTgt = computeStubEnd(targetX, targetY, tgtDir, cfg.targetStubLength);

  // For vertical source/target stubs, use midY; for horizontal, use midX
  const srcVertical = srcDir === 'top' || srcDir === 'bottom';
  const tgtVertical = tgtDir === 'top' || tgtDir === 'bottom';

  if (srcVertical && tgtVertical) {
    const midY = (stubSrc.y + stubTgt.y) / 2;
    return [
      { x: sourceX, y: sourceY },
      stubSrc,
      { x: stubSrc.x, y: midY },
      { x: stubTgt.x, y: midY },
      stubTgt,
      { x: targetX, y: targetY },
    ];
  } else if (!srcVertical && !tgtVertical) {
    const midX = (stubSrc.x + stubTgt.x) / 2;
    return [
      { x: sourceX, y: sourceY },
      stubSrc,
      { x: midX, y: stubSrc.y },
      { x: midX, y: stubTgt.y },
      stubTgt,
      { x: targetX, y: targetY },
    ];
  } else {
    // Mixed: one vertical stub, one horizontal — connect via corner
    return [
      { x: sourceX, y: sourceY },
      stubSrc,
      { x: stubTgt.x, y: stubSrc.y },
      stubTgt,
      { x: targetX, y: targetY },
    ];
  }
}

// ---------- Main routing function ----------

export function computeOrthogonalPath(
  sourceX,
  sourceY,
  targetX,
  targetY,
  allNodes,
  config = {}
) {
  const cfg = { ...DEFAULTS, ...config };
  const sourcePort = { x: sourceX, y: sourceY };
  const targetPort = { x: targetX, y: targetY };
  const srcDir = cfg.sourceDir || 'bottom';
  const tgtDir = cfg.targetDir || 'top';
  const sourceStubEnd = computeStubEnd(sourceX, sourceY, srcDir, cfg.sourceStubLength);
  const targetStubStart = computeStubEnd(targetX, targetY, tgtDir, cfg.targetStubLength);

  // Build inflated obstacles
  const obstacles = inflateObstacles(allNodes, cfg.padding);

  // Simple path when stubs nearly overlap (same axis, close together)
  const sameX = Math.abs(sourceStubEnd.x - targetStubStart.x) < 1;
  const sameY = Math.abs(sourceStubEnd.y - targetStubStart.y) < 1;
  const srcVertical = srcDir === 'top' || srcDir === 'bottom';
  const tgtVertical = tgtDir === 'top' || tgtDir === 'bottom';
  if (srcVertical && tgtVertical && sameX && sourceStubEnd.y >= targetStubStart.y) {
    return {
      points: simplifyPath(dedup([sourcePort, sourceStubEnd, targetStubStart, targetPort])),
      path: waypointsToSvgPath(
        simplifyPath(dedup([sourcePort, sourceStubEnd, targetStubStart, targetPort]))
      ),
    };
  }

  // Collect guide coordinates
  const xSet = new Set();
  const ySet = new Set();

  xSet.add(sourceStubEnd.x);
  xSet.add(targetStubStart.x);
  ySet.add(sourceStubEnd.y);
  ySet.add(targetStubStart.y);

  for (const o of obstacles) {
    xSet.add(o.left);
    xSet.add(o.right);
    ySet.add(o.top);
    ySet.add(o.bottom);
  }

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);

  // Generate valid waypoints
  const waypoints = [];
  const wpIndex = new Map(); // "x,y" -> index
  const key = (x, y) => `${x},${y}`;

  function addWaypoint(x, y) {
    const k = key(x, y);
    if (wpIndex.has(k)) return wpIndex.get(k);
    if (pointStrictlyInsideAnyObstacle(x, y, obstacles)) return -1;
    const idx = waypoints.length;
    waypoints.push({ x, y });
    wpIndex.set(k, idx);
    return idx;
  }

  for (const x of xs) {
    for (const y of ys) {
      addWaypoint(x, y);
    }
  }

  // Ensure start and end are in the graph
  const startIdx = addWaypoint(sourceStubEnd.x, sourceStubEnd.y);
  const endIdx = addWaypoint(targetStubStart.x, targetStubStart.y);

  if (startIdx === -1 || endIdx === -1) {
    const pts = fallbackPath(sourceX, sourceY, targetX, targetY, cfg);
    return { points: simplifyPath(pts), path: waypointsToSvgPath(simplifyPath(pts)) };
  }

  // Build adjacency list
  // Group waypoints by x and by y for efficient neighbor finding
  const byX = new Map(); // x -> sorted list of {y, idx}
  const byY = new Map(); // y -> sorted list of {x, idx}

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (!byX.has(wp.x)) byX.set(wp.x, []);
    byX.get(wp.x).push({ y: wp.y, idx: i });
    if (!byY.has(wp.y)) byY.set(wp.y, []);
    byY.get(wp.y).push({ x: wp.x, idx: i });
  }

  for (const arr of byX.values()) arr.sort((a, b) => a.y - b.y);
  for (const arr of byY.values()) arr.sort((a, b) => a.x - b.x);

  // adjacency: index -> [{neighbor, dist}]
  const adj = Array.from({ length: waypoints.length }, () => []);

  // Connect consecutive waypoints on same vertical line (same x)
  for (const [x, list] of byX) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (!segmentCrossesAnyObstacle('v', x, a.y, b.y, obstacles)) {
        const dist = Math.abs(b.y - a.y);
        adj[a.idx].push({ neighbor: b.idx, dist, dir: 'v' });
        adj[b.idx].push({ neighbor: a.idx, dist, dir: 'v' });
      }
    }
  }

  // Connect consecutive waypoints on same horizontal line (same y)
  for (const [y, list] of byY) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (!segmentCrossesAnyObstacle('h', y, a.x, b.x, obstacles)) {
        const dist = Math.abs(b.x - a.x);
        adj[a.idx].push({ neighbor: b.idx, dist, dir: 'h' });
        adj[b.idx].push({ neighbor: a.idx, dist, dir: 'h' });
      }
    }
  }

  // Dijkstra with bend penalty
  const INF = Infinity;
  const dist = new Float64Array(waypoints.length).fill(INF);
  const prev = new Int32Array(waypoints.length).fill(-1);
  const prevDir = new Array(waypoints.length).fill(null);
  const visited = new Uint8Array(waypoints.length);

  dist[startIdx] = 0;
  const heap = new MinHeap();
  heap.push({ cost: 0, idx: startIdx });

  while (heap.size > 0) {
    const { cost, idx } = heap.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (idx === endIdx) break;

    for (const edge of adj[idx]) {
      if (visited[edge.neighbor]) continue;
      let bendCost = 0;
      if (prevDir[idx] !== null && prevDir[idx] !== edge.dir) {
        bendCost = cfg.bendPenalty;
      }
      const newCost = cost + edge.dist + bendCost;
      if (newCost < dist[edge.neighbor]) {
        dist[edge.neighbor] = newCost;
        prev[edge.neighbor] = idx;
        prevDir[edge.neighbor] = edge.dir;
        heap.push({ cost: newCost, idx: edge.neighbor });
      }
    }
  }

  // Reconstruct path
  if (dist[endIdx] === INF) {
    const pts = fallbackPath(sourceX, sourceY, targetX, targetY, cfg);
    return { points: simplifyPath(pts), path: waypointsToSvgPath(simplifyPath(pts)) };
  }

  const pathIndices = [];
  let cur = endIdx;
  while (cur !== -1) {
    pathIndices.push(cur);
    cur = prev[cur];
  }
  pathIndices.reverse();

  const fullPoints = [
    sourcePort,
    sourceStubEnd,
    ...pathIndices.map((i) => waypoints[i]),
    targetStubStart,
    targetPort,
  ];

  const simplified = simplifyPath(dedup(fullPoints));
  return { points: simplified, path: waypointsToSvgPath(simplified, cfg.bendRadius || 0) };
}

// ---------- Edge separation (overlap prevention) ----------

/**
 * Post-process multiple edge paths to prevent visual merging.
 * Detects overlapping collinear segments across edges and applies
 * center-spread perpendicular offsets to keep them visually distinct.
 *
 * @param {Array<{id: string, points: Array<{x:number,y:number}>}>} edgePaths
 * @param {number} separation - px gap between parallel edges
 * @param {number} [bendRadius=0] - optional bend radius for SVG path generation
 * @returns {Array<{id: string, points: Array<{x:number,y:number}>, path: string}>}
 */
export function separateOverlappingEdges(edgePaths, separation, bendRadius = 0) {
  if (separation <= 0 || edgePaths.length <= 1) {
    return edgePaths.map((e) => ({
      ...e,
      path: waypointsToSvgPath(e.points, bendRadius),
    }));
  }

  const EPS = 0.01;

  // Step 1: Extract routable segments from each edge path.
  // Skip stub segments: index 0→1 (source stub) and (len-2)→(len-1) (target stub).
  // Routable segments are indices 1→2, 2→3, ..., (len-3)→(len-2).
  const allSegments = [];

  for (let ei = 0; ei < edgePaths.length; ei++) {
    const pts = edgePaths[ei].points;
    if (pts.length < 4) continue; // need at least 1 routable segment
    for (let si = 1; si < pts.length - 2; si++) {
      const p1 = pts[si];
      const p2 = pts[si + 1];
      const dx = Math.abs(p1.x - p2.x);
      const dy = Math.abs(p1.y - p2.y);

      if (dy < EPS && dx > EPS) {
        // Horizontal segment
        allSegments.push({
          edgeIdx: ei,
          segIdx: si,
          orientation: 'h',
          fixedCoord: p1.y,
          lo: Math.min(p1.x, p2.x),
          hi: Math.max(p1.x, p2.x),
        });
      } else if (dx < EPS && dy > EPS) {
        // Vertical segment
        allSegments.push({
          edgeIdx: ei,
          segIdx: si,
          orientation: 'v',
          fixedCoord: p1.x,
          lo: Math.min(p1.y, p2.y),
          hi: Math.max(p1.y, p2.y),
        });
      }
    }
  }

  // Step 2: Group segments by (orientation, fixedCoord) and find overlapping clusters.
  const groups = new Map();
  for (const seg of allSegments) {
    const key = `${seg.orientation}:${seg.fixedCoord}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(seg);
  }

  // Map: "edgeIdx:segIdx" → perpendicular offset value
  const offsets = new Map();

  for (const segs of groups.values()) {
    if (segs.length < 2) continue;

    // Only care about segments from different edges
    const uniqueEdges = new Set(segs.map((s) => s.edgeIdx));
    if (uniqueEdges.size < 2) continue;

    // Sort by range start to sweep for overlapping clusters
    segs.sort((a, b) => a.lo - b.lo);

    const clusters = [];
    let cluster = [segs[0]];
    let clusterEnd = segs[0].hi;

    for (let i = 1; i < segs.length; i++) {
      if (segs[i].lo <= clusterEnd + EPS) {
        cluster.push(segs[i]);
        clusterEnd = Math.max(clusterEnd, segs[i].hi);
      } else {
        clusters.push(cluster);
        cluster = [segs[i]];
        clusterEnd = segs[i].hi;
      }
    }
    clusters.push(cluster);

    // Assign center-spread offsets within each cluster
    for (const cl of clusters) {
      const seen = new Set();
      const edgeOrder = [];
      for (const s of cl) {
        if (!seen.has(s.edgeIdx)) {
          seen.add(s.edgeIdx);
          edgeOrder.push(s.edgeIdx);
        }
      }
      if (edgeOrder.length < 2) continue;

      const N = edgeOrder.length;
      for (let i = 0; i < N; i++) {
        const offset = (i - (N - 1) / 2) * separation;
        const ei = edgeOrder[i];
        for (const s of cl) {
          if (s.edgeIdx === ei) {
            offsets.set(`${s.edgeIdx}:${s.segIdx}`, offset);
          }
        }
      }
    }
  }

  // Step 3: If no overlaps detected, just generate paths with rounding.
  if (offsets.size === 0) {
    return edgePaths.map((e) => ({
      ...e,
      path: waypointsToSvgPath(e.points, bendRadius),
    }));
  }

  // Step 4: Apply offsets and reconstruct paths.
  return edgePaths.map((edge, ei) => {
    const pts = edge.points;

    // Check if this edge has any offsets
    let hasAny = false;
    for (let i = 1; i < pts.length - 2; i++) {
      if (offsets.has(`${ei}:${i}`)) {
        hasAny = true;
        break;
      }
    }
    if (!hasAny) {
      return { ...edge, path: waypointsToSvgPath(pts, bendRadius) };
    }

    // Clone points for adjustment
    const adjusted = pts.map((p) => ({ x: p.x, y: p.y }));

    for (let i = 1; i < pts.length - 2; i++) {
      const off = offsets.get(`${ei}:${i}`);
      if (off === undefined || off === 0) continue;

      const p1 = pts[i];
      const p2 = pts[i + 1];

      if (Math.abs(p1.y - p2.y) < EPS) {
        // Horizontal segment — offset perpendicular (Y direction)
        // Only offset interior points; stub junctions (index 1, len-2) stay fixed
        if (i >= 2) adjusted[i].y = p1.y + off;
        if (i + 1 <= pts.length - 3) adjusted[i + 1].y = p2.y + off;
      } else if (Math.abs(p1.x - p2.x) < EPS) {
        // Vertical segment — offset perpendicular (X direction)
        if (i >= 2) adjusted[i].x = p1.x + off;
        if (i + 1 <= pts.length - 3) adjusted[i + 1].x = p2.x + off;
      }
    }

    // Ensure orthogonality after offset application.
    // At stub junctions, adjust the stub endpoint to merge smoothly
    // with the offset segment (avoids backwards zigzag).
    // At interior points, insert transition waypoints.
    const result = [adjusted[0]]; // source port — stays fixed
    const lastI = adjusted.length - 1;

    for (let i = 1; i < adjusted.length; i++) {
      const prev = result[result.length - 1];
      const cur = adjusted[i];

      if (Math.abs(prev.x - cur.x) > EPS && Math.abs(prev.y - cur.y) > EPS) {
        // Diagonal detected — fix orthogonality

        if (result.length === 2) {
          // prev is the source stub end. Adjust its Y so the stub
          // extends/shrinks to reach the offset segment smoothly.
          result[result.length - 1] = { x: prev.x, y: cur.y };
        } else if (i === lastI - 1) {
          // cur is the target stub start. Adjust its Y so the stub
          // extends/shrinks to meet the offset segment smoothly.
          adjusted[i] = { x: cur.x, y: prev.y };
          result.push(adjusted[i]);
          i++; // skip to target port
          result.push(adjusted[i]);
          continue;
        } else {
          // Interior transition — insert waypoint
          result.push({ x: prev.x, y: cur.y });
        }
      }
      result.push(cur);
    }

    return { ...edge, points: simplifyPath(result), path: waypointsToSvgPath(simplifyPath(result), bendRadius) };
  });
}
