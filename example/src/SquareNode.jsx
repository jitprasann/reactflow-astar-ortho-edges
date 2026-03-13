import React, { memo, useMemo } from 'react';
import { NodeShell, DeleteButton, NodeActionButton } from '../../lib/index.js';

const SquareNode = memo(function SquareNode({ id, data, selected }) {
  var typeMenuConfig = useMemo(function () {
    if (!data.availableTypes) return null;
    var items = data.availableTypes
      .filter(function (t) { return t !== 'square'; })
      .map(function (t) {
        return {
          label: t.charAt(0).toUpperCase() + t.slice(1),
          onClick: function () { data.onChangeType(id, t); },
        };
      });
    return { items: items };
  }, [data.availableTypes, data.onChangeType, id]);

  return (
    <NodeShell id={id} data={data} selected={selected} className="node-box">
      <span className="node-icon">&#9634;</span>
      <DeleteButton nodeId={id} data={data} />
      <NodeActionButton
        icon="&#9998;"
        title="Change Type"
        style={{ position: 'absolute', top: 3, left: 3 }}
        menuConfig={typeMenuConfig}
      />
    </NodeShell>
  );
});

export default SquareNode;
