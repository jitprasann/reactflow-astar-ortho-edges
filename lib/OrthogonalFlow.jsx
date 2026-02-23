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
import { layoutGraphDagre } from "./dagreLayout.js";
import {
    nextOutputIdx,
    nextInputIdx,
    injectHandleCounts,
    normalizeEdge,
    assignHandles,
    reindexHandlesAfterDelete,
    findMergeNode,
    placeNewNodes,
} from "./graphUtils.js";

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
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const updatedNodes = curNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, collapsed } } : n,
        );
        const { visibleNodes: vNodes, visibleEdges: vEdges } = getVisibleGraph(updatedNodes, curEdges);
        const positioned = layoutGraphDagre(vNodes, vEdges);
        const posMap = new Map(positioned.map((n) => [n.id, n.position]));
        const finalNodes = injectHandleCounts(
            updatedNodes.map((n) => {
                const pos = posMap.get(n.id);
                return pos ? { ...n, position: pos } : n;
            }),
            curEdges,
        );
        fireChange(finalNodes, curEdges);
    }, [fireChange]);

    const handleAddNode = useCallback((parentId, type) => {
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const parentNode = curNodes.find((n) => n.id === parentId);
        if (!parentNode) return;

        const mergeNodeId = parentNode.type === "branch"
            ? findMergeNode(parentId, curNodes, curEdges)
            : null;

        const context = {
            parentNode,
            mergeNodeId,
            existingOutputCount: nextOutputIdx(parentId, curEdges),
        };

        const factory = onCreateNodeRef.current;
        if (!factory) return;
        const result = factory(parentId, type, context);
        if (!result) return;

        const { nodes: rawNewNodes, edges: rawNewEdges } = result;

        // Ensure new nodes have position
        const newNodes = rawNewNodes.map((n) => ({
            ...n,
            position: n.position || { x: 0, y: 0 },
        }));

        // Normalize and assign handles to new edges
        const normalizedNewEdges = rawNewEdges.map(normalizeEdge);
        const newEdges = assignHandles(normalizedNewEdges, curEdges);

        // Collect existing direct children of parent
        const existingSiblingIds = curEdges
            .filter((e) => e.source === parentId)
            .map((e) => e.target);
        const existingSiblings = curNodes.filter((n) => existingSiblingIds.includes(n.id));

        // Mini graph: parent + existing siblings + new nodes
        const miniNodes = [parentNode, ...existingSiblings, ...newNodes];
        const newNodeIds = new Set(newNodes.map((n) => n.id));
        const siblingIds = new Set(existingSiblingIds);
        const miniEdges = [
            ...curEdges.filter((e) => e.source === parentId && siblingIds.has(e.target)),
            ...newEdges.filter((e) => {
                const miniIds = new Set(miniNodes.map((n) => n.id));
                return miniIds.has(e.source) && miniIds.has(e.target);
            }),
        ];

        const mini = layoutGraphDagre(miniNodes, miniEdges);
        const miniParent = mini.find((n) => n.id === parentId);
        if (!miniParent) return;

        const dx = parentNode.position.x - miniParent.position.x;
        const dy = parentNode.position.y - miniParent.position.y;

        const posMap = new Map();
        for (const n of mini) {
            if (n.id === parentId) continue;
            posMap.set(n.id, { x: n.position.x + dx, y: n.position.y + dy });
        }

        const allNextEdges = [...curEdges, ...newEdges];
        const updatedNodes = curNodes.map((n) => {
            const pos = posMap.get(n.id);
            return pos ? { ...n, position: pos } : n;
        });
        const positionedNew = newNodes.map((n) => ({
            ...n,
            position: posMap.get(n.id) || n.position,
        }));

        const finalNodes = injectHandleCounts([...updatedNodes, ...positionedNew], allNextEdges);
        fireChange(finalNodes, allNextEdges);
    }, [fireChange]);

    const handleAddNodeInline = useCallback((edgeId, type) => {
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const edge = curEdges.find((e) => e.id === edgeId);
        if (!edge) return;

        const { source: sourceId, target: targetId } = edge;
        const parentNode = curNodes.find((n) => n.id === sourceId);
        const updatedEdges = curEdges.filter((e) => e.id !== edgeId);

        const factory = onCreateNodeInlineRef.current;
        if (!factory) return;
        const result = factory(edgeId, sourceId, targetId, type, { edge });
        if (!result) return;

        const { nodes: rawNewNodes, edges: rawNewEdges } = result;

        const newNodes = rawNewNodes.map((n) => ({
            ...n,
            position: n.position || { x: 0, y: 0 },
        }));

        const normalizedNewEdges = rawNewEdges.map(normalizeEdge);
        const newEdges = assignHandles(normalizedNewEdges, updatedEdges);

        const allFinalEdges = [...updatedEdges, ...newEdges];
        const finalNodes = injectHandleCounts(
            placeNewNodes(sourceId, parentNode, curNodes, newNodes, newEdges, updatedEdges),
            allFinalEdges,
        );
        fireChange(finalNodes, allFinalEdges);
    }, [fireChange]);

    const handleConnectToExisting = useCallback((sourceNodeId, targetNodeId) => {
        const curEdges = edgesRef.current;
        const curNodes = nodesRef.current;

        const factory = onConnectNodesRef.current;
        if (!factory) return;
        const result = factory(sourceNodeId, targetNodeId, {});
        if (!result) return;

        const rawEdge = normalizeEdge(result.edge);
        const [assignedEdge] = assignHandles([rawEdge], curEdges);

        const allNextEdges = [...curEdges, assignedEdge];
        const finalNodes = injectHandleCounts(curNodes, allNextEdges);
        fireChange(finalNodes, allNextEdges);
    }, [fireChange]);

    const handleDeleteEdge = useCallback((edgeId) => {
        const curEdges = edgesRef.current;
        const curNodes = nodesRef.current;
        const deleted = curEdges.find((e) => e.id === edgeId);
        if (!deleted) return;

        const remaining = curEdges.filter((e) => e.id !== edgeId);
        const reindexed = reindexHandlesAfterDelete(remaining, deleted);
        const finalNodes = injectHandleCounts(curNodes, reindexed);
        fireChange(finalNodes, reindexed);
    }, [fireChange]);

    const handleLayout = useCallback(() => {
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const finalNodes = injectHandleCounts(layoutGraphDagre(curNodes, curEdges), curEdges);
        fireChange(finalNodes, curEdges);
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
            if (n.type === "branch") extra.onToggleCollapse = onToggleCollapse;
            // Inject renderMenu for nodes that aren't merge nodes
            if (n.type !== "merge" && renderNodeMenuRef.current) {
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
