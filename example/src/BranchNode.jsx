import React, { memo, useMemo } from 'react';
import { NodeShell, DeleteButton, CollapseButton, NodeActionButton } from '../../lib/index.js';

const BranchNode = memo(function BranchNode({ id, data, selected }) {
  const collapseIcon = data && data.collapsed ? '+' : '\u2212';

  var typeMenuConfig = useMemo(function () {
    if (!data.availableTypes) return null;
    var items = data.availableTypes
      .filter(function (t) { return t !== 'branch'; })
      .map(function (t) {
        return {
          label: t.charAt(0).toUpperCase() + t.slice(1),
          onClick: function () { data.onChangeType(id, t); },
        };
      });
    return { items: items };
  }, [data.availableTypes, data.onChangeType, id]);

  return (
    <NodeShell id={id} data={data} selected={selected} className="node-box branch-node">
      <span className="node-icon">&#9670;</span>
      <DeleteButton nodeId={id} data={data} />
      <CollapseButton nodeId={id} data={data} icon={collapseIcon} />
      <NodeActionButton
        icon="&#9998;"
        title="Change Type"
        style={{ position: 'absolute', top: 3, left: 3 }}
        menuConfig={typeMenuConfig}
      />
    </NodeShell>
  );
});

export default BranchNode;
