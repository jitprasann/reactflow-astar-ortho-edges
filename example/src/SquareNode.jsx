import React, { memo, useCallback } from 'react';
import { NodeShell } from '../../lib/index.js';

const SquareNode = memo(function SquareNode({ id, data, selected }) {
  const onDeleteNode = data.onDeleteNode;

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (onDeleteNode) onDeleteNode(id);
  }, [id, onDeleteNode]);

  return (
    <NodeShell id={id} data={data} selected={selected} className="node-box">
      <span className="node-icon">&#9634;</span>
      {onDeleteNode && (
        <button className="delete-btn" onClick={handleDelete} title="Delete">
          &times;
        </button>
      )}
    </NodeShell>
  );
});

export default SquareNode;
