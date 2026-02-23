import React, { memo } from 'react';
import NodeShell from './NodeShell.jsx';

const MergeNode = memo(function MergeNode({ id, data, selected }) {
  return <NodeShell id={id} data={data} selected={selected} variant="merge" />;
});

export default MergeNode;
