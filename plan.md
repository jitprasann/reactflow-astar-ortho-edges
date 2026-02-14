# Orthogonal Edge Routing Library — Requirements & Plan

## Status Legend

- [x] Implemented
- [ ] Planned / Not yet implemented

---

## 1. Core Routing Algorithm (`lib/orthogonalRouter.js`)

- [x] Sparse Orthogonal Visibility Graph + Dijkstra pathfinding
- [x] Build inflated bounding boxes around each node with configurable `padding`
- [x] Compute mandatory vertical stub endpoints at source (downward) and target (upward)
- [x] Collect guide coordinates from inflated box edges + port positions
- [x] Generate waypoints at all (x, y) combinations that don't fall strictly inside any inflated rectangle
- [x] Strict inequalities for boundary checks — paths can travel along the padding boundary
- [x] Build adjacency graph connecting consecutive waypoints on same guide line if segment doesn't cross any obstacle
- [x] Dijkstra with configurable bend penalty to minimize direction changes
- [x] Construct full path: `[sourcePort, sourceStubEnd, ...dijkstraPath, targetStubStart, targetPort]`
- [x] Simplify path — remove collinear middle points, deduplicate
- [x] Fallback S-shaped orthogonal path when no obstacle-free route is found
- [x] MinHeap priority queue for Dijkstra
- [x] Pure JavaScript, zero React dependencies
- [x] Sub-millisecond performance for typical graphs (10-50 nodes)
- [x] Complexity: O(N² log N) for N nodes

### Edge Separation (Overlap Prevention)

- [ ] New function `separateOverlappingEdges(edgePaths, separation)` — post-process all computed paths to prevent visual merging
- [ ] **Segment extraction** — for each edge path, extract horizontal and vertical segments from the routable portion (between source stub end and target stub start); stub segments are excluded from nudging
- [ ] **Overlap detection** — two segments from different edges overlap when:
  - Both are horizontal with the same Y coordinate and their X ranges intersect (including touching)
  - Both are vertical with the same X coordinate and their Y ranges intersect (including touching)
- [ ] **Grouping** — group all overlapping collinear segments by their shared coordinate (e.g., all horizontal segments at Y=200 with overlapping X ranges)
- [ ] **Center-spread offset assignment** — for N edges sharing a segment, assign offsets: `(index - (N-1)/2) * edgeSeparation`. E.g., for 3 edges: offsets are `-5, 0, +5` (with edgeSeparation=5)
- [ ] **Offset application** — horizontal segments are offset perpendicular (in Y direction), vertical segments are offset perpendicular (in X direction)
- [ ] **Path reconstruction** — after offsetting segments, reconnect adjacent segments by adjusting shared junction points; the orthogonal nature of the path is preserved since vertical segments bridge between offset horizontal segments and vice versa
- [ ] Stubs (mandatory vertical segments at source/target ports) are NOT nudged — only the routed middle portion is separated
- [ ] Scope: all overlaps across all edges are handled, regardless of whether edges share source/target nodes

---

## 2. Configuration (`lib/defaults.js`)

- [x] `padding` (default: 20) — px clearance between edge paths and node boundaries
- [x] `sourceStubLength` (default: 20) — mandatory vertical segment leaving source port downward
- [x] `targetStubLength` (default: 20) — mandatory vertical segment entering target port from above
- [x] `bendPenalty` (default: 1) — extra cost per direction change in pathfinding
- [x] `nodeWidth` (default: 150) — fallback node width before React Flow measures DOM
- [x] `nodeHeight` (default: 60) — fallback node height before measurement
- [x] `edgeStrokeColor` (default: '#555') — default edge color
- [x] `edgeStrokeWidth` (default: 1.5) — default edge thickness
- [ ] `edgeSeparation` (default: 5) — px gap between parallel/overlapping edges for visual distinction
- [ ] `bendRadius` (default: 8) — px radius for rounded corners at 90° edge bends

### Configuration Override Levels

- [x] **Global** — modify `DEFAULTS` or create custom config object
- [x] **Per-edge** — pass `data.routingConfig` on individual edges

---

## 3. Custom Node (`lib/SquareNode.jsx`)

- [x] Configurable width/height via `data.width`, `data.height`
- [x] Multiple input ports on top edge (Position.Top, type: target)
- [x] Multiple output ports on bottom edge (Position.Bottom, type: source)
- [x] Port positioning formula: port `i` of `N` → `left: ((i+1) / (N+1)) * 100%`
- [x] Unique handle IDs: `input-0`, `input-1`, ..., `output-0`, `output-1`, ...
- [x] Visual selection state (border color change)
- [x] Configurable label via `data.label`

---

## 4. Edge Routing Provider (`lib/EdgeRoutingProvider.jsx`) — NEW

- [ ] React context (`EdgeRoutingContext`) that stores a map of `edgeId → { path, points }`
- [ ] `EdgeRoutingProvider` component — must be placed as a child of `<ReactFlow>`
- [ ] Uses `useStore` from reactflow to access `nodeInternals` (node positions + `handleBounds`)
- [ ] Uses `useEdges()` from reactflow to get all edge definitions
- [ ] For each edge, computes source/target handle positions from `handleBounds`:
  - `absoluteX = node.positionAbsolute.x + handle.x + handle.width / 2`
  - `absoluteY = node.positionAbsolute.y + handle.y + handle.height / 2`
- [ ] Fallback handle position computation when `handleBounds` not yet measured (uses port formula `((i+1) / (N+1)) * nodeWidth` + node data)
- [ ] Builds obstacle rectangles from all nodes, excluding source/target per edge
- [ ] Calls `computeOrthogonalPath()` for every edge in a single pass
- [ ] Calls `separateOverlappingEdges()` on all computed paths to apply edge separation
- [ ] Results memoized via `useMemo` — recomputes only when node positions or edge connections change
- [ ] Real-time re-routing during node drag (provider recomputes on every position change)

---

## 5. Custom Edge (`lib/OrthogonalEdge.jsx`)

- [x] Renders via `<BaseEdge>` from reactflow with arrowhead marker support
- [x] Supports per-edge config override via `data.routingConfig`
- [ ] **Changed**: reads pre-computed separated path from `EdgeRoutingContext` instead of computing independently
- [ ] **Fallback**: if no `EdgeRoutingProvider` is present (context is empty), falls back to independent `computeOrthogonalPath()` call (backwards compatibility)
- [x] Converts nodes to simple `{id, x, y, width, height}` rectangles (used in fallback mode only)

---

## 6. Public API (`lib/index.js`)

- [x] Export `OrthogonalEdge` — custom edge component
- [x] Export `SquareNode` — custom node component
- [x] Export `computeOrthogonalPath` — standalone routing function
- [x] Export `waypointsToSvgPath` — SVG path string generator
- [x] Export `DEFAULTS` — configuration constants
- [ ] Export `EdgeRoutingProvider` — context provider for centralized edge routing with separation

---

## 7. Example App (`example/`)

### Stack

- [x] React 18
- [x] React DOM 18
- [x] reactflow ^11.11 (not `@xyflow/react`)
- [x] Vite 5
- [x] @vitejs/plugin-react 4

### Pre-loaded Graph

- [x] Node N1 at (250, 0) — 0 inputs, 3 outputs
- [x] Node N2 at (100, 150) — 1 input, 1 output
- [x] Node N3 at (400, 150) — 1 input, 1 output
- [x] Node N4 at (250, 300) — 2 inputs, 1 output
- [x] Node N5 at (250, 450) — 2 inputs, 0 outputs

### Pre-loaded Edges

- [x] N1 → N2 (output-0 → input-0)
- [x] N1 → N3 (output-2 → input-0)
- [x] N3 → N4 (output-0 → input-1)
- [x] N2 → N4 (output-0 → input-0)
- [x] N4 → N5 (output-0 → input-0)
- [x] N1 → N5 (output-1 → input-1)
- [x] All edges type `'orthogonal'` with `MarkerType.ArrowClosed`

### Interactive Features

- [x] Add Node button — creates new node with 1 input, 1 output at random position
- [x] Remove Selected button — deletes selected nodes + their connected edges
- [x] Connect nodes by dragging from output handle to input handle (auto-creates orthogonal edge)
- [x] Drag nodes to test real-time edge re-routing
- [x] React Flow `<Controls>` component
- [x] React Flow `<Background>` component
- [x] Delete key support for removing selected elements

### Styling

- [x] Controls panel overlay (top-left, z-index above canvas)
- [x] Node selection highlight (blue border)
- [x] Edge selection highlight (blue, thicker stroke)

---

## 8. Rounded Corners on Edge Bends — NEW

- [ ] `bendRadius` config option (default: 8) — px radius for rounded corners at each 90° bend
- [ ] Modify `waypointsToSvgPath()` to generate SVG arc commands (`A`) or quadratic bezier (`Q`) at bend points instead of sharp `L` corners
- [ ] For each bend point (where direction changes from horizontal↔vertical):
  - Shorten the incoming segment by `bendRadius` px before the bend
  - Shorten the outgoing segment by `bendRadius` px after the bend
  - Insert a rounded arc connecting the two shortened endpoints
- [ ] Guard: if a segment is shorter than `2 * bendRadius`, clamp the radius to half the segment length to prevent overlapping arcs
- [ ] Straight segments (no direction change) are unaffected
- [ ] Works with edge separation — rounded corners apply after overlap nudging

---

## 9. Technical Constraints

- [x] React Flow v11 — package `reactflow` (not `@xyflow/react`)
- [x] `node.width` / `node.height` set directly (not under `node.measured`)
- [x] All imports from `'reactflow'`
- [x] JavaScript only — no TypeScript
- [x] Stubs are mandatory — always render even in fallback path
- [x] Edges must never cross through nodes
- [x] Edges must maintain configurable padding around nodes
- [x] All routing recalculates in real-time during node drag
- [ ] Edges sharing the same path segment must remain visually distinct (never merge into a single line)

---

## 10. Verification Checklist

- [x] `cd example && npm install && npm run dev` starts on localhost
- [ ] Pre-loaded graph renders with all 6 edges routing orthogonally around nodes
- [ ] Drag any node — all connected and nearby edges re-route in real-time
- [ ] Drag N4 between N2 and N3 — edges to N5 route around N4 with padding
- [ ] Click "Add Node", place between existing nodes — existing edges avoid it
- [ ] Connect two nodes by dragging handle-to-handle — new orthogonal edge appears
- [ ] Select node/edge and click "Remove Selected" — removes correctly
- [ ] Edge N1→N5 routes around N2, N3, N4 with visible padding gaps
- [ ] Edges that share a common segment are visually separated (not drawn on top of each other)
- [ ] Overlapping edges show center-spread offset with configurable gap
- [ ] Edge bends have rounded corners (not sharp 90° angles)
- [ ] Rounded corners degrade gracefully on short segments (radius clamped)

---

## 11. Implementation Order

1. [ ] Add `edgeSeparation` and `bendRadius` to `DEFAULTS` in `lib/defaults.js`
2. [ ] Add `separateOverlappingEdges()` function to `lib/orthogonalRouter.js`
3. [ ] Update `waypointsToSvgPath()` in `lib/orthogonalRouter.js` to support rounded corners via `bendRadius`
4. [ ] Create `lib/EdgeRoutingProvider.jsx` — centralized path computation + separation + rounding
5. [ ] Modify `lib/OrthogonalEdge.jsx` — read from context, fallback to standalone computation
6. [ ] Update `lib/index.js` — export `EdgeRoutingProvider`
7. [ ] Update `example/src/App.jsx` — add `<EdgeRoutingProvider>` inside `<ReactFlow>`
8. [ ] Test all verification checklist items

---

## 12. Future Requirements

<!-- Add new requirements below. Use [ ] for planned items. -->
<!-- Example:
- [ ] Edge labels at midpoint
- [ ] Animated edge drawing
- [ ] Export/import graph as JSON
- [ ] Dark mode support
- [ ] Horizontal stub support (left/right ports)
- [ ] Edge grouping / bundling for parallel edges
- [ ] Minimap integration
-->
