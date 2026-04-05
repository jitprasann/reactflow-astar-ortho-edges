import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import ReactFlow, {
    ReactFlowProvider,
    MarkerType,
    addEdge,
    useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import OrthogonalEdge from "./OrthogonalEdge.jsx";
import ActionEdge from "./ActionEdge.jsx";
import ActionNode from "./ActionNode.jsx";
import EdgeRoutingProvider from "./EdgeRoutingProvider.jsx";
import ZoomBar from "./ZoomBar.jsx";
import { getVisibleGraph } from "./layoutEngine.js";
import { DEFAULTS, resolveNodeX, resolveNodeY } from "./defaults.js";
import { removeDanglingEdges, reindexAllHandles } from "./graphUtils.js";
import {
    toggleCollapse,
    addNode,
    addNodeInline,
    connectNodes,
    deleteNode,
    deleteEdge,
    layoutAll,
} from "./graphActions.js";

const builtInEdgeTypes = { orthogonal: OrthogonalEdge, __action: ActionEdge };
const builtInNodeTypes = { __action: ActionNode };

var RF_MIN_ZOOM = 0.5;
var RF_MAX_ZOOM = 2;

function rfZoomToSlider(rfZoom) {
    return Math.round(((rfZoom - RF_MIN_ZOOM) / (RF_MAX_ZOOM - RF_MIN_ZOOM)) * 100);
}

function sliderToRfZoom(slider) {
    return RF_MIN_ZOOM + (slider / 100) * (RF_MAX_ZOOM - RF_MIN_ZOOM);
}

function buildActionNodesAndEdges(finalNodes, outputCounts, hoveredNodeId, renderNodeMenuRef, cfg, onHoverParent, onUnhoverParent) {
    const actionNodes = [];
    const actionEdges = [];

    for (const n of finalNodes) {
        const isActive = n.id === hoveredNodeId || n.selected;
        if (!isActive || !renderNodeMenuRef.current) continue;

        const menuContent = renderNodeMenuRef.current(n.id);
        if (!menuContent) continue;

        const isDirectAction = menuContent && typeof menuContent === 'object' && typeof menuContent.onClick === 'function';

        const isConnected = (outputCounts.get(n.id) || 0) > 0;
        const pw = (n.data && n.data.width) || cfg.nodeWidth;
        const ph = (n.data && n.data.height) || cfg.nodeHeight;
        const vOffset = cfg.addButtonVerticalOffset || 16;
        const hOffset = isConnected ? (cfg.addButtonRightOffset ?? (pw / 2 + 8)) : 0;
        const size = cfg.addButtonSize || 24;

        const parentX = resolveNodeX(n);
        const parentY = resolveNodeY(n);

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
                renderMenu: isDirectAction ? undefined : () => menuContent,
                onDirectClick: isDirectAction ? menuContent.onClick : undefined,
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
            type: '__action',
            style: {},
            selectable: false,
            deletable: false,
            focusable: false,
        });
    }

    return { actionNodes, actionEdges };
}

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
    onDeleteNode: onDeleteNodeProp,
    onDeleteEdge: onDeleteEdgeProp,
    onLabelChange: onLabelChangeProp,
    deleteKeyCode: deleteKeyCodeProp,
    renderNodeMenu,
    renderEdgeMenu,
    edgeToolbar,
    nodeCallbacks,
    api,
    config,
    autoLayout,
    nodeTypes: userNodeTypes,
    edgeTypes: userEdgeTypes,
    children,
    ...rfProps
}) {
    const reactFlowInstance = useReactFlow();

    // Sanitize edges: remove dangling edges, then reindex ports
    const cleanEdges = useMemo(
        () => removeDanglingEdges(nodes, edges),
        [nodes, edges],
    );
    const sanitizedEdges = useMemo(
        () => reindexAllHandles(cleanEdges),
        [cleanEdges],
    );

    // Refs to always access latest state from callbacks
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    const edgesRef = useRef(sanitizedEdges);
    edgesRef.current = sanitizedEdges;

    // Stable refs for callbacks to avoid stale closure issues
    const onCreateNodeRef = useRef(onCreateNode);
    onCreateNodeRef.current = onCreateNode;
    const onCreateNodeInlineRef = useRef(onCreateNodeInline);
    onCreateNodeInlineRef.current = onCreateNodeInline;
    const onConnectNodesRef = useRef(onConnectNodes);
    onConnectNodesRef.current = onConnectNodes;
    const onDeleteNodeRef = useRef(onDeleteNodeProp);
    onDeleteNodeRef.current = onDeleteNodeProp;
    const onDeleteEdgeRef = useRef(onDeleteEdgeProp);
    onDeleteEdgeRef.current = onDeleteEdgeProp;
    const onLabelChangeRef = useRef(onLabelChangeProp);
    onLabelChangeRef.current = onLabelChangeProp;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const renderNodeMenuRef = useRef(renderNodeMenu);
    renderNodeMenuRef.current = renderNodeMenu;
    const renderEdgeMenuRef = useRef(renderEdgeMenu);
    renderEdgeMenuRef.current = renderEdgeMenu;
    const edgeToolbarRef = useRef(edgeToolbar);
    edgeToolbarRef.current = edgeToolbar;
    const appOnNodesChangeRef = useRef(appOnNodesChange);
    appOnNodesChangeRef.current = appOnNodesChange;
    const appOnEdgesChangeRef = useRef(appOnEdgesChange);
    appOnEdgesChangeRef.current = appOnEdgesChange;
    const nodeCallbacksRef = useRef(nodeCallbacks);
    nodeCallbacksRef.current = nodeCallbacks;


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

    const autoLayoutRef = useRef(autoLayout);
    autoLayoutRef.current = autoLayout;

    const fireChange = useCallback((nextNodes, nextEdges) => {
        if (onChangeRef.current) {
            if (autoLayoutRef.current) {
                const result = layoutAll(nextNodes, nextEdges);
                onChangeRef.current({ nodes: result.nodes, edges: result.edges });
            } else {
                onChangeRef.current({ nodes: nextNodes, edges: nextEdges });
            }
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
        const onDeleteEdgeFn = onDeleteEdgeRef.current;
        if (onDeleteEdgeFn) {
            const edge = edgesRef.current.find((e) => e.id === edgeId);
            const result = onDeleteEdgeFn(edgeId, edge, { nodes: nodesRef.current, edges: edgesRef.current });
            if (result) fireChange(result.nodes, result.edges);
        } else {
            const result = deleteEdge(nodesRef.current, edgesRef.current, edgeId);
            if (result) fireChange(result.nodes, result.edges);
        }
    }, [fireChange]);

    const handleDeleteNode = useCallback((nodeId) => {
        const onDeleteNodeFn = onDeleteNodeRef.current;
        if (onDeleteNodeFn) {
            const node = nodesRef.current.find((n) => n.id === nodeId);
            const result = onDeleteNodeFn(nodeId, node, { nodes: nodesRef.current, edges: edgesRef.current });
            if (result) fireChange(result.nodes, result.edges);
        } else {
            const result = deleteNode(nodesRef.current, edgesRef.current, nodeId);
            if (result) fireChange(result.nodes, result.edges);
        }
    }, [fireChange]);

    const handleLabelChange = useCallback((nodeId, newLabel) => {
        var finalLabel = newLabel;
        if (onLabelChangeRef.current) {
            var result = onLabelChangeRef.current(nodeId, newLabel, {
                nodes: nodesRef.current,
                edges: edgesRef.current,
            });
            if (result == null) return;
            finalLabel = result;
        }
        const updatedNodes = nodesRef.current.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, label: finalLabel } } : n
        );
        fireChange(updatedNodes, edgesRef.current);
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
        api.deleteNode = (nodeId) => handleDeleteNode(nodeId);
        api.layout = () => handleLayout();
        api.fitView = () => reactFlowInstance && reactFlowInstance.fitView();
        api.getViewport = function () {
            if (!reactFlowInstance) return null;
            var vp = reactFlowInstance.getViewport();
            return { x: vp.x, y: vp.y, zoom: rfZoomToSlider(vp.zoom) };
        };
        api.setViewport = function (vp) {
            if (!reactFlowInstance || !vp) return;
            reactFlowInstance.setViewport({ x: vp.x, y: vp.y, zoom: sliderToRfZoom(vp.zoom) });
        };
        api.getNodes = () => nodesRef.current;
        api.getEdges = () => edgesRef.current;
    }, [api, handleAddNode, handleAddNodeInline, handleConnectToExisting, handleDeleteEdge, handleDeleteNode, handleLayout, reactFlowInstance]);

    // --- Visible graph computation ---
    const { visibleNodes, visibleEdges } = useMemo(() => {
        const cfg = { ...DEFAULTS, ...(config || {}) };

        // Inject callbacks into node data
        const withCallbacks = nodes.map((n) => {
            const extra = {};
            extra.onToggleCollapse = onToggleCollapse;
            extra.onDeleteNode = handleDeleteNode;
            // Inject renderMenu so nodes can show app-provided menus
            if (renderNodeMenuRef.current) {
                extra.renderMenu = () => renderNodeMenuRef.current(n.id);
            }
            extra.onLabelChange = handleLabelChange;
            const custom = nodeCallbacksRef.current;
            if (custom) {
                const keys = Object.keys(custom);
                for (let i = 0; i < keys.length; i++) {
                    extra[keys[i]] = custom[keys[i]];
                }
            }
            return Object.keys(extra).length > 0
                ? { ...n, data: { ...n.data, ...extra } }
                : n;
        });

        const { visibleNodes: vn, visibleEdges: ve } = getVisibleGraph(withCallbacks, sanitizedEdges);

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
                _edgeToolbarConfig: edgeToolbarRef.current,
            },
        }));

        // --- Compute action nodes & edges ---
        const { actionNodes, actionEdges } = buildActionNodesAndEdges(
            finalNodes, outputCounts, hoveredNodeId, renderNodeMenuRef, cfg, onHoverParent, onUnhoverParent,
        );

        return {
            visibleNodes: finalNodes.concat(actionNodes),
            visibleEdges: edgesWithCallbacks.concat(actionEdges),
        };
    }, [nodes, sanitizedEdges, onToggleCollapse, handleDeleteEdge, handleDeleteNode, handleLabelChange, hoveredNodeId, config, onHoverParent, onUnhoverParent]);

    // --- ReactFlow event handlers ---
    const onNodesChange = useCallback((changes) => {
        if (!appOnNodesChangeRef.current) return;
        const realChanges = changes.filter((c) => !(c.id && c.id.startsWith('__action')));
        if (realChanges.length === 0) return;

        // Intercept remove changes to use handleDeleteNode
        const removeChanges = realChanges.filter((c) => c.type === 'remove');
        const otherChanges = realChanges.filter((c) => c.type !== 'remove');

        for (const rc of removeChanges) {
            handleDeleteNode(rc.id);
        }

        if (otherChanges.length > 0) {
            appOnNodesChangeRef.current(otherChanges);
        }
    }, [handleDeleteNode]);

    const onEdgesChange = useCallback((changes) => {
        if (!appOnEdgesChangeRef.current) return;
        const realChanges = changes.filter((c) => !(c.id && c.id.startsWith('__action')));
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

    var rawDefaultViewport = rfProps.defaultViewport;
    var convertedDefaultViewport = rawDefaultViewport
        ? { x: rawDefaultViewport.x, y: rawDefaultViewport.y, zoom: sliderToRfZoom(rawDefaultViewport.zoom) }
        : undefined;

    const [zoomLevel, setZoomLevel] = useState(function () {
        if (rawDefaultViewport && rawDefaultViewport.zoom != null) return rawDefaultViewport.zoom;
        return 33;
    });

    const handleZoomSliderChange = useCallback(function (e) {
        var value = Number(e.target.value);
        setZoomLevel(value);
        if (reactFlowInstance) {
            var vp = reactFlowInstance.getViewport();
            reactFlowInstance.setViewport({ x: vp.x, y: vp.y, zoom: sliderToRfZoom(value) });
        }
    }, [reactFlowInstance]);

    const handleMoveEnd = useCallback(function () {
        if (reactFlowInstance && rfProps.zoomOnScroll !== false) {
            var vp = reactFlowInstance.getViewport();
            setZoomLevel(rfZoomToSlider(vp.zoom));
        }
        if (rfProps.onMoveEnd) {
            rfProps.onMoveEnd.apply(null, arguments);
        }
    }, [reactFlowInstance, rfProps.onMoveEnd, rfProps.zoomOnScroll]);

    return (
        <EdgeRoutingProvider config={config}>
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
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
                    deleteKeyCode={deleteKeyCodeProp !== undefined ? deleteKeyCodeProp : "Delete"}
                    {...rfProps}
                    defaultViewport={convertedDefaultViewport}
                    onMoveEnd={rfProps.zoomOnScroll !== false ? handleMoveEnd : rfProps.onMoveEnd}
                >
                    {children}
                </ReactFlow>
                <ZoomBar zoomLevel={zoomLevel} onChange={handleZoomSliderChange} />
            </div>
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
 *   onDeleteNode         - (nodeId, node, { nodes, edges }) => { nodes, edges } — custom node deletion
 *   onDeleteEdge         - (edgeId, edge, { nodes, edges }) => { nodes, edges } — custom edge deletion
 *   deleteKeyCode        - key(s) for keyboard deletion (default: "Delete"). Use "Backspace", ["Delete","Backspace"], or null to disable
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
