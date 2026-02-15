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
- [ ] `horizontalGap` (default: 40) — px horizontal spacing between sibling branch nodes in layout
- [ ] `verticalGap` (default: 60) — px vertical spacing between parent and child rows in layout

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

## 4. Edge Routing Provider (`lib/EdgeRoutingProvider.jsx`)

- [x] React context (`EdgeRoutingContext`) that stores a map of `edgeId → { path, points }`
- [x] `EdgeRoutingProvider` component — must be placed between `<ReactFlowProvider>` and `<ReactFlow>` (NOT as child of ReactFlow, since edge components are rendered in a separate SVG tree)
- [x] Uses `useStore` from reactflow to access `nodeInternals` (node positions + `handleBounds`)
- [x] Uses `useEdges()` from reactflow to get all edge definitions
- [x] For each edge, computes source/target handle positions from `handleBounds`:
  - `absoluteX = node.positionAbsolute.x + handle.x + handle.width / 2`
  - `absoluteY = node.positionAbsolute.y + handle.y + handle.height / 2`
- [x] Fallback handle position computation when `handleBounds` not yet measured (uses port formula `((i+1) / (N+1)) * nodeWidth` + node data)
- [x] Builds obstacle rectangles from all nodes, excluding source/target per edge
- [x] Calls `computeOrthogonalPath()` for every edge in a single pass
- [x] Calls `separateOverlappingEdges()` on all computed paths to apply edge separation
- [x] Results memoized via `useMemo` — recomputes only when node positions or edge connections change
- [x] Real-time re-routing during node drag (provider recomputes on every position change)

---

## 5. Custom Edge (`lib/OrthogonalEdge.jsx`)

- [x] Renders via `<BaseEdge>` from reactflow with arrowhead marker support
- [x] Supports per-edge config override via `data.routingConfig`
- [x] **Changed**: reads pre-computed separated path from `EdgeRoutingContext` instead of computing independently
- [x] **Fallback**: if no `EdgeRoutingProvider` is present (context is empty), falls back to independent `computeOrthogonalPath()` call (backwards compatibility)
- [x] Converts nodes to simple `{id, x, y, width, height}` rectangles (used in fallback mode only)

---

## 6. Public API (`lib/index.js`)

- [x] Export `OrthogonalEdge` — custom edge component
- [x] Export `SquareNode` — custom node component
- [x] Export `computeOrthogonalPath` — standalone routing function
- [x] Export `waypointsToSvgPath` — SVG path string generator
- [x] Export `DEFAULTS` — configuration constants
- [x] Export `EdgeRoutingProvider` — context provider for centralized edge routing with separation
- [ ] Export `layoutGraph` — compute positions for all nodes from scratch
- [ ] Export `addNodesToLayout` — incremental layout: add nodes below a parent, push children down
- [ ] Export `useAutoLayout` — React hook integrating layout engine with React Flow
- [ ] Export `MergeNode` — circular merge node component

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

## 8. Rounded Corners on Edge Bends

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

## 9. Technical Constraints

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

## 10. Verification Checklist

- [x] `cd example && npm install && npm run dev` starts on localhost
- [x] Pre-loaded graph renders with all 6 edges routing orthogonally around nodes
- [x] Drag any node — all connected and nearby edges re-route in real-time
- [x] Drag N4 between N2 and N3 — edges to N5 route around N4 with padding
- [x] Click "Add Node", place between existing nodes — existing edges avoid it
- [x] Connect two nodes by dragging handle-to-handle — new orthogonal edge appears
- [x] Select node/edge and click "Remove Selected" — removes correctly
- [x] Edge N1→N5 routes around N2, N3, N4 with visible padding gaps
- [x] Edges that share a common segment are visually separated (not drawn on top of each other)
- [x] Overlapping edges show center-spread offset with configurable gap
- [x] Edge bends have rounded corners (not sharp 90° angles)
- [x] Rounded corners degrade gracefully on short segments (radius clamped)

### Layout Verification

- [ ] `layoutGraph()` positions a simple sequential chain (A → B → C) in a straight vertical line with `verticalGap` spacing
- [ ] A branch node with 2 outputs creates an if/else layout: left and right children equidistant from parent X
- [ ] A branch node with 3 outputs creates if/else-if/else: left, center, right with equal `horizontalGap`
- [ ] Merge node (circular, `data.isMerge=true`) positioned below the deepest branch
- [ ] Edges from shorter branches route correctly down to the merge node
- [ ] Nested branches: inner branch group has its own merge, outer merge sits below everything
- [ ] `addNodesToLayout()` inserts a node between parent and children, pushing children down
- [ ] After merge, the next node returns to the parent's X position (straight vertical flow resumes)
- [ ] Subtree width calculation prevents overlapping branch subtrees
- [ ] Dragging a node preserves its position; `layoutGraph()` resets all positions
- [ ] Drop handler positions a new node below the target parent in the layout

---

## 11. Auto-Layout Engine (`lib/layoutEngine.js`) — NEW

### Overview

- [ ] Vertical (top-to-bottom) auto-layout engine that manages node positions
- [ ] Uses **elkjs** (`elk.algorithm: 'layered'`) for position computation — no custom layout math
- [ ] Library infers graph structure from nodes + edges provided by the user
- [ ] Supports sequential flows, branching (if/else/else-if), merge nodes, and unlimited nesting
- [ ] elkjs handles: layer assignment, node ordering, coordinate assignment, subtree spacing
- [ ] Our code handles: ELK graph construction, collapse visibility, React Flow integration
- [ ] elkjs edge routing is **ignored** — we use our own orthogonal router from Phase 1

### Dependency

- [ ] `elkjs` npm package (uses WebAssembly ELK build for performance)
- [ ] Install in both `lib/` (peer dependency) and `example/` (dev dependency)

### Configuration (`lib/defaults.js` additions)

- [ ] `horizontalGap` (default: 40) — maps to `elk.spacing.nodeNode`
- [ ] `verticalGap` (default: 60) — maps to `elk.layered.spacing.nodeNodeBetweenLayers`
- [ ] Configurable per-layout-call via options object

### ELK Graph Construction (`buildElkGraph`)

- [ ] Converts React Flow nodes + edges into ELK input format:
  ```
  { id: 'root', layoutOptions: {...}, children: [...], edges: [...] }
  ```
- [ ] Each node gets `width` and `height` from `data.width` / `data.height`, falling back to `DEFAULTS.nodeWidth` / `DEFAULTS.nodeHeight`
- [ ] Merge nodes may have a different size (e.g., smaller circle) specified via their data
- [ ] ELK layout options:
  - `'elk.algorithm': 'layered'`
  - `'elk.direction': 'DOWN'` — top-to-bottom vertical layout
  - `'elk.spacing.nodeNode'`: from `horizontalGap` config
  - `'elk.layered.spacing.nodeNodeBetweenLayers'`: from `verticalGap` config
  - `'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF'` — balanced node placement
  - `'elk.edgeRouting': 'ORTHOGONAL'` — (ELK's routing is unused, but needed for correct layer spacing)

### Graph Structure (handled by ELK automatically)

- [ ] **Root node**: node with no incoming edges — ELK places it in the first layer
- [ ] **Sequential flow**: node with exactly one output edge → ELK places child in next layer, aligned below parent
- [ ] **Branching**: node with 2+ output edges → ELK spreads children horizontally in the same layer
  - Branches ordered left-to-right by the order of output edges (first edge = leftmost branch)
  - Parent centered above children (ELK's default behavior with BRANDES_KOEPF)
- [ ] **Merge node**: user marks via `data.isMerge = true`
  - ELK places it in the correct layer (below deepest branch) based on edge connectivity
  - Edges from shorter branches naturally route down to reach the merge node's layer
- [ ] **Nested branches**: each sub-branch group has its own merge node — ELK handles layer nesting automatically
- [ ] Unlimited nesting depth

### Adding Nodes

- [ ] **Batch API**: `addNodesToLayout(existingNodes, existingEdges, parentId, newNodes, newEdges, config?)` — user provides nodes + edges in a single call
  - Merges new nodes/edges into existing graph
  - Runs ELK layout on the full graph to compute all positions
  - Returns updated nodes array with new positions
  - Edge connections managed by the user (library only handles positioning)
- [ ] **Drop API**: `onDropNode(parentId, nodeData)` — hook/callback for drag-and-drop from user-built palette
  - User builds their own drag source (palette, toolbar, etc.)
  - Library provides the drop handler that positions the node in the layout
  - Internally calls `addNodesToLayout` with the single new node

### Layout Triggers

- [ ] **Auto on node addition**: layout recalculates full graph when nodes are added via API
- [ ] **Manual full re-layout**: `layoutGraph()` API recalculates ALL node positions from scratch
  - Resets any manually-dragged positions (unpins everything)
  - Runs ELK on the full graph from scratch
- [ ] Node drag: user can freely drag nodes to new positions
  - Dragged positions are respected until `layoutGraph()` is called
  - Adding new nodes does NOT reset previously dragged positions (only affects the insertion area)

### Public API

- [ ] `layoutGraph(nodes, edges, config?)` — run ELK layout on all nodes, returns positioned nodes array (async — ELK is async)
- [ ] `addNodesToLayout(existingNodes, existingEdges, parentId, newNodes, newEdges, config?)` — add nodes, run layout, returns updated nodes array (async)
- [ ] `useAutoLayout(config?)` — React hook that integrates with React Flow, provides `addNodes` and `layoutAll` functions
- [ ] Export from `lib/index.js`

### Merge Node Component (`lib/MergeNode.jsx`) — NEW

- [ ] Circular node component for merge points
- [ ] Configurable size via `data.width` / `data.height` (default: smaller than regular nodes)
- [ ] Multiple input ports on top (one per incoming branch edge)
- [ ] Single output port on bottom
- [ ] `data.isMerge = true` flag for layout engine detection
- [ ] Visual styling: circular shape, distinct from regular square nodes

### Branch Expand/Collapse

#### Collapse Behavior

- [ ] **Full group collapse**: clicking the toggle on a branch node hides ALL content between it and its merge node — including the if/else/else-if nodes, the merge node itself, and all edges between them
- [ ] A **direct edge** is shown from the branch node to the merge node's child (the node after the merge), skipping all hidden content
- [ ] The layout **closes the vertical gap** — nodes below the collapsed group shift up
- [ ] **Nested branches** inside a collapsed group are auto-collapsed; expanding the parent restores the previous nested expand/collapse state

#### Per-Branch Collapse

- [ ] Each individual branch path (e.g., only the "if" path) can be independently collapsed/expanded
- [ ] When a single branch is collapsed, its nodes are hidden and the horizontal **space is preserved** (empty column remains so layout doesn't shift other branches)
- [ ] The merge node stays visible when only individual branches are collapsed (merge hides only on full group collapse)
- [ ] Default behavior is full group collapse; per-branch collapse is opt-in via config: `perBranchCollapse: true`

#### Toggle UI

- [ ] Small +/− icon at the **bottom-right corner** of the branch node
- [ ] Icon indicates current state: `−` when expanded, `+` when collapsed
- [ ] Clicking the icon toggles the collapse state

#### State Management

- [ ] **User-controlled** via node data: `data.collapsed = true | false`
  - For full group collapse: set `data.collapsed = true` on the branch node
  - For per-branch collapse: set `data.collapsed = true` on individual branch child nodes (if/else/else-if nodes)
- [ ] Library reads `data.collapsed` and computes visible nodes/edges accordingly
- [ ] User receives `onToggleCollapse(nodeId, collapsed)` callback to update their state

#### Animation

- [ ] **Configurable**: animation on by default, can be disabled via `collapseAnimation: false`
- [ ] When enabled: nodes fade in/out and slide to new positions over ~300ms
- [ ] When disabled: instant snap

#### Layout Integration

- [ ] Layout engine respects collapsed state when computing positions
- [ ] Collapsed branch groups are treated as a single node (branch node only) for layout purposes
- [ ] `layoutGraph()` preserves current collapsed states unless user explicitly resets them

---

## 12. Implementation Order

### Phase 1: Edge Separation & Rounding (done)

1. [x] Add `edgeSeparation` and `bendRadius` to `DEFAULTS` in `lib/defaults.js`
2. [x] Add `separateOverlappingEdges()` function to `lib/orthogonalRouter.js`
3. [x] Update `waypointsToSvgPath()` in `lib/orthogonalRouter.js` to support rounded corners via `bendRadius`
4. [x] Create `lib/EdgeRoutingProvider.jsx` — centralized path computation + separation + rounding
5. [x] Modify `lib/OrthogonalEdge.jsx` — read from context, fallback to standalone computation
6. [x] Update `lib/index.js` — export `EdgeRoutingProvider`
7. [x] Update `example/src/App.jsx` — add `<EdgeRoutingProvider>` wrapped around `<ReactFlow>` with `<ReactFlowProvider>`

### Phase 2: Auto-Layout Engine (elkjs)

8. [ ] Install `elkjs` dependency in `example/` (and document as peer dependency for `lib/`)
9. [ ] Add `horizontalGap`, `verticalGap`, `perBranchCollapse`, `collapseAnimation` to `DEFAULTS` in `lib/defaults.js`
10. [ ] Create `lib/layoutEngine.js` — elkjs wrapper + collapse logic
   - [ ] `buildElkGraph(nodes, edges, config)` — convert React Flow nodes/edges to ELK input format
   - [ ] `applyElkPositions(elkGraph, originalNodes)` — map ELK output positions back to React Flow nodes
   - [ ] `layoutGraph(nodes, edges, config?)` — async entry point: build ELK graph → run layout → return positioned nodes
   - [ ] `addNodesToLayout(existingNodes, existingEdges, parentId, newNodes, newEdges, config?)` — merge + layout
   - [ ] `getVisibleGraph(nodes, edges)` — filter out collapsed nodes/edges, generate direct bypass edges
11. [ ] Create `lib/MergeNode.jsx` — circular merge node component
12. [ ] Create `lib/BranchNode.jsx` — branch node with expand/collapse toggle (+/− icon at bottom-right)
13. [ ] Create `lib/useAutoLayout.js` — React hook integrating elkjs layout + collapse with React Flow
14. [ ] Update `lib/index.js` — export layout engine, MergeNode, BranchNode, useAutoLayout
15. [ ] Update `example/src/App.jsx` — demo with branching, merge, collapse/expand, add-node
16. [ ] Test all layout and collapse verification checklist items

---

## 13. Edge Labels (`lib/OrthogonalEdge.jsx`)

### Overview

- [ ] Display text labels on edges, positioned on the first vertical segment (stub going down from source handle)
- [ ] Generic library feature — any edge can have a label via `edge.data.label`
- [ ] Primary use case: branch node output edges labeled "If", "Else If", "Else"

### Label Data

- [ ] User passes label as `edge.data.label` (string)
- [ ] If `data.label` is falsy/absent, no label is rendered
- [ ] Example: `makeEdge(..., { label: 'If' })`

### Label Positioning

- [ ] Label appears on the **first vertical segment** of the edge (the source stub, from source handle going down)
- [ ] Centered horizontally **on** the vertical segment (same x as the segment)
- [ ] Vertically placed at the **midpoint** of the first vertical segment
- [ ] A small white/opaque background behind the text prevents overlap with the edge line

### Label Orientation

- [ ] **Horizontal text** — normal left-to-right reading direction
- [ ] Text centered over the segment line

### Label Styling

- [ ] Default: simple text with a small opaque background for readability
- [ ] User can override via `edge.data.labelStyle` (React inline style object)
- [ ] User can override via `edge.data.labelClassName` (CSS class string)
- [ ] If both are provided, both are applied (className on element, style as inline)

### Configuration (`lib/defaults.js` additions)

- [ ] `edgeLabelFontSize` (default: 11) — px font size for edge labels
- [ ] `edgeLabelOffset` (default: 4) — px vertical offset from segment midpoint (fine-tuning)
- [ ] `edgeLabelBackground` (default: '#ffffff') — background color behind label text

### Rendering

- [ ] Labels rendered as `<text>` (or `<foreignObject>`) elements inside the edge SVG group
- [ ] Positioned using the pre-computed edge path points (from `EdgeRoutingProvider` or fallback)
- [ ] The label position is computed from the first two points of the path (source port → stub end)
- [ ] `text-anchor: middle` for horizontal centering
- [ ] Small `<rect>` behind text for background (with 2-3px padding)

### Implementation Steps

1. [ ] Add `edgeLabelFontSize`, `edgeLabelOffset`, `edgeLabelBackground` to `DEFAULTS` in `lib/defaults.js`
2. [ ] Modify `lib/OrthogonalEdge.jsx`:
   - [ ] Read `data.label`, `data.labelStyle`, `data.labelClassName` from edge props
   - [ ] Compute label position from the first vertical segment of the path
   - [ ] Render `<text>` element with background `<rect>` when label is present
   - [ ] Apply user's `labelStyle` / `labelClassName` if provided
3. [ ] Modify `EdgeRoutingProvider.jsx`:
   - [ ] Pass `points` array to the edge context (already done — `{ path, points }`)
   - [ ] OrthogonalEdge needs access to points to compute label position
4. [ ] Update `example/src/App.jsx`:
   - [ ] Add `data.label` to branch output edges (e.g., "If", "Else If", "Else")
   - [ ] Demo custom styling on one label
5. [ ] Update `lib/index.js` if any new exports needed

### Verification

- [ ] Branch edges show "If", "Else If", "Else" labels on the vertical segment below the branch node
- [ ] Labels are horizontally centered on the edge line
- [ ] Labels have a readable background that doesn't bleed into the edge
- [ ] Labels respect `edgeLabelFontSize` from config
- [ ] Custom `data.labelStyle` overrides default styling
- [ ] Custom `data.labelClassName` adds CSS class to label element
- [ ] Edges without `data.label` render normally (no empty label element)
- [ ] Labels re-position correctly when nodes are dragged
- [ ] Labels work with both EdgeRoutingProvider (context) and fallback (standalone) modes

---

## 14. Future Requirements

<!-- Add new requirements below. Use [ ] for planned items. -->
<!-- Example:
- [ ] Animated edge drawing
- [ ] Export/import graph as JSON
- [ ] Dark mode support
- [ ] Horizontal stub support (left/right ports)
- [ ] Edge grouping / bundling for parallel edges
- [ ] Minimap integration
-->
