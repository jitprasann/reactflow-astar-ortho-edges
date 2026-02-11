import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { OrthogonalEdge, SquareNode } from '../../lib/index.js';

const nodeTypes = { square: SquareNode };
const edgeTypes = { orthogonal: OrthogonalEdge };

const initialNodes = [
  {
    id: 'n1',
    type: 'square',
    position: { x: 250, y: 0 },
    data: { label: 'N1', inputs: 0, outputs: 3, width: 150, height: 60 },
  },
  {
    id: 'n2',
    type: 'square',
    position: { x: 100, y: 150 },
    data: { label: 'N2', inputs: 1, outputs: 1, width: 150, height: 60 },
  },
  {
    id: 'n3',
    type: 'square',
    position: { x: 400, y: 150 },
    data: { label: 'N3', inputs: 1, outputs: 1, width: 150, height: 60 },
  },
  {
    id: 'n4',
    type: 'square',
    position: { x: 250, y: 300 },
    data: { label: 'N4', inputs: 2, outputs: 1, width: 150, height: 60 },
  },
  {
    id: 'n5',
    type: 'square',
    position: { x: 250, y: 450 },
    data: { label: 'N5', inputs: 2, outputs: 0, width: 150, height: 60 },
  },
];

const makeEdge = (id, source, sourceHandle, target, targetHandle) => ({
  id,
  source,
  sourceHandle,
  target,
  targetHandle,
  type: 'orthogonal',
  markerEnd: { type: MarkerType.ArrowClosed },
});

const initialEdges = [
  makeEdge('e1', 'n1', 'output-0', 'n2', 'input-0'),
  makeEdge('e2', 'n1', 'output-2', 'n3', 'input-0'),
  makeEdge('e3', 'n3', 'output-0', 'n4', 'input-1'),
  makeEdge('e4', 'n2', 'output-0', 'n4', 'input-0'),
  makeEdge('e5', 'n4', 'output-0', 'n5', 'input-0'),
  makeEdge('e6', 'n1', 'output-1', 'n5', 'input-1'),
];

let nodeIdCounter = 6;

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'orthogonal',
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addNode = useCallback(() => {
    const id = `n${nodeIdCounter++}`;
    const newNode = {
      id,
      type: 'square',
      position: {
        x: Math.round(100 + Math.random() * 400),
        y: Math.round(100 + Math.random() * 300),
      },
      data: { label: id.toUpperCase(), inputs: 1, outputs: 1, width: 150, height: 60 },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const removeSelected = useCallback(() => {
    setNodes((nds) => {
      const selectedIds = new Set(nds.filter((n) => n.selected).map((n) => n.id));
      setEdges((eds) =>
        eds.filter(
          (e) => !e.selected && !selectedIds.has(e.source) && !selectedIds.has(e.target)
        )
      );
      return nds.filter((n) => !n.selected);
    });
  }, [setNodes, setEdges]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div className="controls-panel">
        <button onClick={addNode}>Add Node</button>
        <button onClick={removeSelected}>Remove Selected</button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode="Delete"
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
