import React, { memo, useEffect, useRef } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { DEFAULTS } from './defaults.js';
import AddNodeMenu from './AddNodeMenu.jsx';

const SquareNode = memo(function SquareNode({ id, data, selected }) {
  const width = data.width || DEFAULTS.nodeWidth;
  const height = data.height || DEFAULTS.nodeHeight;
  const label = data.label || '';
  const inputs = data.inputs || 0;
  const outputs = data.outputs || 0;

  const updateNodeInternals = useUpdateNodeInternals();
  const prevHandles = useRef(`${inputs}-${outputs}`);
  useEffect(() => {
    const key = `${inputs}-${outputs}`;
    if (prevHandles.current !== key) {
      prevHandles.current = key;
      updateNodeInternals(id);
    }
  }, [inputs, outputs, id, updateNodeInternals]);

  return (
    <div
      style={{
        width,
        height,
        background: selected ? '#e3f2fd' : '#fff',
        border: selected ? '2px solid #1976d2' : '1px solid #999',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontFamily: 'sans-serif',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {label}
      {Array.from({ length: inputs }, (_, i) => {
        const offset = (i - (inputs - 1) / 2) * 8;
        return (
          <Handle
            key={`input-${i}`}
            type="target"
            position={Position.Top}
            id={`input-${i}`}
            style={{
              left: `calc(50% + ${offset}px)`,
              transform: 'translateX(-50%)',
              background: 'transparent',
              width: 1,
              height: 1,
              border: 'none',
              opacity: 0,
              pointerEvents: 'none',
            }}
          />
        );
      })}
      {Array.from({ length: outputs }, (_, i) => {
        const offset = (i - (outputs - 1) / 2) * 8;
        return (
          <Handle
            key={`output-${i}`}
            type="source"
            position={Position.Bottom}
            id={`output-${i}`}
            style={{
              left: `calc(50% + ${offset}px)`,
              transform: 'translateX(-50%)',
              background: 'transparent',
              width: 1,
              height: 1,
              border: 'none',
              opacity: 0,
              pointerEvents: 'none',
            }}
          />
        );
      })}
      {data.onAddNode && (
        <AddNodeMenu
          nodeId={id}
          onAddNode={data.onAddNode}
          otherNodes={data.otherNodes}
          onConnectToExisting={data.onConnectToExisting}
        />
      )}
    </div>
  );
});

export default SquareNode;
