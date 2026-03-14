import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { DataMenuAsync } from './DataMenu.jsx';
import './nodeShell.css';

/**
 * ActionNode — ghost "+" node that appears below a hovered/selected node.
 *
 * Rendered as a dashed-border circle with a "+" inside.
 * - Click: opens dropdown menu (app's renderNodeMenu)
 * - Drag from it: starts edge creation (source handle covers full area)
 * - Mouse enter/leave: propagates hover to parent node
 *
 * Props via data:
 *   parentId       - ID of the parent node
 *   size           - diameter in px
 *   renderMenu     - () => menuConfig|null
 *   onHoverParent  - (parentId) => void
 *   onUnhoverParent - () => void
 */
const ActionNode = memo(function ActionNode({ data }) {
  const { parentId, size = 24, renderMenu, onHoverParent, onUnhoverParent } = data;
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    setMenuOpen((o) => !o);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (onHoverParent) onHoverParent(parentId);
  }, [onHoverParent, parentId]);

  const handleMouseLeave = useCallback(() => {
    if (onUnhoverParent) onUnhoverParent();
  }, [onUnhoverParent]);

  const menuConfig = renderMenu ? renderMenu() : null;

  return (
    <div
      ref={wrapperRef}
      className="eq-pipeline-compact-action-node"
      style={{ width: size, height: size }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      +

      {/* Hidden input handle at top center — action edge connects here */}
      <Handle
        type="target"
        position={Position.Top}
        id="__action-input"
        className="eq-pipeline-compact-action-input-handle"
      />

      {/* Source handle covering full node area — drag from here to create edge */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output-0"
        className="eq-pipeline-compact-action-handle"
      />

      {/* Dropdown menu */}
      {menuOpen && menuConfig && (
        <div
          className="eq-pipeline-compact-action-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <DataMenuAsync menuConfig={menuConfig} onClose={() => setMenuOpen(false)} />
        </div>
      )}
    </div>
  );
});

export default ActionNode;
