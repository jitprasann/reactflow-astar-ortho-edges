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

- [x] New function `separateOverlappingEdges(edgePaths, separation)` — post-process all computed paths to prevent visual merging
- [x] **Segment extraction** — for each edge path, extract horizontal and vertical segments from the routable portion (between source stub end and target stub start); stub segments are excluded from nudging
- [x] **Overlap detection** — two segments from different edges overlap when:
  - Both are horizontal with the same Y coordinate and their X ranges intersect (including touching)
  - Both are vertical with the same X coordinate and their Y ranges intersect (including touching)
- [x] **Grouping** — group all overlapping collinear segments by their shared coordinate (e.g., all horizontal segments at Y=200 with overlapping X ranges)
- [x] **Center-spread offset assignment** — for N edges sharing a segment, assign offsets: `(index - (N-1)/2) * edgeSeparation`. E.g., for 3 edges: offsets are `-5, 0, +5` (with edgeSeparation=5)
- [x] **Offset application** — horizontal segments are offset perpendicular (in Y direction), vertical segments are offset perpendicular (in X direction)
- [x] **Path reconstruction** — after offsetting segments, reconnect adjacent segments by adjusting shared junction points; the orthogonal nature of the path is preserved since vertical segments bridge between offset horizontal segments and vice versa
- [x] Stubs (mandatory vertical segments at source/target ports) are NOT nudged — only the routed middle portion is separated
- [x] Scope: all overlaps across all edges are handled, regardless of whether edges share source/target nodes

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
- [x] `edgeSeparation` (default: 5) — px gap between parallel/overlapping edges for visual distinction
- [x] `bendRadius` (default: 8) — px radius for rounded corners at 90° edge bends
- [x] `horizontalGap` (default: 40) — px horizontal spacing between sibling branch nodes in layout
- [x] `verticalGap` (default: 60) — px vertical spacing between parent and child rows in layout

### Configuration Override Levels

- [x] **Global** — modify `DEFAULTS` or create custom config object
- [x] **Per-edge** — pass `data.routingConfig` on individual edges

---

## 3. Custom Nodes

### SquareNode (`lib/SquareNode.jsx`)

- [x] Configurable width/height via `data.width`, `data.height`
- [x] Multiple input ports on top edge (Position.Top, type: target)
- [x] Multiple output ports on bottom edge (Position.Bottom, type: source)
- [x] Port positioning formula: `offset = (i - (count-1)/2) * 8` — 8px apart, centered
- [x] Unique handle IDs: `input-0`, `input-1`, ..., `output-0`, `output-1`, ...
- [x] Visual selection state (border color change)
- [x] Configurable label via `data.label`
- [x] Handles are invisible (opacity 0, transparent, 1px, pointerEvents none)
- [x] `useUpdateNodeInternals` — forces React Flow to re-measure handles when inputs/outputs count changes
- [x] AddNodeMenu integration — "+" button for adding nodes/branches from this node

### BranchNode (`lib/BranchNode.jsx`)

- [x] Same handle positioning and invisible handle styling as SquareNode (8px apart, centered)
- [x] `useUpdateNodeInternals` — same pattern as SquareNode
- [x] Expand/collapse toggle button (bottom-right corner, +/− icon)
- [x] `data.onToggleCollapse(nodeId, collapsed)` callback
- [x] AddNodeMenu integration

### MergeNode (`lib/MergeNode.jsx`)

- [x] Circular node component for merge points
- [x] `data.isMerge = true` flag for layout engine detection
- [x] Fixed handles (input-0 full-circle overlay, output-0 visible dot)
- [x] Dynamic entry side computation based on source position (left/right/top)

---

## 4. Edge Routing Provider (`lib/EdgeRoutingProvider.jsx`)

- [x] React context (`EdgeRoutingContext`) that stores a map of `edgeId → { path, points }`
- [x] `EdgeRoutingProvider` component — placed as wrapper around ReactFlow
- [x] Uses `useStore` from reactflow to access `nodeInternals` (node positions + `handleBounds`)
- [x] Uses `useEdges()` from reactflow to get all edge definitions
- [x] For each edge, computes source/target handle positions from `handleBounds`
- [x] Fallback handle position computation matching the 8px-apart centered formula:
  - `offset = (idx - (total - 1) / 2) * 8`
  - Source: `x = nodeX + nodeWidth/2 + offset`, `y = nodeY + nodeHeight`
  - Target: `x = nodeX + nodeWidth/2 + offset`, `y = nodeY`
- [x] Merge node: dynamic entry side computation via `getMergeTargetInfo()`
- [x] Builds obstacle rectangles from all nodes, excluding source/target per edge
- [x] Calls `computeOrthogonalPath()` for every edge in a single pass
- [x] Calls `separateOverlappingEdges()` on all computed paths to apply edge separation
- [x] Results memoized via `useMemo`
- [x] Real-time re-routing during node drag

---

## 5. Custom Edge (`lib/OrthogonalEdge.jsx`)

- [x] Renders via `<BaseEdge>` from reactflow with arrowhead marker support
- [x] Supports per-edge config override via `data.routingConfig`
- [x] Reads pre-computed separated path from `EdgeRoutingContext`
- [x] Fallback: if no `EdgeRoutingProvider`, falls back to independent computation
- [x] Edge labels on horizontal segments (via `data.label`)
- [x] Edge selection highlight (blue, thicker stroke)
- [x] Delete button on edge hover/selection at midpoint
- [x] Add node inline button ("+" on edges)
- [x] `data.onDeleteEdge(edgeId)` callback
- [x] `data.onAddNodeInline(edgeId, type)` callback

---

## 6. Layout Engine

### Dagre Layout (`lib/dagreLayout.js`)

- [x] Uses dagre for layered graph layout (top-to-bottom)
- [x] `layoutGraphDagre(nodes, edges, config?)` — positions all nodes
- [x] Respects `horizontalGap` and `verticalGap` from config
- [x] Used for full re-layout and mini-layout of subgraphs

### ELK Layout (`lib/layoutEngine.js`)

- [x] ELK-based layout engine (elkjs) — alternative layout option
- [x] `buildElkGraph(nodes, edges, cfg, interactive)` — converts React Flow to ELK format
- [x] Explicit ports per node with FIXED_POS constraint
- [x] Port positions use same 8px-apart centered formula as handles
- [x] `LONGEST_PATH_SOURCE` layering strategy — same-depth siblings on same layer
- [x] `BRANDES_KOEPF` with `BALANCED` alignment for node placement
- [x] `ORTHOGONAL` edge routing (ELK routing unused, ours used instead)
- [x] `NODES_AND_EDGES` model order strategy
- [x] Interactive mode support with semi-interactive crossing minimization
- [x] `layoutGraph(nodes, edges, config)` — async full layout
- [x] `addNodesToLayout(existingNodes, existingEdges, parentId, newNodes, newEdges, config)` — incremental layout

### Collapse/Expand (`lib/layoutEngine.js`)

- [x] `getVisibleGraph(nodes, edges)` — filters collapsed nodes/edges, generates bypass edges
- [x] Full group collapse: branch node `data.collapsed = true` hides all nodes between branch and merge
- [x] Per-branch collapse: individual branch child `data.collapsed = true` hides that branch path only
- [x] `findMergeNode(branchId)` — BFS to find merge node reachable from all branches
- [x] `collectBetween(startId, mergeId)` — collects nodes between branch and merge
- [x] `collectBranchPath(branchChildId, mergeId)` — collects single branch path
- [x] Bypass edges: direct edge from branch node to merge node's child when collapsed

---

## 7. Public API (`lib/index.js`)

- [x] Export `OrthogonalEdge` — custom edge component
- [x] Export `SquareNode` — custom node component
- [x] Export `MergeNode` — circular merge node component
- [x] Export `BranchNode` — branch node with collapse toggle
- [x] Export `computeOrthogonalPath` — standalone routing function
- [x] Export `waypointsToSvgPath` — SVG path string generator
- [x] Export `DEFAULTS` — configuration constants
- [x] Export `EdgeRoutingProvider` — context provider for centralized edge routing
- [x] Export `getVisibleGraph` — collapse/expand visibility computation
- [x] Export `layoutGraphDagre` — dagre-based layout
- [x] Export `layoutGraph` — ELK-based layout (async)
- [x] Export `addNodesToLayout` — incremental ELK layout (async)

---

## 8. Example App (`example/src/App.jsx`)

### Stack

- [x] React 18
- [x] React DOM 18
- [x] reactflow ^11.11 (not `@xyflow/react`)
- [x] Vite 5
- [x] @vitejs/plugin-react 4

### Pre-loaded Graph

- [x] Branching flow: Start → Branch → (If, ElseIf, Else) → Merge → End
- [x] No explicit inputs/outputs — derived from edges at render time via `injectHandleCounts`
- [x] Edge labels on branch outputs ("If", "Else If", "Else")
- [x] Initial positions computed via `layoutGraphDagre`

### Dynamic Node/Edge Management

- [x] **Edge-driven handles**: `inputs`/`outputs` counts derived from edges, not stored explicitly
- [x] `injectHandleCounts(nodes, edges)` — stamps handle counts into node data from edge analysis
- [x] **Stale closure prevention**: `nodesRef` and `edgesRef` refs updated on every render, used in all callbacks with `[]` dependency arrays

### Add Node from Node ("+" button on nodes)

- [x] `onAddNode(parentId, type)` — adds a node or branch structure as new output from parent
- [x] Type "node": creates single SquareNode connected to parent
- [x] Type "branch": creates Branch + If + Else + Merge structure
- [x] **Branch-aware addition**: when parent is a branch node:
  - Edge gets label "Condition N" (N = output index + 1)
  - BFS finds the branch's merge node
  - New node auto-connected to merge node
- [x] **Mini dagre layout**: only parent + existing siblings + new nodes are laid out
  - Parent position stays fixed (delta applied)
  - Only siblings and new nodes get repositioned
  - Rest of graph untouched

### Add Node on Edge ("+" button on edges)

- [x] `onAddNodeInline(edgeId, type)` — inserts node/branch structure between edge source and target
- [x] Removes original edge, rewires through new structure
- [x] Uses `placeNewNodes` for positioning
- [x] Downstream nodes shifted down to make room

### Connect to Existing Node

- [x] `onConnectToExisting(sourceNodeId, targetNodeId)` — creates edge with next available handles
- [x] AddNodeMenu on each node shows "Connect to" section with other visible non-merge nodes

### Delete Edge

- [x] `onDeleteEdge(edgeId)` — removes edge and re-indexes remaining handles
- [x] Source handles re-indexed to close gaps (contiguous output-0, output-1, ...)
- [x] Target handles re-indexed similarly (contiguous input-0, input-1, ...)
- [x] Node handle counts updated via `injectHandleCounts`

### Collapse/Expand

- [x] `onToggleCollapse(nodeId, collapsed)` — toggles branch collapse state
- [x] Runs `getVisibleGraph` to compute visible nodes/edges
- [x] Re-layouts visible nodes via `layoutGraphDagre`
- [x] Position map applied back to full node set

### Other Features

- [x] Re-Layout button — full dagre layout of all nodes
- [x] Manual drag support — positions preserved until re-layout
- [x] Connect nodes by handle drag
- [x] Delete key support
- [x] React Flow Controls and Background components

---

## 9. Rounded Corners on Edge Bends

- [x] `bendRadius` config option (default: 8) — px radius for rounded corners at each 90° bend
- [x] Modify `waypointsToSvgPath()` to generate quadratic bezier (`Q`) at bend points instead of sharp `L` corners
- [x] For each bend point (where direction changes from horizontal↔vertical):
  - Shorten the incoming segment by `bendRadius` px before the bend
  - Shorten the outgoing segment by `bendRadius` px after the bend
  - Insert a rounded arc connecting the two shortened endpoints
- [x] Guard: if a segment is shorter than `2 * bendRadius`, clamp the radius to half the segment length to prevent overlapping arcs
- [x] Straight segments (no direction change) are unaffected
- [x] Works with edge separation — rounded corners apply after overlap nudging

---

## 10. Technical Constraints

- [x] React Flow v11 — package `reactflow` (not `@xyflow/react`)
- [x] `node.width` / `node.height` set directly (not under `node.measured`)
- [x] All imports from `'reactflow'`
- [x] JavaScript only — no TypeScript
- [x] Stubs are mandatory — always render even in fallback path
- [x] Edges must never cross through nodes
- [x] Edges must maintain configurable padding around nodes
- [x] All routing recalculates in real-time during node drag
- [x] Edges sharing the same path segment must remain visually distinct (never merge into a single line)

---

## 11. Key Implementation Details

### Handle Positioning Consistency

The handle position formula **must be identical** in all 4 places:
1. `SquareNode.jsx` — CSS `left: calc(50% + ${offset}px)`
2. `BranchNode.jsx` — CSS `left: calc(50% + ${offset}px)`
3. `EdgeRoutingProvider.jsx` — fallback computation `nodeX + nodeWidth/2 + offset`
4. `layoutEngine.js` — ELK port positions `nodeWidth/2 + offset`

Formula: `offset = (i - (count - 1) / 2) * 8`
- 1 handle: center (offset = 0)
- 2 handles: -4px and +4px from center
- 3 handles: -8px, 0, +8px from center

### React Flow Handle Re-measurement

- React Flow caches `handleBounds` and only updates via `ResizeObserver` on dimension changes
- When handles are added/removed dynamically (changing `data.inputs`/`data.outputs`), node dimensions don't change
- Each node component (SquareNode, BranchNode) calls `useUpdateNodeInternals(id)` when handle counts change
- This forces React Flow to re-measure handle positions for correct edge connections

### Edge-Driven Handle Architecture

- Handle counts are NOT stored in node data — they're derived from edges
- `injectHandleCounts(nodes, edges)` scans all edges and stamps `inputs`/`outputs` into node data
- On edge deletion, remaining handles are re-indexed to stay contiguous (no gaps)
- This ensures handle IDs always match between nodes and edges

---

## 12. Implementation Phases

### Phase 1: Core Routing + Edge Separation + Rounding (COMPLETE)

1. [x] Core orthogonal routing algorithm
2. [x] Edge separation / overlap prevention
3. [x] Rounded corners on bends
4. [x] EdgeRoutingProvider for centralized computation
5. [x] OrthogonalEdge component

### Phase 2: Layout Engine + Node Components (COMPLETE)

6. [x] Dagre layout engine (`lib/dagreLayout.js`)
7. [x] ELK layout engine (`lib/layoutEngine.js`)
8. [x] SquareNode with dynamic handles + useUpdateNodeInternals
9. [x] BranchNode with collapse toggle + dynamic handles
10. [x] MergeNode (circular, dynamic entry side)
11. [x] Collapse/expand logic (`getVisibleGraph`)

### Phase 3: Dynamic Graph Operations (COMPLETE)

12. [x] Add node from node (+ button, mini layout)
13. [x] Add node inline on edge (+ button)
14. [x] Connect to existing node
15. [x] Delete edge with handle re-indexing
16. [x] Branch-aware node addition (auto-label + merge connection)
17. [x] Edge labels
18. [x] Edge selection + delete button
19. [x] Edge-driven handle architecture (injectHandleCounts)

---

## 13. Future Requirements

<!-- Add new requirements below. Use [ ] for planned items. -->
<!-- Example:
- [ ] Animated edge drawing
- [ ] Export/import graph as JSON
- [ ] Dark mode support
- [ ] Horizontal stub support (left/right ports)
- [ ] Edge grouping / bundling for parallel edges
- [ ] Minimap integration
-->
