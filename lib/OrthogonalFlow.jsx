import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import ReactFlow, {
    ReactFlowProvider,
    MarkerType,
    addEdge,
    useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import OrthogonalEdge from "./OrthogonalEdge.jsx";
import ActionNode from "./ActionNode.jsx";
import EdgeRoutingProvider from "./EdgeRoutingProvider.jsx";
import { getVisibleGraph } from "./layoutEngine.js";
import { DEFAULTS } from "./defaults.js";
import {
    toggleCollapse,
    addNode,
    addNodeInline,
    connectNodes,
    deleteEdge,
    layoutAll,
} from "./graphActions.js";

const builtInEdgeTypes = { orthogonal: OrthogonalEdge };
const builtInNodeTypes = { __action: ActionNode };

/**
 * Internal component that renders inside ReactFlowProvider.
 */
function OrthogonalFlowInner({
    nodes,
    edges,
    onChange,
    onNodesChange: appOnNodesChange,
    onEdgesChange: appOnEdgesChange,
    onCreateNode,
    onCreateNodeInline,
    onConnectNodes,
    renderNodeMenu,
    renderEdgeMenu,
    api,
    config,
    nodeTypes: userNodeTypes,
    edgeTypes: userEdgeTypes,
    children,
    ...rfProps
}) {
    const reactFlowInstance = useReactFlow();

    // Refs to always access latest state from callbacks
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    const edgesRef = useRef(edges);
    edgesRef.current = edges;

    // Stable refs for callbacks to avoid stale closure issues
    const onCreateNodeRef = useRef(onCreateNode);
    onCreateNodeRef.current = onCreateNode;
    const onCreateNodeInlineRef = useRef(onCreateNodeInline);
    onCreateNodeInlineRef.current = onCreateNodeInline;
    const onConnectNodesRef = useRef(onConnectNodes);
    onConnectNodesRef.current = onConnectNodes;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const renderNodeMenuRef = useRef(renderNodeMenu);
    renderNodeMenuRef.current = renderNodeMenu;
    const renderEdgeMenuRef = useRef(renderEdgeMenu);
    renderEdgeMenuRef.current = renderEdgeMenu;
    const appOnNodesChangeRef = useRef(appOnNodesChange);
    appOnNodesChangeRef.current = appOnNodesChange;
    const appOnEdgesChangeRef = useRef(appOnEdgesChange);
    appOnEdgesChangeRef.current = appOnEdgesChange;

    // --- Action node hover tracking ---
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const hoverTimeoutRef = useRef(null);
    const connectStartRef = useRef(null);

    const clearHoverTimeout = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
    }, []);

    const setHoveredImmediate = useCallback((id) => {
        clearHoverTimeout();
        setHoveredNodeId(id);
    }, [clearHoverTimeout]);

    const setHoveredDelayed = useCallback(() => {
        clearHoverTimeout();
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredNodeId(null);
        }, 150);
    }, [clearHoverTimeout]);

    const onNodeMouseEnter = useCallback((_, node) => {
        // Suppress action node appearance while dragging a connection
        if (connectStartRef.current) return;
        // If hovering an action node, treat as hovering its parent
        const id = node.id.startsWith('__action-') ? node.id.replace('__action-', '') : node.id;
        setHoveredImmediate(id);
    }, [setHoveredImmediate]);

    const onNodeMouseLeave = useCallback(() => {
        setHoveredDelayed();
    }, [setHoveredDelayed]);

    // Callbacks passed to action nodes for hover propagation
    const onHoverParent = useCallback((parentId) => {
        setHoveredImmediate(parentId);
    }, [setHoveredImmediate]);

    const onUnhoverParent = useCallback(() => {
        setHoveredDelayed();
    }, [setHoveredDelayed]);

    const mergedNodeTypes = useMemo(
        () => ({ ...builtInNodeTypes, ...(userNodeTypes || {}) }),
        [userNodeTypes],
    );
    const mergedEdgeTypes = useMemo(
        () => ({ ...builtInEdgeTypes, ...(userEdgeTypes || {}) }),
        [userEdgeTypes],
    );

    // --- Internal handlers ---

    const fireChange = useCallback((nextNodes, nextEdges) => {
        if (onChangeRef.current) {
            onChangeRef.current({ nodes: nextNodes, edges: nextEdges });
        }
    }, []);

    const onToggleCollapse = useCallback((nodeId, collapsed) => {
        const result = toggleCollapse(nodesRef.current, edgesRef.current, nodeId, collapsed);
        if (result) fireChange(result.nodes, result.edges);
    }, [fireChange]);

    const handleAddNode = useCallback((parentId, type) => {
        const result = addNode(nodesRef.current, edgesRef.current, parentId, type, onCreateNodeRef.current);
        if (result) fireChange(result.nodes, result.edges);
    }, [fireChange]);

    const handleAddNodeInline = useCallback((edgeId, type) => {
        const result = addNodeInline(nodesRef.current, edgesRef.current, edgeId, type, onCreateNodeInlineRef.current);
        if (result) fireChange(result.nodes, result.edges);
    }, [fireChange]);

    const handleConnectToExisting = useCallback((sourceNodeId, targetNodeId) => {
        const result = connectNodes(nodesRef.current, edgesRef.current, sourceNodeId, targetNodeId, onConnectNodesRef.current);
        if (result) fireChange(result.nodes, result.edges);
    }, [fireChange]);

    const handleDeleteEdge = useCallback((edgeId) => {
        const result = deleteEdge(nodesRef.current, edgesRef.current, edgeId);
        if (result) fireChange(result.nodes, result.edges);
    }, [fireChange]);

    const handleLayout = useCallback(() => {
        const result = layoutAll(nodesRef.current, edgesRef.current);
        fireChange(result.nodes, result.edges);
    }, [fireChange]);

    // --- Attach methods to api object ---
    useEffect(() => {
        if (!api) return;
        api.addNode = (parentId, type) => handleAddNode(parentId, type);
        api.addNodeInline = (edgeId, type) => handleAddNodeInline(edgeId, type);
        api.connectNodes = (sourceId, targetId) => handleConnectToExisting(sourceId, targetId);
        api.deleteEdge = (edgeId) => handleDeleteEdge(edgeId);
        api.layout = () => handleLayout();
        api.fitView = () => reactFlowInstance?.fitView();
        api.getNodes = () => nodesRef.current;
        api.getEdges = () => edgesRef.current;
    }, [api, handleAddNode, handleAddNodeInline, handleConnectToExisting, handleDeleteEdge, handleLayout, reactFlowInstance]);

    // --- Visible graph computation ---
    const { visibleNodes, visibleEdges } = useMemo(() => {
        const cfg = { ...DEFAULTS, ...(config || {}) };

        // Inject callbacks into node data
        const withCallbacks = nodes.map((n) => {
            const extra = {};
            extra.onToggleCollapse = onToggleCollapse;
            // Inject renderMenu so nodes can show app-provided menus
            if (renderNodeMenuRef.current) {
                extra.renderMenu = () => renderNodeMenuRef.current(n.id);
            }
            return Object.keys(extra).length > 0
                ? { ...n, data: { ...n.data, ...extra } }
                : n;
        });

        const { visibleNodes: vn, visibleEdges: ve } = getVisibleGraph(withCallbacks, edges);

        // Derive inputs/outputs counts from visible edges
        const outputCounts = new Map();
        const inputCounts = new Map();
        for (const e of ve) {
            const outIdx = parseInt((e.sourceHandle || "output-0").split("-")[1], 10) || 0;
            const inIdx = parseInt((e.targetHandle || "input-0").split("-")[1], 10) || 0;
            outputCounts.set(e.source, Math.max(outputCounts.get(e.source) || 0, outIdx + 1));
            inputCounts.set(e.target, Math.max(inputCounts.get(e.target) || 0, inIdx + 1));
        }

        const finalNodes = vn.map((n) => ({
            ...n,
            data: {
                ...n.data,
                inputs: inputCounts.get(n.id) || 0,
                outputs: outputCounts.get(n.id) || 0,
            },
        }));

        // Inject edge callbacks
        const edgesWithCallbacks = ve.map((e) => ({
            ...e,
            data: {
                ...(e.data || {}),
                onDeleteEdge: handleDeleteEdge,
                renderEdgeMenu: renderEdgeMenuRef.current
                    ? () => renderEdgeMenuRef.current(e.id, e.source, e.target)
                    : undefined,
            },
        }));

        // --- Compute action nodes & edges ---
        const actionNodes = [];
        const actionEdges = [];

        for (const n of finalNodes) {
            const isActive = n.id === hoveredNodeId || n.selected;
            if (!isActive || !renderNodeMenuRef.current) continue;
            if (n.data?.isMerge) continue;

            const isConnected = (outputCounts.get(n.id) || 0) > 0;
            const pw = n.data?.width || cfg.nodeWidth;
            const ph = n.data?.height || cfg.nodeHeight;
            const vOffset = cfg.addButtonVerticalOffset || 16;
            const hOffset = isConnected ? (cfg.addButtonRightOffset ?? (pw / 2 + 8)) : 0;
            const size = cfg.addButtonSize || 24;

            const parentX = n.positionAbsolute?.x ?? n.position.x;
            const parentY = n.positionAbsolute?.y ?? n.position.y;

            actionNodes.push({
                id: `__action-${n.id}`,
                type: '__action',
                position: {
                    x: parentX + pw / 2 + hOffset - size / 2,
                    y: parentY + ph + vOffset,
                },
                data: {
                    parentId: n.id,
                    size,
                    renderMenu: () => renderNodeMenuRef.current(n.id),
                    onHoverParent,
                    onUnhoverParent,
                },
                selectable: false,
                draggable: false,
                connectable: true,
                focusable: false,
            });

            actionEdges.push({
                id: `__action-edge-${n.id}`,
                source: n.id,
                sourceHandle: '__action-output',
                target: `__action-${n.id}`,
                targetHandle: '__action-input',
                type: 'default',
                pathOptions: { curvature: 1.0 },
                style: {
                    stroke: cfg.edgeStrokeColor,
                    strokeWidth: cfg.edgeStrokeWidth,
                },
                selectable: false,
                deletable: false,
                focusable: false,
            });
        }

        return {
            visibleNodes: finalNodes.concat(actionNodes),
            visibleEdges: edgesWithCallbacks.concat(actionEdges),
        };
    }, [nodes, edges, onToggleCollapse, handleDeleteEdge, hoveredNodeId, config, onHoverParent, onUnhoverParent]);

    // --- ReactFlow event handlers ---
    const onNodesChange = useCallback((changes) => {
        if (!appOnNodesChangeRef.current) return;
        const realChanges = changes.filter((c) => !c.id?.startsWith('__action'));
        if (realChanges.length === 0) return;
        appOnNodesChangeRef.current(realChanges);
    }, []);

    const onEdgesChange = useCallback((changes) => {
        if (!appOnEdgesChangeRef.current) return;
        const realChanges = changes.filter((c) => !c.id?.startsWith('__action'));
        if (realChanges.length === 0) return;
        appOnEdgesChangeRef.current(realChanges);
    }, []);

    // --- Connection via drag from action node (or any handle) ---
    const onConnectStart = useCallback((_, params) => {
        connectStartRef.current = params;
    }, []);

    const onConnectEnd = useCallback((event) => {
        const startParams = connectStartRef.current;
        connectStartRef.current = null;
        if (!startParams) return;

        // Find the node element under the cursor
        const target = (event.target || event.srcElement);
        const nodeEl = target.closest('.react-flow__node');
        if (!nodeEl) return;

        const targetId = nodeEl.getAttribute('data-id');
        if (!targetId || targetId.startsWith('__action')) return;

        // Resolve source — remap action node to parent
        let sourceId = startParams.nodeId;
        if (sourceId.startsWith('__action-')) {
            sourceId = sourceId.replace('__action-', '');
        }

        // Ignore self-connections
        if (sourceId === targetId) return;

        if (onConnectNodesRef.current) {
            const result = connectNodes(
                nodesRef.current,
                edgesRef.current,
                sourceId,
                targetId,
                onConnectNodesRef.current,
            );
            if (result) fireChange(result.nodes, result.edges);
        } else {
            const nextEdges = addEdge(
                {
                    source: sourceId,
                    target: targetId,
                    type: "orthogonal",
                    markerEnd: { type: MarkerType.ArrowClosed },
                },
                edgesRef.current,
            );
            fireChange(nodesRef.current, nextEdges);
        }
    }, [fireChange]);

    // Keep onConnect for normal handle-to-handle connections
    const onConnect = useCallback((params) => {
        let source = params.source;
        let sourceHandle = params.sourceHandle;

        // Remap action node source to parent node
        if (source.startsWith('__action-')) {
            source = source.replace('__action-', '');
            sourceHandle = undefined;
        }

        // Ignore self-connections
        if (source === params.target) return;

        if (onConnectNodesRef.current) {
            const result = connectNodes(
                nodesRef.current,
                edgesRef.current,
                source,
                params.target,
                onConnectNodesRef.current,
            );
            if (result) fireChange(result.nodes, result.edges);
        } else {
            const nextEdges = addEdge(
                {
                    ...params,
                    source,
                    sourceHandle,
                    type: "orthogonal",
                    markerEnd: { type: MarkerType.ArrowClosed },
                },
                edgesRef.current,
            );
            fireChange(nodesRef.current, nextEdges);
        }
    }, [fireChange]);

    return (
        <EdgeRoutingProvider config={config}>
            <ReactFlow
                nodes={visibleNodes}
                edges={visibleEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                nodeTypes={mergedNodeTypes}
                edgeTypes={mergedEdgeTypes}
                deleteKeyCode="Delete"
                {...rfProps}
            >
                {children}
            </ReactFlow>
        </EdgeRoutingProvider>
    );
}

/**
 * OrthogonalFlow — wrapper component that encapsulates all graph management logic.
 *
 * Props:
 *   nodes/edges          - controlled state from app
 *   onChange              - ({ nodes, edges }) => void
 *   onNodesChange        - (changes) => void — app handles applyNodeChanges
 *   onEdgesChange        - (changes) => void — app handles applyEdgeChanges
 *   onCreateNode         - factory for new nodes
 *   onCreateNodeInline   - factory for inline node insertion
 *   onConnectNodes       - factory for connecting existing nodes
 *   renderNodeMenu       - (nodeId) => ReactElement — app provides menu content
 *   renderEdgeMenu       - (edgeId, sourceId, targetId) => ReactElement
 *   api                  - object from useOrthogonalFlow()
 *   config               - layout/routing config overrides
 *   nodeTypes/edgeTypes  - additional types (merged with built-ins)
 *   children             - rendered inside ReactFlow (Controls, Background, etc.)
 */
export default function OrthogonalFlow(props) {
    return (
        <ReactFlowProvider>
            <OrthogonalFlowInner {...props} />
        </ReactFlowProvider>
    );
}
