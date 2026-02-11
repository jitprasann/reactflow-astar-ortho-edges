import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { DEFAULTS } from './defaults.js';

const SquareNode = memo(function SquareNode({ data, selected }) {
  const width = data.width || DEFAULTS.nodeWidth;
  const height = data.height || DEFAULTS.nodeHeight;
  const label = data.label || '';
  const inputs = data.inputs || 0;
  const outputs = data.outputs || 0;

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
      {Array.from({ length: inputs }, (_, i) => (
        <Handle
          key={`input-${i}`}
          type="target"
          position={Position.Top}
          id={`input-${i}`}
          style={{
            left: `${((i + 1) / (inputs + 1)) * 100}%`,
            transform: 'translateX(-50%)',
            background: '#555',
            width: 8,
            height: 8,
          }}
        />
      ))}
      {Array.from({ length: outputs }, (_, i) => (
        <Handle
          key={`output-${i}`}
          type="source"
          position={Position.Bottom}
          id={`output-${i}`}
          style={{
            left: `${((i + 1) / (outputs + 1)) * 100}%`,
            transform: 'translateX(-50%)',
            background: '#555',
            width: 8,
            height: 8,
          }}
        />
      ))}
    </div>
  );
});

export default SquareNode;
