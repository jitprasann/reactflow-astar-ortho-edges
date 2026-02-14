import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import AddNodeMenu from './AddNodeMenu.jsx';

const BranchNode = memo(function BranchNode({ id, data, selected }) {
  const width = data.width || 150;
  const height = data.height || 60;
  const label = data.label || '';
  const inputs = data.inputs || 1;
  const outputs = data.outputs || 2;
  const collapsed = !!data.collapsed;
  const onToggleCollapse = data.onToggleCollapse;

  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();
      if (onToggleCollapse) {
        onToggleCollapse(id, !collapsed);
      }
    },
    [id, collapsed, onToggleCollapse]
  );

  return (
    <div
      style={{
        width,
        height,
        background: selected ? '#e3f2fd' : '#e8f5e9',
        border: selected ? '2px solid #1976d2' : '1px solid #4caf50',
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
      <button
        onClick={handleToggle}
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 18,
          height: 18,
          padding: 0,
          border: '1px solid #999',
          borderRadius: 3,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: '16px',
          textAlign: 'center',
          color: '#333',
        }}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? '+' : '\u2212'}
      </button>
      {data.onAddNode && <AddNodeMenu nodeId={id} onAddNode={data.onAddNode} />}
    </div>
  );
});

export default BranchNode;
