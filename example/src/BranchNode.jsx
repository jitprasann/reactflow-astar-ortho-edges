import React, { memo, useCallback } from 'react';
import { NodeShell } from '../../lib/index.js';

const BranchNode = memo(function BranchNode({ id, data, selected }) {
  const collapsed = !!data.collapsed;
  const onToggleCollapse = data.onToggleCollapse;
  const onDeleteNode = data.onDeleteNode;

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    if (onToggleCollapse) onToggleCollapse(id, !collapsed);
  }, [id, collapsed, onToggleCollapse]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (onDeleteNode) onDeleteNode(id);
  }, [id, onDeleteNode]);

  return (
    <NodeShell id={id} data={data} selected={selected} className="node-box branch-node">
      <span className="node-icon">&#9670;</span>
      <button className="collapse-btn" onClick={handleToggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? '+' : '\u2212'}
      </button>
      {onDeleteNode && (
        <button className="delete-btn" onClick={handleDelete} title="Delete">
          &times;
        </button>
      )}
    </NodeShell>
  );
});

export default BranchNode;
