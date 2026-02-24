import { getVisibleGraph } from "./layoutEngine.js";
import { layoutGraphDagre } from "./dagreLayout.js";
import {
    nextOutputIdx,
    normalizeEdge,
    assignHandles,
    reindexHandlesAfterDelete,
    findMergeNode,
    placeNewNodes,
} from "./graphUtils.js";

/**
 * Toggle a node's collapsed state and re-layout visible graph.
 * Returns { nodes, edges }.
 */
export function toggleCollapse(nodes, edges, nodeId, collapsed) {
    const updatedNodes = nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, collapsed } } : n,
    );
    const { visibleNodes: vNodes, visibleEdges: vEdges } = getVisibleGraph(updatedNodes, edges);
    const positioned = layoutGraphDagre(vNodes, vEdges);
    const posMap = new Map(positioned.map((n) => [n.id, n.position]));
    const finalNodes = updatedNodes.map((n) => {
        const pos = posMap.get(n.id);
        return pos ? { ...n, position: pos } : n;
    });
    return { nodes: finalNodes, edges };
}

/**
 * Add child node(s) to a parent using a factory function.
 * createNode: (parentId, type, context) => { nodes, edges } | null
 * Returns { nodes, edges } or null.
 */
export function addNode(nodes, edges, parentId, type, createNode) {
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) return null;

    const mergeNodeId = findMergeNode(parentId, nodes, edges);

    const context = {
        parentNode,
        mergeNodeId,
        existingOutputCount: nextOutputIdx(parentId, edges),
    };

    if (!createNode) return null;
    const result = createNode(parentId, type, context);
    if (!result) return null;

    const { nodes: rawNewNodes, edges: rawNewEdges } = result;

    // Ensure new nodes have position
    const newNodes = rawNewNodes.map((n) => ({
        ...n,
        position: n.position || { x: 0, y: 0 },
    }));

    // Normalize and assign handles to new edges
    const normalizedNewEdges = rawNewEdges.map(normalizeEdge);
    const newEdges = assignHandles(normalizedNewEdges, edges);

    // Collect existing direct children of parent
    const existingSiblingIds = edges
        .filter((e) => e.source === parentId)
        .map((e) => e.target);
    const existingSiblings = nodes.filter((n) => existingSiblingIds.includes(n.id));

    // Mini graph: parent + existing siblings + new nodes
    const miniNodes = [parentNode, ...existingSiblings, ...newNodes];
    const newNodeIds = new Set(newNodes.map((n) => n.id));
    const siblingIds = new Set(existingSiblingIds);
    const miniEdges = [
        ...edges.filter((e) => e.source === parentId && siblingIds.has(e.target)),
        ...newEdges.filter((e) => {
            const miniIds = new Set(miniNodes.map((n) => n.id));
            return miniIds.has(e.source) && miniIds.has(e.target);
        }),
    ];

    const mini = layoutGraphDagre(miniNodes, miniEdges);
    const miniParent = mini.find((n) => n.id === parentId);
    if (!miniParent) return null;

    const dx = parentNode.position.x - miniParent.position.x;
    const dy = parentNode.position.y - miniParent.position.y;

    const posMap = new Map();
    for (const n of mini) {
        if (n.id === parentId) continue;
        posMap.set(n.id, { x: n.position.x + dx, y: n.position.y + dy });
    }

    const allNextEdges = [...edges, ...newEdges];
    const updatedNodes = nodes.map((n) => {
        const pos = posMap.get(n.id);
        return pos ? { ...n, position: pos } : n;
    });
    const positionedNew = newNodes.map((n) => ({
        ...n,
        position: posMap.get(n.id) || n.position,
    }));

    const finalNodes = [...updatedNodes, ...positionedNew];
    return { nodes: finalNodes, edges: allNextEdges };
}

/**
 * Insert node(s) inline on an edge using a factory function.
 * createNodeInline: (edgeId, sourceId, targetId, type, context) => { nodes, edges } | null
 * Returns { nodes, edges } or null.
 */
export function addNodeInline(nodes, edges, edgeId, type, createNodeInline) {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return null;

    const { source: sourceId, target: targetId } = edge;
    const parentNode = nodes.find((n) => n.id === sourceId);
    const updatedEdges = edges.filter((e) => e.id !== edgeId);

    if (!createNodeInline) return null;
    const result = createNodeInline(edgeId, sourceId, targetId, type, { edge });
    if (!result) return null;

    const { nodes: rawNewNodes, edges: rawNewEdges } = result;

    const newNodes = rawNewNodes.map((n) => ({
        ...n,
        position: n.position || { x: 0, y: 0 },
    }));

    const normalizedNewEdges = rawNewEdges.map(normalizeEdge);
    const newEdges = assignHandles(normalizedNewEdges, updatedEdges);

    const allFinalEdges = [...updatedEdges, ...newEdges];
    const finalNodes = placeNewNodes(sourceId, parentNode, nodes, newNodes, newEdges, updatedEdges);
    return { nodes: finalNodes, edges: allFinalEdges };
}

/**
 * Connect two existing nodes using a factory function.
 * connectFactory: (sourceId, targetId, context) => { edge } | null
 * Returns { nodes, edges } or null.
 */
export function connectNodes(nodes, edges, sourceId, targetId, connectFactory) {
    if (!connectFactory) return null;
    const result = connectFactory(sourceId, targetId, {});
    if (!result) return null;

    const rawEdge = normalizeEdge(result.edge);
    const [assignedEdge] = assignHandles([rawEdge], edges);

    const allNextEdges = [...edges, assignedEdge];
    return { nodes, edges: allNextEdges };
}

/**
 * Delete an edge and reindex handles.
 * Returns { nodes, edges } or null.
 */
export function deleteEdge(nodes, edges, edgeId) {
    const deleted = edges.find((e) => e.id === edgeId);
    if (!deleted) return null;

    const remaining = edges.filter((e) => e.id !== edgeId);
    const reindexed = reindexHandlesAfterDelete(remaining, deleted);
    return { nodes, edges: reindexed };
}

/**
 * Re-layout all nodes using dagre.
 * Returns { nodes, edges }.
 */
export function layoutAll(nodes, edges) {
    const finalNodes = layoutGraphDagre(nodes, edges);
    return { nodes: finalNodes, edges };
}
