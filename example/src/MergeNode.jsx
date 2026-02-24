import React, { memo } from 'react';
import { NodeShell } from '../../lib/index.js';

const MergeNode = memo(function MergeNode({ id, data, selected }) {
  return (
    <NodeShell id={id} data={data} selected={selected} className={`merge-node${selected ? ' selected' : ''}`}>
      <span className="node-icon">&#9679;</span>
    </NodeShell>
  );
});

export default MergeNode;
