import React, { memo, useState, useCallback, useRef, useEffect } from 'react';

/**
 * Small "+" button that appears at the bottom-center of a node.
 * Clicking it shows a dropdown with app-provided menu content.
 *
 * Props:
 *   renderMenu  - () => ReactElement — app provides the dropdown content
 *
 * Legacy props (still supported for backward compatibility):
 *   nodeId             - the parent node ID
 *   onAddNode          - callback(nodeId, type)
 *   otherNodes         - array of { id, label }
 *   onConnectToExisting - callback(sourceNodeId, targetNodeId)
 */
const AddNodeMenu = memo(function AddNodeMenu({ renderMenu, nodeId, onAddNode, otherNodes, onConnectToExisting }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // If neither renderMenu nor legacy onAddNode provided, don't render
  const hasMenu = !!(renderMenu || onAddNode);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    setOpen((o) => !o);
  }, []);

  // Legacy handlers
  const handleAdd = useCallback(
    (type) => (e) => {
      e.stopPropagation();
      setOpen(false);
      if (onAddNode) onAddNode(nodeId, type);
    },
    [nodeId, onAddNode]
  );

  const handleConnect = useCallback(
    (targetId) => (e) => {
      e.stopPropagation();
      setOpen(false);
      if (onConnectToExisting) onConnectToExisting(nodeId, targetId);
    },
    [nodeId, onConnectToExisting]
  );

  if (!hasMenu) return null;

  const hasConnectSection = otherNodes && otherNodes.length > 0 && onConnectToExisting;

  const itemStyle = {
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
    color: '#333',
  };

  const sectionHeaderStyle = {
    padding: '4px 12px 2px',
    fontSize: 10,
    color: '#999',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    userSelect: 'none',
  };

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
          onClick={() => setOpen(false)}
        >
          {renderMenu ? (
            // New: app-provided menu content via render prop
            renderMenu()
          ) : (
            // Legacy: hardcoded menu items
            <>
              <div style={sectionHeaderStyle}>Add new</div>
              <div
                onClick={handleAdd('node')}
                style={{ ...itemStyle, borderBottom: '1px solid #eee' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Add Node
              </div>
              <div
                onClick={handleAdd('branch')}
                style={itemStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Add Branch
              </div>

              {hasConnectSection && (
                <>
                  <div style={{ borderTop: '2px solid #eee', marginTop: 2 }} />
                  <div style={sectionHeaderStyle}>Connect to</div>
                  {otherNodes.map((n) => (
                    <div
                      key={n.id}
                      onClick={handleConnect(n.id)}
                      style={itemStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {n.label || n.id}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default AddNodeMenu;
