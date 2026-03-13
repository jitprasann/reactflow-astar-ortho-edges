import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import DataMenu from './DataMenu.jsx';

/**
 * Small "+" button that appears at the bottom-center of a node.
 * Clicking it shows a dropdown with app-provided menu content.
 *
 * Props:
 *   renderMenu  - () => menuConfig|null — app provides the menu config.
 *                 If renderMenu is not provided or returns null, nothing is rendered.
 */
const AddNodeMenu = memo(function AddNodeMenu({ renderMenu }) {
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

  if (!renderMenu) return null;

  const menuConfig = renderMenu();
  if (!menuConfig) return null;

  return (
    <div
      ref={menuRef}
      style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
    >
      <button
        onClick={handleToggle}
        style={{
          width: 20,
          height: 20,
          padding: 0,
          border: '1px solid #999',
          borderRadius: '50%',
          background: '#fff',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: '18px',
          textAlign: 'center',
          color: '#333',
        }}
        title="Add node below"
      >
        +
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
            zIndex: 20,
            minWidth: 140,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <DataMenu menuConfig={menuConfig} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
});

export default AddNodeMenu;
