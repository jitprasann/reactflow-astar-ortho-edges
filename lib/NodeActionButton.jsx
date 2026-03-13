import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import DataMenu from './DataMenu.jsx';

/**
 * Reusable action button with popup dropdown for node custom actions.
 * Follows the same open/close pattern as AddNodeMenu.
 *
 * Props:
 *   icon          - button content (ReactElement or string), defaults to '\u22EF'
 *   title         - tooltip text
 *   className     - CSS class for the trigger button
 *   menuClassName - CSS class for the dropdown
 *   style         - inline style for trigger button
 *   menuStyle     - inline style for dropdown
 *   menuConfig    - { items?, fetchItems?, loadingComponent? } — menu data config
 */
const NodeActionButton = memo(function NodeActionButton({
  icon,
  title,
  className,
  menuClassName,
  style,
  menuStyle,
  menuConfig,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    setOpen((o) => !o);
  }, []);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleToggle}
        className={className || 'eq-pipeline-compact-node-action-btn'}
        style={style}
        title={title}
      >
        {icon || '\u22EF'}
      </button>
      {open && menuConfig && (
        <div
          className={menuClassName || 'eq-pipeline-compact-action-menu'}
          style={menuStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <DataMenu menuConfig={menuConfig} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
});

export default NodeActionButton;
