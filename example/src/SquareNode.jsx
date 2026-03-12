import React, { memo } from 'react';
import { NodeShell, DeleteButton, NodeActionButton } from '../../lib/index.js';

const menuItemStyle = {
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 12,
  color: '#333',
  whiteSpace: 'nowrap',
};

const SquareNode = memo(function SquareNode({ id, data, selected }) {
  return (
    <NodeShell id={id} data={data} selected={selected} className="node-box">
      <span className="node-icon">&#9634;</span>
      <DeleteButton nodeId={id} data={data} />
      <NodeActionButton
        icon="&#9998;"
        title="Change Type"
        style={{ position: 'absolute', top: 3, left: 3 }}
      >
        {data.availableTypes && data.availableTypes
          .filter(function (t) { return t !== 'square'; })
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

export default SquareNode;
