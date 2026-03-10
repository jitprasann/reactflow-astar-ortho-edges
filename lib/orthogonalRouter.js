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
    } else if (fixedCoord > o.left && fixedCoord < o.right && hi > o.top && lo < o.bottom) {
      // vertical segment at x = fixedCoord, from y=lo to y=hi
      return true;
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

// ---------- SVG path helpers ----------

function computeCornerArc(prev, cur, next, bendRadius) {
  const dx1 = cur.x - prev.x;
  const dy1 = cur.y - prev.y;
  const dx2 = next.x - cur.x;
  const dy2 = next.y - cur.y;

  const isCollinear = (dx1 === 0 && dx2 === 0) || (dy1 === 0 && dy2 === 0);
  if (isCollinear) {
    return ` L ${cur.x} ${cur.y}`;
  }

  const inLen = Math.abs(dx1) + Math.abs(dy1);
  const outLen = Math.abs(dx2) + Math.abs(dy2);
  const r = Math.min(bendRadius, inLen / 2, outLen / 2);

  if (r < 0.5) {
    return ` L ${cur.x} ${cur.y}`;
  }

  const inDx = dx1 === 0 ? 0 : dx1 / Math.abs(dx1);
  const inDy = dy1 === 0 ? 0 : dy1 / Math.abs(dy1);
  const outDx = dx2 === 0 ? 0 : dx2 / Math.abs(dx2);
  const outDy = dy2 === 0 ? 0 : dy2 / Math.abs(dy2);

  const arcStartX = cur.x - inDx * r;
  const arcStartY = cur.y - inDy * r;
  const arcEndX = cur.x + outDx * r;
  const arcEndY = cur.y + outDy * r;

  return ` L ${arcStartX} ${arcStartY} Q ${cur.x} ${cur.y} ${arcEndX} ${arcEndY}`;
}

function buildStraightPath(points) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export function waypointsToSvgPath(points, bendRadius = 0) {
  if (!points || points.length === 0) return '';

  if (points.length <= 2 || bendRadius <= 0) {
    return buildStraightPath(points);
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    d += computeCornerArc(points[i - 1], points[i], points[i + 1], bendRadius);
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
  }

  if (!srcVertical && !tgtVertical) {
    const midX = (stubSrc.x + stubTgt.x) / 2;
    return [
      { x: sourceX, y: sourceY },
      stubSrc,
      { x: midX, y: stubSrc.y },
      { x: midX, y: stubTgt.y },
      stubTgt,
      { x: targetX, y: targetY },
    ];
  }

  // Mixed: one vertical stub, one horizontal — connect via corner
  return [
    { x: sourceX, y: sourceY },
    stubSrc,
    { x: stubTgt.x, y: stubSrc.y },
    stubTgt,
    { x: targetX, y: targetY },
  ];
}

// ---------- Visibility graph helpers ----------

function collectGuideCoordinates(sourceStubEnd, targetStubStart, obstacles) {
  const xSet = new Set([sourceStubEnd.x, targetStubStart.x]);
  const ySet = new Set([sourceStubEnd.y, targetStubStart.y]);

  for (const o of obstacles) {
    xSet.add(o.left);
    xSet.add(o.right);
    ySet.add(o.top);
    ySet.add(o.bottom);
  }

  return {
    xs: Array.from(xSet).sort((a, b) => a - b),
    ys: Array.from(ySet).sort((a, b) => a - b),
  };
}

function generateWaypoints(xs, ys, obstacles) {
  const waypoints = [];
  const wpIndex = new Map();

  for (const x of xs) {
    for (const y of ys) {
      if (pointStrictlyInsideAnyObstacle(x, y, obstacles)) continue;
      const idx = waypoints.length;
      waypoints.push({ x, y });
      wpIndex.set(`${x},${y}`, idx);
    }
  }

  return { waypoints, wpIndex };
}

function ensureWaypoint(waypoints, wpIndex, x, y, obstacles) {
  const k = `${x},${y}`;
  if (wpIndex.has(k)) return wpIndex.get(k);
  if (pointStrictlyInsideAnyObstacle(x, y, obstacles)) return -1;
  const idx = waypoints.length;
  waypoints.push({ x, y });
  wpIndex.set(k, idx);
  return idx;
}

function groupWaypointsByAxis(waypoints) {
  const byX = new Map();
  const byY = new Map();

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (!byX.has(wp.x)) byX.set(wp.x, []);
    byX.get(wp.x).push({ y: wp.y, idx: i });
    if (!byY.has(wp.y)) byY.set(wp.y, []);
    byY.get(wp.y).push({ x: wp.x, idx: i });
  }

  for (const arr of byX.values()) arr.sort((a, b) => a.y - b.y);
  for (const arr of byY.values()) arr.sort((a, b) => a.x - b.x);

  return { byX, byY };
}

function connectAlignedWaypoints(grouped, orientation, obstacles, adj) {
  for (const [fixedCoord, list] of grouped) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      const aVar = orientation === 'v' ? a.y : a.x;
      const bVar = orientation === 'v' ? b.y : b.x;
      if (segmentCrossesAnyObstacle(orientation, fixedCoord, aVar, bVar, obstacles)) continue;
      const dist = Math.abs(bVar - aVar);
      adj[a.idx].push({ neighbor: b.idx, dist, dir: orientation });
      adj[b.idx].push({ neighbor: a.idx, dist, dir: orientation });
    }
  }
}

function buildAdjacencyList(waypoints, obstacles) {
  const { byX, byY } = groupWaypointsByAxis(waypoints);
  const adj = Array.from({ length: waypoints.length }, () => []);
  connectAlignedWaypoints(byX, 'v', obstacles, adj);
  connectAlignedWaypoints(byY, 'h', obstacles, adj);
  return adj;
}

// ---------- Dijkstra helpers ----------

function relaxEdge(edge, idx, cost, state, cfg, ctx, heap) {
  if (state.visited[edge.neighbor]) return;
  let bendCost = 0;
  if (state.prevDir[idx] !== null && state.prevDir[idx] !== edge.dir) {
    bendCost = cfg.bendPenalty;
  }
  let earlyBendCost = 0;
  if (ctx.srcVertical && edge.dir === 'h') {
    earlyBendCost = Math.max(0, ctx.waypoints[idx].y - ctx.sourceStubEnd.y) * cfg.earlyBendBias;
  }
  const newCost = cost + edge.dist + bendCost + earlyBendCost;
  if (newCost < state.dist[edge.neighbor]) {
    state.dist[edge.neighbor] = newCost;
    state.prev[edge.neighbor] = idx;
    state.prevDir[edge.neighbor] = edge.dir;
    heap.push({ cost: newCost, idx: edge.neighbor });
  }
}

function runDijkstra(adj, startIdx, endIdx, waypoints, cfg, srcVertical, sourceStubEnd) {
  const state = {
    dist: new Float64Array(waypoints.length).fill(Infinity),
    prev: new Int32Array(waypoints.length).fill(-1),
    prevDir: new Array(waypoints.length).fill(null),
    visited: new Uint8Array(waypoints.length),
  };

  state.dist[startIdx] = 0;
  const stubDir = srcVertical ? 'v' : 'h';
  state.prevDir[startIdx] = cfg.earlyBendBias > 0 ? null : stubDir;
  const heap = new MinHeap();
  heap.push({ cost: 0, idx: startIdx });

  const ctx = { srcVertical, waypoints, sourceStubEnd };

  while (heap.size > 0) {
    const { cost, idx } = heap.pop();
    if (state.visited[idx]) continue;
    state.visited[idx] = 1;
    if (idx === endIdx) break;

    for (const edge of adj[idx]) {
      relaxEdge(edge, idx, cost, state, cfg, ctx, heap);
    }
  }

  return state;
}

function reconstructPath(prev, endIdx) {
  const pathIndices = [];
  let cur = endIdx;
  while (cur !== -1) {
    pathIndices.push(cur);
    cur = prev[cur];
  }
  pathIndices.reverse();
  return pathIndices;
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
  const srcVertical = srcDir === 'top' || srcDir === 'bottom';
  const tgtVertical = tgtDir === 'top' || tgtDir === 'bottom';
  if (srcVertical && tgtVertical && sameX && sourceStubEnd.y >= targetStubStart.y) {
    const pts = simplifyPath(dedup([sourcePort, sourceStubEnd, targetStubStart, targetPort]));
    return { points: pts, path: waypointsToSvgPath(pts) };
  }

  // Collect guide coordinates and generate waypoints
  const { xs, ys } = collectGuideCoordinates(sourceStubEnd, targetStubStart, obstacles);
  const { waypoints, wpIndex } = generateWaypoints(xs, ys, obstacles);

  // Ensure start and end are in the graph
  const startIdx = ensureWaypoint(waypoints, wpIndex, sourceStubEnd.x, sourceStubEnd.y, obstacles);
  const endIdx = ensureWaypoint(waypoints, wpIndex, targetStubStart.x, targetStubStart.y, obstacles);

  if (startIdx === -1 || endIdx === -1) {
    const pts = simplifyPath(fallbackPath(sourceX, sourceY, targetX, targetY, cfg));
    return { points: pts, path: waypointsToSvgPath(pts) };
  }

  // Build adjacency list and run Dijkstra
  const adj = buildAdjacencyList(waypoints, obstacles);
  const state = runDijkstra(adj, startIdx, endIdx, waypoints, cfg, srcVertical, sourceStubEnd);

  if (state.dist[endIdx] === Infinity) {
    const pts = simplifyPath(fallbackPath(sourceX, sourceY, targetX, targetY, cfg));
    return { points: pts, path: waypointsToSvgPath(pts) };
  }

  const pathIndices = reconstructPath(state.prev, endIdx);
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

// ---------- Edge separation helpers ----------

function collectRoutableSegments(edgePaths) {
  const EPS = 0.01;
  const allSegments = [];

  for (let ei = 0; ei < edgePaths.length; ei++) {
    const pts = edgePaths[ei].points;
    if (pts.length < 4) continue;
    for (let si = 1; si < pts.length - 2; si++) {
      const p1 = pts[si];
      const p2 = pts[si + 1];
      const dx = Math.abs(p1.x - p2.x);
      const dy = Math.abs(p1.y - p2.y);

      if (dy < EPS && dx > EPS) {
        allSegments.push({
          edgeIdx: ei, segIdx: si, orientation: 'h',
          fixedCoord: p1.y, lo: Math.min(p1.x, p2.x), hi: Math.max(p1.x, p2.x),
        });
      } else if (dx < EPS && dy > EPS) {
        allSegments.push({
          edgeIdx: ei, segIdx: si, orientation: 'v',
          fixedCoord: p1.x, lo: Math.min(p1.y, p2.y), hi: Math.max(p1.y, p2.y),
        });
      }
    }
  }

  return allSegments;
}

function buildOverlapClusters(segs, EPS) {
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
  return clusters;
}

function assignClusterOffsets(cluster, separation, offsets) {
  const seen = new Set();
  const edgeOrder = [];
  for (const s of cluster) {
    if (!seen.has(s.edgeIdx)) {
      seen.add(s.edgeIdx);
      edgeOrder.push(s.edgeIdx);
    }
  }
  if (edgeOrder.length < 2) return;

  const N = edgeOrder.length;
  for (let i = 0; i < N; i++) {
    const offset = (i - (N - 1) / 2) * separation;
    const ei = edgeOrder[i];
    for (const s of cluster) {
      if (s.edgeIdx === ei) {
        offsets.set(`${s.edgeIdx}:${s.segIdx}`, offset);
      }
    }
  }
}

function computeSegmentOffsets(allSegments, separation) {
  const EPS = 0.01;
  const groups = new Map();
  for (const seg of allSegments) {
    const key = `${seg.orientation}:${seg.fixedCoord}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(seg);
  }

  const offsets = new Map();

  for (const segs of groups.values()) {
    if (segs.length < 2) continue;
    const uniqueEdges = new Set(segs.map((s) => s.edgeIdx));
    if (uniqueEdges.size < 2) continue;

    segs.sort((a, b) => a.lo - b.lo);
    const clusters = buildOverlapClusters(segs, EPS);

    for (const cl of clusters) {
      assignClusterOffsets(cl, separation, offsets);
    }
  }

  return offsets;
}

function offsetSegment(adjusted, pts, i, off, EPS) {
  const p1 = pts[i];
  const p2 = pts[i + 1];

  if (Math.abs(p1.y - p2.y) < EPS) {
    // Horizontal segment — offset perpendicular (Y direction)
    if (i >= 2) adjusted[i].y = p1.y + off;
    if (i + 1 <= pts.length - 3) adjusted[i + 1].y = p2.y + off;
  } else if (Math.abs(p1.x - p2.x) < EPS) {
    // Vertical segment — offset perpendicular (X direction)
    if (i >= 2) adjusted[i].x = p1.x + off;
    if (i + 1 <= pts.length - 3) adjusted[i + 1].x = p2.x + off;
  }
}

function applyPerpendicularOffsets(adjusted, pts, ei, offsets, EPS) {
  for (let i = 1; i < pts.length - 2; i++) {
    const off = offsets.get(`${ei}:${i}`);
    if (off === undefined || off === 0) continue;
    offsetSegment(adjusted, pts, i, off, EPS);
  }
}

function fixOrthogonality(adjusted, EPS) {
  const result = [adjusted[0]];
  const lastI = adjusted.length - 1;

  for (let i = 1; i < adjusted.length; i++) {
    const prev = result[result.length - 1];
    const cur = adjusted[i];
    const isDiagonal = Math.abs(prev.x - cur.x) > EPS && Math.abs(prev.y - cur.y) > EPS;

    if (isDiagonal) {
      if (result.length === 2) {
        // prev is the source stub end. Adjust its Y so the stub
        // extends/shrinks to reach the offset segment smoothly.
        result[result.length - 1] = { x: prev.x, y: cur.y };
      } else if (i === lastI - 1) {
        // Target stub junction — insert transition waypoint
        result.push({ x: prev.x, y: cur.y });
        result.push(cur);
        result.push(adjusted[i + 1]); // target port
        break;
      } else {
        // Interior transition — insert waypoint
        result.push({ x: prev.x, y: cur.y });
      }
    }
    result.push(cur);
  }

  return result;
}

function applyOffsetsToEdge(edge, ei, offsets, bendRadius) {
  const EPS = 0.01;
  const pts = edge.points;

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
  applyPerpendicularOffsets(adjusted, pts, ei, offsets, EPS);
  const result = fixOrthogonality(adjusted, EPS);

  return { ...edge, points: simplifyPath(result), path: waypointsToSvgPath(simplifyPath(result), bendRadius) };
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

  const allSegments = collectRoutableSegments(edgePaths);
  const offsets = computeSegmentOffsets(allSegments, separation);

  if (offsets.size === 0) {
    return edgePaths.map((e) => ({
      ...e,
      path: waypointsToSvgPath(e.points, bendRadius),
    }));
  }

  return edgePaths.map((edge, ei) => applyOffsetsToEdge(edge, ei, offsets, bendRadius));
}
