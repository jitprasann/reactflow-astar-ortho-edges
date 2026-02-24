import React, { memo, useEffect, useRef } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { DEFAULTS } from './defaults.js';

/**
 * NodeShell — generic wrapper for orthogonal-flow nodes.
 *
 * Provides: dynamic input/output handles, handle-count updates,
 * hidden phantom-output handle, and an optional label above the box.
 *
 * All styling and domain-specific behavior (collapse buttons, variant
 * colors, special handle shapes) belong in the app's node components.
 *
 * Props:
 *   id        - node ID (from ReactFlow)
 *   data      - node data object (from ReactFlow)
 *   selected  - boolean (from ReactFlow)
 *   children  - content rendered inside the node box
 *   className - CSS class(es) for the outer box
 *   style     - inline style overrides for the outer box
 */
const NodeShell = memo(function NodeShell({ id, data, selected, children, className, style }) {
  const width = data.width || DEFAULTS.nodeWidth;
  const height = data.height || DEFAULTS.nodeHeight;

  const inputs = data.inputs || 0;
  const outputs = data.outputs || 0;

  const updateNodeInternals = useUpdateNodeInternals();
  const prevHandles = useRef(`${inputs}-${outputs}`);
  useEffect(() => {
    const key = `${inputs}-${outputs}`;
    if (prevHandles.current !== key) {
      prevHandles.current = key;
      updateNodeInternals(id);
    }
  }, [inputs, outputs, id, updateNodeInternals]);

  const label = data.label || '';

  const baseStyle = {
    width,
    height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontFamily: 'sans-serif',
    position: 'relative',
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <div className={className} style={baseStyle}>
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

      {children}

      {/* Dynamic input handles */}
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

      {/* Dynamic output handles */}
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

      {/* Hidden handle for phantom edge connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="__phantom-output"
        style={{
          opacity: 0,
          width: 1,
          height: 1,
          border: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

export default NodeShell;
