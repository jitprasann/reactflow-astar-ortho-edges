import React, { memo } from 'react';
import NodeShell from './NodeShell.jsx';

const BranchNode = memo(function BranchNode({ id, data, selected }) {
  return <NodeShell id={id} data={data} selected={selected} variant="branch" />;
});

export default BranchNode;
