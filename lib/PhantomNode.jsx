import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import './phantomNode.css';

/**
 * PhantomNode — ghost "+" node that appears below a hovered/selected node.
 *
 * Rendered as a dashed-border circle with a "+" inside.
 * - Click: opens dropdown menu (app's renderNodeMenu)
 * - Drag from it: starts edge creation (source handle covers full area)
 * - Mouse enter/leave: propagates hover to parent node
 *
 * Props via data:
 *   parentId       - ID of the parent node
 *   size           - diameter in px
 *   renderMenu     - () => ReactElement|null
 *   onHoverParent  - (parentId) => void
 *   onUnhoverParent - () => void
 */
const PhantomNode = memo(function PhantomNode({ data }) {
  const { parentId, size = 30, renderMenu, onHoverParent, onUnhoverParent } = data;
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

  const sizeStyle = { width: size, height: size };

  const menuContent = renderMenu ? renderMenu() : null;

  return (
    <div
      ref={wrapperRef}
      className="eq-pipeline-canvas-phantom-node"
      style={sizeStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      +

      {/* Hidden input handle at top center — phantom edge connects here */}
      <Handle
        type="target"
        position={Position.Top}
        id="__phantom-input"
        className="eq-pipeline-canvas-phantom-input-handle"
      />

      {/* Source handle covering full node area — drag from here to create edge */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output-0"
        className="eq-pipeline-canvas-phantom-handle"
      />

      {/* Dropdown menu */}
      {menuOpen && menuContent && (
        <div
          className="eq-pipeline-canvas-phantom-menu"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
        >
          {menuContent}
        </div>
      )}
    </div>
  );
});

export default PhantomNode;
