import React, { memo } from 'react';
import { NodeShell } from '../../lib/index.js';

const SquareNode = memo(function SquareNode({ id, data, selected }) {
  return (
    <NodeShell id={id} data={data} selected={selected} variant="square">
      <span style={{ fontSize: 20 }}>&#9634;</span>
    </NodeShell>
  );
});

export default SquareNode;
