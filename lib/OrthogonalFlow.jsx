import React, { useCallback, useMemo, useRef, useEffect } from "react";
import ReactFlow, {
    ReactFlowProvider,
    MarkerType,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import OrthogonalEdge from "./OrthogonalEdge.jsx";
import EdgeRoutingProvider from "./EdgeRoutingProvider.jsx";
import { getVisibleGraph } from "./layoutEngine.js";
import {
    toggleCollapse,
    addNode,
    addNodeInline,
    connectNodes,
    deleteEdge,
    layoutAll,
} from "./graphActions.js";

const builtInEdgeTypes = { orthogonal: OrthogonalEdge };

/**
 * Internal component that renders inside ReactFlowProvider.
 */
function OrthogonalFlowInner({
    nodes,
    edges,
    onChange,
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

    const mergedNodeTypes = useMemo(
        () => userNodeTypes || {},
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

        return { visibleNodes: finalNodes, visibleEdges: edgesWithCallbacks };
    }, [nodes, edges, onToggleCollapse, handleDeleteEdge]);

    // --- ReactFlow event handlers ---
    const onNodesChange = useCallback((changes) => {
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const nextNodes = applyNodeChanges(changes, curNodes);
        fireChange(nextNodes, curEdges);
    }, [fireChange]);

    const onEdgesChange = useCallback((changes) => {
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const nextEdges = applyEdgeChanges(changes, curEdges);
        fireChange(curNodes, nextEdges);
    }, [fireChange]);

    const onConnect = useCallback((params) => {
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const nextEdges = addEdge(
            { ...params, type: "orthogonal", markerEnd: { type: MarkerType.ArrowClosed } },
            curEdges,
        );
        fireChange(curNodes, nextEdges);
    }, [fireChange]);

    return (
        <EdgeRoutingProvider config={config}>
            <ReactFlow
                nodes={visibleNodes}
                edges={visibleEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
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
 *   nodes/edges        - controlled state from app
 *   onChange            - ({ nodes, edges }) => void
 *   onCreateNode        - factory for new nodes
 *   onCreateNodeInline  - factory for inline node insertion
 *   onConnectNodes      - factory for connecting existing nodes
 *   renderNodeMenu      - (nodeId) => ReactElement — app provides menu content
 *   renderEdgeMenu      - (edgeId, sourceId, targetId) => ReactElement
 *   api                 - object from useOrthogonalFlow()
 *   config              - layout/routing config overrides
 *   nodeTypes/edgeTypes - additional types (merged with built-ins)
 *   children            - rendered inside ReactFlow (Controls, Background, etc.)
 */
export default function OrthogonalFlow(props) {
    return (
        <ReactFlowProvider>
            <OrthogonalFlowInner {...props} />
        </ReactFlowProvider>
    );
}
