# Orthogonal Edge Routing for React Flow 11

A JavaScript library that provides orthogonal (right-angle only) edge routing with automatic node avoidance for [React Flow](https://reactflow.dev/) v11.

Edges route around nodes in real-time during drag, maintain configurable padding, and use mandatory vertical stubs at source/target ends.

## How It Works

- **Sparse Orthogonal Visibility Graph + Dijkstra** pathfinding
- Inflated bounding boxes around nodes ensure edges keep a padding gap
- Bend penalty produces cleaner routes with fewer direction changes
- Fallback S-shaped path when no obstacle-free route exists
- Sub-millisecond routing for typical graphs (10-50 nodes)

## Project Structure

```
orthogonal/
├── lib/                        # Library source
│   ├── index.js                # Public API exports
│   ├── OrthogonalEdge.jsx      # Custom React Flow edge component
│   ├── SquareNode.jsx          # Custom node with configurable ports
│   ├── orthogonalRouter.js     # Pure routing algorithm (no React deps)
│   └── defaults.js             # Default configuration constants
└── example/                    # Interactive demo app
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── App.css
```

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or later
- npm

## Installation & Running

```bash
# Clone the repository
git clone https://github.com/jitprasann/reactflow-astar-ortho-edges.git
cd reactflow-astar-ortho-edges

# Install dependencies
cd example
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

## Usage in Your Project

Import the library components from the `lib/` directory:

```jsx
import { OrthogonalEdge, SquareNode, computeOrthogonalPath, DEFAULTS } from './lib/index.js';
```

Register the custom node and edge types with React Flow:

```jsx
const nodeTypes = { square: SquareNode };
const edgeTypes = { orthogonal: OrthogonalEdge };

<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
/>
```

Create edges with `type: 'orthogonal'`:

```jsx
{
  id: 'e1',
  source: 'node1',
  sourceHandle: 'output-0',
  target: 'node2',
  targetHandle: 'input-0',
  type: 'orthogonal',
  markerEnd: { type: MarkerType.ArrowClosed },
}
```

## Configuration

Default values can be overridden globally or per-edge.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `padding` | 20 | px clearance between edge paths and node boundaries |
| `sourceStubLength` | 20 | Vertical segment length leaving source port |
| `targetStubLength` | 20 | Vertical segment length entering target port |
| `bendPenalty` | 1 | Extra cost per direction change (fewer bends) |
| `nodeWidth` | 150 | Fallback node width before DOM measurement |
| `nodeHeight` | 60 | Fallback node height before DOM measurement |
| `edgeStrokeColor` | `'#555'` | Default edge color |
| `edgeStrokeWidth` | 1.5 | Default edge thickness |

### Per-edge override

```jsx
{
  id: 'e1',
  source: 'n1',
  target: 'n2',
  type: 'orthogonal',
  data: {
    routingConfig: { padding: 40, sourceStubLength: 30 }
  }
}
```

## Demo Features

- **Drag nodes** to see edges re-route in real-time
- **Add Node** button creates a new node at a random position
- **Remove Selected** button deletes selected nodes and their connected edges
- **Connect nodes** by dragging from an output handle to an input handle

## License

MIT
