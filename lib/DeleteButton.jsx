import React, { memo, useCallback } from 'react';
import './nodeShell.css';

/**
 * DeleteButton — reusable delete button for node types.
 *
 * Props:
 *   nodeId    - node ID
 *   data      - node data (reads data.onDeleteNode)
 *   icon      - custom icon (ReactElement or string), defaults to '×'
 *   className - custom CSS class, defaults to built-in class
 *   style     - inline style overrides
 */
const DeleteButton = memo(function DeleteButton({ nodeId, data, icon, className, style }) {
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (data && data.onDeleteNode) data.onDeleteNode(nodeId);
  }, [nodeId, data]);

  if (!data || !data.onDeleteNode || data.hideDeleteButton) return null;

  return (
    <button
      className={className || 'eq-pipeline-compact-node-delete-btn'}
      style={style}
      onClick={handleClick}
      title="Delete"
    >
      {icon || '\u00d7'}
    </button>
  );
});

export default DeleteButton;
