import React, { memo } from 'react';
import { NodeShell } from '../../lib/index.js';

const MergeNode = memo(function MergeNode({ id, data, selected }) {
  return (
    <NodeShell id={id} data={data} selected={selected} variant="merge" />
  );
});

export default MergeNode;
