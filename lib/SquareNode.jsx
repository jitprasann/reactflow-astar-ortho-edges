import React, { memo } from 'react';
import NodeShell from './NodeShell.jsx';

const SquareNode = memo(function SquareNode({ id, data, selected }) {
  return <NodeShell id={id} data={data} selected={selected} variant="square" />;
});

export default SquareNode;
