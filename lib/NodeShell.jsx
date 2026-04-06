import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { DEFAULTS } from './defaults.js';
import './nodeShell.css';

const CENTER_X_TRANSFORM = 'translateX(-50%)';

/**
 * NodeShell — generic wrapper for orthogonal-flow nodes.
 *
 * Provides: dynamic input/output handles, handle-count updates,
 * hidden phantom-output handle, an optional label above the box.
 *
 * Action buttons (delete, collapse, etc.) are NOT rendered here.
 * Each node type controls its own buttons via reusable components
 * such as DeleteButton and CollapseButton.
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

  const [hovered, setHovered] = useState(false);

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
  const labelEditable = data.editable != null ? data.editable : true;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (data && data.onLabelChange) {
      const finalLabel = draft.trim() || label;
      data.onLabelChange(id, finalLabel);
    }
  }, [data, draft, label, id]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setDraft(label);
      setEditing(false);
    }
  }, [commitEdit, label]);

  const startEditing = useCallback(() => {
    if (labelEditable && data && data.onLabelChange) {
      setDraft(label);
      setEditing(true);
    }
  }, [labelEditable, data, label]);

  const handleLabelKeyDown = useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEditing();
    }
  }, [startEditing]);

  const handleLabelClick = useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    if (e.detail === 2) startEditing();
  }, [startEditing]);

  let wrapperClass = 'eq-pipeline-compact-node-wrapper';
  if (className) wrapperClass += ' ' + className;
  if (selected) wrapperClass += ' selected';
  if (hovered) wrapperClass += ' hover';

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
    <div
      className={wrapperClass}
      style={baseStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Label — absolutely positioned above the box */}
      {label && (
        <div
          className="eq-pipeline-canvas-node-label"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: CENTER_X_TRANSFORM,
            maxWidth: width,
            textAlign: 'center',
            wordBreak: 'break-word',
            marginBottom: 4,
            fontSize: 12,
            fontFamily: 'sans-serif',
            lineHeight: 1.3,
            ...(editing
              ? { overflow: 'visible', display: 'block', pointerEvents: 'all' }
              : {
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  textOverflow: 'ellipsis',
                  pointerEvents: 'auto',
                }),
          }}
          role="button"
          tabIndex={0}
          onClick={handleLabelClick}
          onKeyDown={handleLabelKeyDown}>
          {editing ? (
            <input
              ref={inputRef}
              className="eq-pipeline-compact-node-label-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
            />
          ) : label}
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
            className="eq-pipeline-compact-node-handle"
            style={{
              left: `calc(50% + ${offset}px)`,
              transform: CENTER_X_TRANSFORM,
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
            className="eq-pipeline-compact-node-handle"
            style={{
              left: `calc(50% + ${offset}px)`,
              transform: CENTER_X_TRANSFORM,
            }}
          />
        );
      })}

      {/* Hidden handle for action edge connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="__action-output"
        className="eq-pipeline-compact-node-action-output-handle"
        style={{
          left: '50%',
          transform: CENTER_X_TRANSFORM,
          bottom: 0,
        }}
      />
    </div>
  );
});

export default NodeShell;
