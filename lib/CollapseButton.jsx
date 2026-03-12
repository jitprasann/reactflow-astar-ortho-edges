import React, { memo, useCallback } from 'react';
import './nodeShell.css';

/**
 * CollapseButton — reusable collapse/expand button for node types.
 *
 * Props:
 *   nodeId    - node ID
 *   data      - node data (reads data.onToggleCollapse, data.collapsed)
 *   icon      - custom icon (ReactElement or string), defaults to '+' / '−'
 *   className - custom CSS class, defaults to built-in class
 *   style     - inline style overrides
 */
const CollapseButton = memo(function CollapseButton({ nodeId, data, icon, className, style }) {
  const collapsed = !!(data && data.collapsed);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (data && data.onToggleCollapse) data.onToggleCollapse(nodeId, !collapsed);
  }, [nodeId, collapsed, data]);

  if (!data || !data.onToggleCollapse) return null;

  const defaultIcon = collapsed ? '+' : '\u2212';

  return (
    <button
      className={className || 'eq-pipeline-compact-node-collapse-btn'}
      style={style}
      onClick={handleClick}
      title={collapsed ? 'Expand' : 'Collapse'}
    >
      {icon !== undefined ? icon : defaultIcon}
    </button>
  );
});

export default CollapseButton;
