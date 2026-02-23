import React, { memo } from 'react';
import { NodeShell } from '../../lib/index.js';

const BranchNode = memo(function BranchNode({ id, data, selected }) {
  return (
    <NodeShell id={id} data={data} selected={selected} variant="branch">
      <span style={{ fontSize: 20 }}>&#9670;</span>
    </NodeShell>
  );
});

export default BranchNode;
