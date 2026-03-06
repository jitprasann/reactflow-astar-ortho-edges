# Layout System — How Node Positioning Works

## Overview

The library uses **dagre** (primary) and **ELK** (alternative) for automatic top-to-bottom node positioning. Dagre is used for all runtime layout operations (add node, collapse, re-layout). ELK exists as an async alternative but is not used in the current flow.

---

## 1. Dagre Layout (`dagreLayout.js`)

### Core Function: `layoutGraphDagre(nodes, edges, config)`

Takes React Flow nodes and edges, returns nodes with computed `position: { x, y }`.

### Step-by-Step Process

**a) Graph Construction**

```
dagre Graph settings:
  rankdir: "TB"              (top-to-bottom)
  nodesep: horizontalGap     (48px — horizontal space between sibling nodes)
  ranksep: verticalGapWithLabel (116px — max vertical space, used as base for compaction)
  ranker:  longestPathFromSource (custom ranker function)
```

Each node is registered with its `width` and `height` from `node.data`.

**b) Edge Insertion Order**

Edges are inserted in **reverse** desired left-to-right order per source node. This counteracts dagre's internal `biasRight` pass which reverses equal-barycenter siblings, producing the correct final left-to-right ordering.

Order key: `edge.data.order` (explicit) or numeric suffix of `sourceHandle` (`"output-2"` → 2). Edges are sorted descending before insertion so dagre flips them to ascending.

**c) Custom Ranker: `longestPathFromSource`**

Replaces dagre's built-in ranker. Uses Kahn's BFS (topological sort) to assign each node a `rank` equal to its longest path from any root (source) node.

```
rank(child) = max(rank(child), rank(parent) + edge.minlen)
```

This guarantees that branch children at the same topological depth (e.g., If/Else-If/Else paths) always land on the **same horizontal layer**, even when one branch grows deeper than its siblings.

**d) Three-Tier Post-Layout Compaction**

After dagre positions all nodes at `verticalGapWithLabel` (116px) spacing, the compaction pass shrinks gaps based on edge/node type:

1. Group nodes by rank (layer)
2. For each pair of adjacent layers, determine the desired gap:
   - **Labeled edges** between the layers → keep `verticalGapWithLabel` (116px), no compaction
   - **Merge node** in the current layer → compact to `verticalGapMerge` (40px), shift up by 76px
   - **Normal edges** (no label, no merge) → compact to `verticalGap` (80px), shift up by 36px
3. Shifts accumulate — e.g., if layers 2→3 is normal (−36px) and layers 3→4 targets a merge (−76px), layer 4 is shifted up by 112px total

| Layer gap type | Desired gap | Compaction from 116px |
|----------------|-------------|----------------------|
| Labeled edges  | 116px       | 0px (no shift)       |
| Normal edges   | 80px        | −36px per gap        |
| Merge target   | 40px        | −76px per gap        |

This gives labeled edges room for text, normal edges a comfortable distance, and merge nodes a tight connection to their incoming branches.

**e) Coordinate Mapping**

Dagre outputs node `x, y` as the node **center**. React Flow expects **top-left**. The final mapping subtracts half the node dimensions:

```
position.x = dagre.x - width / 2
position.y = dagre.y - height / 2
```

---

## 2. ELK Layout (`layoutEngine.js`) — Alternative

### Core Function: `layoutGraph(nodes, edges, config)` (async)

Uses ELK (Eclipse Layout Kernel) via WASM. Not currently used at runtime but available.

### Key Differences from Dagre

- **Port-based**: Builds explicit ports per node (`FIXED_POS` constraints). Input ports on NORTH, output ports on SOUTH, centered with 8px spacing.
- **Algorithm**: `elk.algorithm = "layered"`, `elk.direction = "DOWN"`
- **Layering**: `LONGEST_PATH_SOURCE` — same logic as the custom dagre ranker
- **Node placement**: `BRANDES_KOEPF` with `BALANCED` alignment
- **Edge routing**: `ORTHOGONAL` (ELK handles its own edge routing, but the library uses its own router instead)
- **Interactive mode**: Can accept existing node positions as hints for semi-interactive re-layout
- **Same three-tier post-layout compaction** as dagre (labeled → 116px, normal → 80px, merge → 40px)

---

## 3. Graph Actions (`graphActions.js`)

These functions modify the graph and compute new positions.

### `addNode(nodes, edges, parentId, type, createNode)`

Adds child node(s) to a parent. Uses a **mini-layout** approach:

1. Call the app's `createNode` factory to get new nodes and edges
2. Normalize edges (add `type: "orthogonal"`, `markerEnd`, handle assignments)
3. Build a **mini graph**: parent + existing direct children (siblings) + new nodes
4. Run `layoutGraphDagre` on the mini graph only
5. Compute delta `(dx, dy)` to align mini-layout parent with the real parent position
6. Apply delta to all mini-layout nodes
7. **Cascade**: For each existing sibling that moved, BFS all its descendants and shift them by the same delta (so subtrees move as a unit)

### `addNodeInline(nodes, edges, edgeId, type, createNodeInline)`

Inserts node(s) in the middle of an existing edge:

1. Remove the original edge
2. Call the app's factory to get new nodes and replacement edges
3. Use `placeNewNodes` (from `graphUtils.js`) to position new nodes via mini dagre layout
4. Push downstream nodes down if needed to avoid overlap

### `layoutAll(nodes, edges)`

Full re-layout: runs `layoutGraphDagre` on all nodes. Called by the "Re-Layout" button.

### `toggleCollapse(nodes, edges, nodeId, collapsed)`

1. Set `data.collapsed` on the target node
2. Run `getVisibleGraph` to filter hidden nodes and generate bypass edges
3. Run `layoutGraphDagre` on visible nodes only
4. Map computed positions back to all nodes (hidden nodes keep old positions)

---

## 4. Visible Graph Filtering (`layoutEngine.js` — `getVisibleGraph`)

Before rendering, nodes/edges pass through collapse filtering:

### Full Group Collapse
When a branch node has `data.collapsed = true`:
- Find its merge node (first `isMerge` node reachable from ALL branches via BFS)
- Hide all nodes between the branch and merge (inclusive of merge)
- Create bypass edges from branch directly to merge's children

### Per-Branch Collapse
When an individual branch child has `data.collapsed = true`:
- Hide only that branch path (nodes between the child and the merge node, exclusive of merge)
- Other branch paths remain visible

---

## 5. Node Positioning Utilities (`graphUtils.js`)

### `placeNewNodes(parentId, parentNode, updatedNodes, newNodes, newEdges, updatedEdges)`

Used by `addNodeInline` to position newly inserted nodes:

1. Mini dagre layout: parent + new nodes
2. Align mini layout to real parent position via `(dx, dy)` offset
3. Find downstream nodes (connected after new nodes)
4. If new nodes overlap with downstream, shift all downstream nodes down by `verticalGap`

### `assignHandles(newEdges, existingEdges)`

Auto-assigns `sourceHandle` (`output-N`) and `targetHandle` (`input-N`) to edges that don't have them, incrementing from the highest existing index per node.

### `reindexHandlesAfterDelete(remainingEdges, deletedEdge)`

After edge deletion, re-indexes handles to close gaps (e.g., if `output-1` is deleted, `output-2` becomes `output-1`).

---

## 6. Configuration Defaults (`defaults.js`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `horizontalGap` | 48px | Space between sibling nodes in the same layer |
| `verticalGap` | 80px | Vertical space for normal edges (no label, no merge) |
| `verticalGapWithLabel` | 116px | Vertical space when edges have labels (e.g., "If", "Else") |
| `verticalGapMerge` | 40px | Vertical space between branch children and merge node |
| `nodeWidth` | 80px | Default node width |
| `nodeHeight` | 80px | Default node height |
| `addButtonVerticalOffset` | 16px | Distance below node to place action "+" button |
| `addButtonRightOffset` | null | Horizontal offset for action button (null = auto) |
| `addButtonSize` | 24px | Size of the action "+" button |

---

## 7. Action Nodes (Ghost "+" Buttons)

Computed dynamically in `OrthogonalFlow.jsx` (not stored in state):

1. For each visible node that is hovered or selected (and not a merge node):
   - Create an `__action` node positioned below the parent
   - Position: `x = parentCenter + hOffset - size/2`, `y = parentBottom + vOffset`
   - `hOffset` = 0 if no existing outputs, else `nodeWidth/2 + 8` (offset to the right)
2. Create a default (non-orthogonal) edge from parent's `__action-output` handle to the action node's `__action-input` handle
3. Action nodes are non-selectable, non-draggable, but connectable (drag from them to create edges)

---

## 8. Render Pipeline Summary

```
App state (nodes, edges)
    │
    ▼
getVisibleGraph() — filter collapsed nodes, generate bypass edges
    │
    ▼
Inject handle counts (inputs/outputs derived from visible edges)
    │
    ▼
Compute action nodes/edges for hovered/selected nodes
    │
    ▼
React Flow renders with:
  - EdgeRoutingProvider computes all orthogonal paths
  - Custom node types (SquareNode, BranchNode, MergeNode, ActionNode)
  - Custom edge type (OrthogonalEdge)
```
