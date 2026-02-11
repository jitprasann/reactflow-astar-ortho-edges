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

export function waypointsToSvgPath(points) {
  if (!points || points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// ---------- Fallback S-shaped path ----------

function fallbackPath(sourceX, sourceY, targetX, targetY, cfg) {
  const stubSrc = { x: sourceX, y: sourceY + cfg.sourceStubLength };
  const stubTgt = { x: targetX, y: targetY - cfg.targetStubLength };
  const midY = (stubSrc.y + stubTgt.y) / 2;

  return [
    { x: sourceX, y: sourceY },
    stubSrc,
    { x: sourceX, y: midY },
    { x: targetX, y: midY },
    stubTgt,
    { x: targetX, y: targetY },
  ];
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
  const sourceStubEnd = { x: sourceX, y: sourceY + cfg.sourceStubLength };
  const targetStubStart = { x: targetX, y: targetY - cfg.targetStubLength };

  // Build inflated obstacles
  const obstacles = inflateObstacles(allNodes, cfg.padding);

  // If stub end is below stub start (target above source stub), use fallback
  if (sourceStubEnd.y >= targetStubStart.y && Math.abs(sourceX - targetX) < 1) {
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
  return { points: simplified, path: waypointsToSvgPath(simplified) };
}
