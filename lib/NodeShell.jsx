import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { DEFAULTS } from './defaults.js';
import AddNodeMenu from './AddNodeMenu.jsx';

/**
 * NodeShell — universal wrapper for orthogonal-flow nodes.
 *
 * Handles all boilerplate: input/output handles, handle-count updates,
 * AddNodeMenu, collapse button (branch), and renders the label above the node.
 *
 * Props:
 *   id       - node ID (from ReactFlow)
 *   data     - node data object (from ReactFlow)
 *   selected - boolean (from ReactFlow)
 *   children - optional content rendered inside the node box
 *   variant  - 'square' | 'branch' | 'merge' (controls default styling)
 *   style    - optional style overrides for the box
 */
const NodeShell = memo(function NodeShell({ id, data, selected, children, variant = 'square', style: styleProp }) {
  const isMerge = variant === 'merge';
  const isBranch = variant === 'branch';

  // --- Dimensions ---
  const width = isMerge ? (data.width || 40) : (data.width || DEFAULTS.nodeWidth);
  const height = isMerge ? (data.width || 40) : (data.height || DEFAULTS.nodeHeight);

  // --- Handles ---
  const inputs = isMerge ? 1 : (data.inputs || 0);
  const outputs = isMerge ? 1 : (data.outputs || 0);

  const updateNodeInternals = useUpdateNodeInternals();
  const prevHandles = useRef(`${inputs}-${outputs}`);
  useEffect(() => {
    const key = `${inputs}-${outputs}`;
    if (prevHandles.current !== key) {
      prevHandles.current = key;
      updateNodeInternals(id);
    }
  }, [inputs, outputs, id, updateNodeInternals]);

  // --- Collapse (branch only) ---
  const collapsed = !!data.collapsed;
  const onToggleCollapse = data.onToggleCollapse;
  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();
      if (onToggleCollapse) onToggleCollapse(id, !collapsed);
    },
    [id, collapsed, onToggleCollapse]
  );

  // --- Box styling per variant ---
  const baseBox = {
    width,
    height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: isMerge ? 11 : 13,
    fontFamily: 'sans-serif',
    position: 'relative',
    boxSizing: 'border-box',
  };

  let variantBox;
  if (isMerge) {
    variantBox = {
      borderRadius: '50%',
      background: selected ? '#e3f2fd' : '#fff',
      border: selected ? '2px solid #1976d2' : '2px solid #666',
    };
  } else if (isBranch) {
    variantBox = {
      borderRadius: 4,
      background: selected ? '#e3f2fd' : '#e8f5e9',
      border: selected ? '2px solid #1976d2' : '1px solid #4caf50',
    };
  } else {
    // square (default)
    variantBox = {
      borderRadius: 4,
      background: selected ? '#e3f2fd' : '#fff',
      border: selected ? '2px solid #1976d2' : '1px solid #999',
    };
  }

  const boxStyle = { ...baseBox, ...variantBox, ...styleProp };

  // --- Render handles ---
  let handles;
  if (isMerge) {
    const size = width;
    handles = (
      <>
        <Handle
          type="target"
          position={Position.Top}
          id="input-0"
          style={{
            width: size,
            height: size,
            top: 0,
            left: 0,
            borderRadius: '50%',
            transform: 'none',
            opacity: 0,
            background: 'transparent',
            border: 'none',
          }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="output-0"
          style={{
            background: '#666',
            width: 6,
            height: 6,
          }}
        />
      </>
    );
  } else {
    handles = (
      <>
        {Array.from({ length: inputs }, (_, i) => {
          const offset = (i - (inputs - 1) / 2) * 8;
          return (
            <Handle
              key={`input-${i}`}
              type="target"
              position={Position.Top}
              id={`input-${i}`}
              style={{
                left: `calc(50% + ${offset}px)`,
                transform: 'translateX(-50%)',
                background: 'transparent',
                width: 1,
                height: 1,
                border: 'none',
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
          );
        })}
        {Array.from({ length: outputs }, (_, i) => {
          const offset = (i - (outputs - 1) / 2) * 8;
          return (
            <Handle
              key={`output-${i}`}
              type="source"
              position={Position.Bottom}
              id={`output-${i}`}
              style={{
                left: `calc(50% + ${offset}px)`,
                transform: 'translateX(-50%)',
                background: 'transparent',
                width: 1,
                height: 1,
                border: 'none',
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
          );
        })}
      </>
    );
  }

  // --- Label ---
  const label = data.label || '';

  return (
    <div style={boxStyle}>
      {/* Label — absolutely positioned above the box */}
      {label && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: width,
          textAlign: 'center',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word',
          marginBottom: 4,
          fontSize: 12,
          fontFamily: 'sans-serif',
          lineHeight: 1.3,
          pointerEvents: 'none',
          background: '#fff',
        }}>
          {label}
        </div>
      )}

      {/* Custom content inside the box */}
      {children}

      {/* Handles */}
      {handles}

      {/* Collapse button — branch variant only */}
      {isBranch && (
        <button
          onClick={handleToggle}
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 18,
            height: 18,
            padding: 0,
            border: '1px solid #999',
            borderRadius: 3,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: '16px',
            textAlign: 'center',
            color: '#333',
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '+' : '\u2212'}
        </button>
      )}

      {/* AddNodeMenu */}
      {data.renderMenu && (
        <AddNodeMenu renderMenu={data.renderMenu} />
      )}
    </div>
  );
});

export default NodeShell;
