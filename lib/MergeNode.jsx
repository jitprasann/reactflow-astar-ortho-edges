import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const MergeNode = memo(function MergeNode({ data, selected }) {
  const size = data.width || 40;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: selected ? '#e3f2fd' : '#fff',
        border: selected ? '2px solid #1976d2' : '2px solid #666',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontFamily: 'sans-serif',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {data.label || ''}
      {/* Single target handle covering the entire circle */}
      <Handle
        type="target"
        position={Position.Top}
        id="input-0"
        style={{
          width: size,
          height: size,
          top: 0,
          left: 0,
          borderRadius: '50%',
          transform: 'none',
          opacity: 0,
          background: 'transparent',
          border: 'none',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="output-0"
        style={{
          background: '#666',
          width: 6,
          height: 6,
        }}
      />
    </div>
  );
});

export default MergeNode;
