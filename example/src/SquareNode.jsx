import React, { memo } from 'react';
import { NodeShell } from '../../lib/index.js';

const SquareNode = memo(function SquareNode({ id, data, selected }) {
  return (
    <NodeShell id={id} data={data} selected={selected} className={`node-box${selected ? ' selected' : ''}`}>
      <span className="node-icon">&#9634;</span>
    </NodeShell>
  );
});

export default SquareNode;
