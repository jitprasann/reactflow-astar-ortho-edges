# Orthogonal Edge Routing — How It Works

## Edge Routing Overview

### 1. Visibility-Graph + Dijkstra Pathfinding (`orthogonalRouter.js`)

Each edge is routed through a **grid-based visibility graph**:

- **Stubs**: Every edge starts with a **source stub** (20px straight down from the source handle) and ends with a **target stub** (20px straight up into the target handle). These force edges to exit/enter nodes vertically.

- **Obstacle inflation**: All nodes are inflated by `padding: 20px` to create rectangular obstacles. Edges cannot pass through these inflated regions.

- **Grid waypoints**: A grid of candidate waypoints is generated at every obstacle boundary intersection (left/right/top/bottom edges of inflated nodes). Points inside obstacles are excluded.

- **Adjacency**: Consecutive waypoints on the same horizontal or vertical line are connected as neighbors, but only if the segment between them doesn't cross any obstacle.

- **Dijkstra's algorithm** finds the shortest path from source stub end to target stub start. The cost function is:
  - **Distance** (Manhattan length of each segment)
  - **Bend penalty** (`bendPenalty: 100`) — each direction change (horizontal↔vertical) adds 100 to the cost, so the router minimizes bends
  - **Early bend bias** (`earlyBendBias: 0.01`) — for edges with labels, horizontal segments closer to the source are slightly cheaper, placing the label near the source node

- **Fallback**: If Dijkstra can't find a path, an **S-shaped fallback** is used (source stub → midpoint horizontal → target stub).

### 2. Corner Rounding (`waypointsToSvgPath`)

Once the waypoint path is found, corners are smoothed:
- At each bend, a **quadratic Bezier curve** (`Q` command) replaces the sharp corner
- The radius is clamped to `bendRadius: 8px` (or half the shorter adjacent segment if that's smaller)
- Collinear points are skipped (no bend needed)

### 3. Overlap Separation (`separateOverlappingEdges`)

When multiple edges share collinear segments:
- Segments are grouped by `(orientation, fixedCoordinate)`
- Overlapping segments within a group are clustered
- Each edge in a cluster gets a **perpendicular offset** (`edgeSeparation: 5px`) using center-spread distribution
- Transition waypoints are inserted to maintain orthogonality after offsetting

### 4. Merge Node Entry (`EdgeRoutingProvider.jsx`)

Merge nodes get special treatment — the target direction is dynamically chosen based on the source node's position relative to the merge node:
- Source is to the **left** → edge enters from the **left** side
- Source is to the **right** → edge enters from the **right** side
- Source is roughly **centered above** → edge enters from the **top**

### Summary Flow

```
Source handle → 20px vertical stub → Grid pathfinding (Dijkstra + bend penalty)
→ Overlap separation → Corner rounding (Bezier) → 20px vertical stub → Target handle
```
