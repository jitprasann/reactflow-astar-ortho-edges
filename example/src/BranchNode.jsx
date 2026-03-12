import React, { memo } from 'react';
import { NodeShell, DeleteButton, CollapseButton, NodeActionButton } from '../../lib/index.js';

const menuItemStyle = {
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 12,
  color: '#333',
  whiteSpace: 'nowrap',
};

const BranchNode = memo(function BranchNode({ id, data, selected }) {
  const collapseIcon = data && data.collapsed ? '+' : '\u2212';
  return (
    <NodeShell id={id} data={data} selected={selected} className="node-box branch-node">
      <span className="node-icon">&#9670;</span>
      <DeleteButton nodeId={id} data={data} />
      <CollapseButton nodeId={id} data={data} icon={collapseIcon} />
      <NodeActionButton
        icon="&#9998;"
        title="Change Type"
        style={{ position: 'absolute', top: 3, left: 3 }}
      >
        {data.availableTypes && data.availableTypes
          .filter(function (t) { return t !== 'branch'; })
          .map(function (t) {
            return (
              <div key={t} style={menuItemStyle} onClick={() => data.onChangeType(id, t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            );
          })}
      </NodeActionButton>
    </NodeShell>
  );
});

export default BranchNode;
