import React, { memo, useState, useCallback } from 'react';

/**
 * Small "+" button that appears at the bottom-center of a node.
 * Clicking it shows a dropdown with options to add a sequential node or a branch.
 *
 * Props:
 *   nodeId - the parent node ID
 *   onAddNode - callback(nodeId, type) where type is 'node' or 'branch'
 */
const AddNodeMenu = memo(function AddNodeMenu({ nodeId, onAddNode }) {
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    setOpen((o) => !o);
  }, []);

  const handleAdd = useCallback(
    (type) => (e) => {
      e.stopPropagation();
      setOpen(false);
      if (onAddNode) onAddNode(nodeId, type);
    },
    [nodeId, onAddNode]
  );

  return (
    <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
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
          }}
        >
          <div
            onClick={handleAdd('node')}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              borderBottom: '1px solid #eee',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#f0f0f0')}
            onMouseLeave={(e) => (e.target.style.background = '#fff')}
          >
            Add Node
          </div>
          <div
            onClick={handleAdd('branch')}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
            onMouseEnter={(e) => (e.target.style.background = '#f0f0f0')}
            onMouseLeave={(e) => (e.target.style.background = '#fff')}
          >
            Add Branch
          </div>
        </div>
      )}
    </div>
  );
});

export default AddNodeMenu;
