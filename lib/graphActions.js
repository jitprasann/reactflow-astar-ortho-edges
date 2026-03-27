import { getVisibleGraph } from "./layoutEngine.js";
import { layoutGraphDagre } from "./dagreLayout.js";
import {
    nextOutputIdx,
    normalizeEdge,
    findMergeNode,
    findOwningBranch,
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

// ---------------------------------------------------------------------------
// Partition helper — split callback-returned items into updates vs additions
// ---------------------------------------------------------------------------

function partitionByExisting(items, existingIds) {
    const updates = [];
    const additions = [];
    for (const item of items) {
        if (existingIds.has(item.id)) {
            updates.push(item);
        } else {
            additions.push(item);
        }
    }
    return { updates, additions };
}

function applyNodeUpdates(nodes, updateNodes) {
    if (updateNodes.length === 0) return nodes;
    const map = new Map(updateNodes.map((n) => [n.id, n]));
    return nodes.map((n) => {
        const update = map.get(n.id);
        if (!update) return n;
        return { ...n, ...update, position: update.position || n.position };
    });
}

function applyEdgeUpdates(edges, updateEdges) {
    if (updateEdges.length === 0) return edges;
    const map = new Map(updateEdges.map((e) => [e.id, e]));
    return edges.map((e) => {
        const update = map.get(e.id);
        if (!update) return e;
        return normalizeEdge({ ...e, ...update });
    });
}

// ---------------------------------------------------------------------------
// addNode helpers
// ---------------------------------------------------------------------------

function shiftDescendants(sibId, sdx, sdy, adjMap, nodeMap, posMap, newNodeIds) {
    const queue = [...(adjMap.get(sibId) || [])];
    const visited = new Set();
    while (queue.length) {
        const id = queue.shift();
        if (visited.has(id) || newNodeIds.has(id)) continue;
        visited.add(id);
        const orig = nodeMap.get(id);
        if (orig && !posMap.has(id)) {
            posMap.set(id, { x: orig.position.x + sdx, y: orig.position.y + sdy });
        }
        for (const child of adjMap.get(id) || []) queue.push(child);
    }
}

function cascadeSiblingShifts(existingSiblingIds, posMap, nodeMap, adjMap, newNodeIds) {
    for (const sibId of existingSiblingIds) {
        const newPos = posMap.get(sibId);
        if (!newPos) continue;
        const oldNode = nodeMap.get(sibId);
        if (!oldNode) continue;
        const sdx = newPos.x - oldNode.position.x;
        const sdy = newPos.y - oldNode.position.y;
        if (sdx === 0 && sdy === 0) continue;
        shiftDescendants(sibId, sdx, sdy, adjMap, nodeMap, posMap, newNodeIds);
    }
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

    // Partition returned nodes/edges into updates vs new additions
    const existingNodeIds = new Set(nodes.map((n) => n.id));
    const existingEdgeIds = new Set(edges.map((e) => e.id));
    const { updates: updateNodes, additions: trulyNewNodes } = partitionByExisting(rawNewNodes, existingNodeIds);
    const { updates: updateEdges, additions: trulyNewEdges } = partitionByExisting(rawNewEdges, existingEdgeIds);

    // Apply updates to existing nodes and edges
    const baseNodes = applyNodeUpdates(nodes, updateNodes);
    const baseEdges = applyEdgeUpdates(edges, updateEdges);

    // Re-fetch parent in case it was updated by the callback
    const effectiveParent = baseNodes.find((n) => n.id === parentId);

    // Ensure new nodes have position
    const newNodes = trulyNewNodes.map((n) => ({
        ...n,
        position: n.position || { x: 0, y: 0 },
    }));

    // Normalize new edges (handles are assigned by reindexAllHandles at render time)
    const newEdges = trulyNewEdges.map(normalizeEdge);

    // Collect existing direct children of parent
    const existingSiblingIds = baseEdges
        .filter((e) => e.source === parentId)
        .map((e) => e.target);
    const existingSiblings = baseNodes.filter((n) => existingSiblingIds.includes(n.id));

    // Mini graph: parent + existing siblings + new nodes
    const miniNodes = [effectiveParent, ...existingSiblings, ...newNodes];
    const newNodeIds = new Set(newNodes.map((n) => n.id));
    const siblingIds = new Set(existingSiblingIds);
    const miniEdges = [
        ...baseEdges.filter((e) => e.source === parentId && siblingIds.has(e.target)),
        ...newEdges.filter((e) => {
            const miniIds = new Set(miniNodes.map((n) => n.id));
            return miniIds.has(e.source) && miniIds.has(e.target);
        }),
    ];

    const mini = layoutGraphDagre(miniNodes, miniEdges);
    const miniParent = mini.find((n) => n.id === parentId);
    if (!miniParent) return null;

    const dx = effectiveParent.position.x - miniParent.position.x;
    const dy = effectiveParent.position.y - miniParent.position.y;

    const posMap = new Map();
    for (const n of mini) {
        if (n.id === parentId) continue;
        posMap.set(n.id, { x: n.position.x + dx, y: n.position.y + dy });
    }

    // Build adjacency map for cascading position deltas to descendants
    const adjMap = new Map();
    for (const e of baseEdges) {
        if (!adjMap.has(e.source)) adjMap.set(e.source, []);
        adjMap.get(e.source).push(e.target);
    }

    const nodeMap = new Map(baseNodes.map((n) => [n.id, n]));
    cascadeSiblingShifts(existingSiblingIds, posMap, nodeMap, adjMap, newNodeIds);

    const allNextEdges = [...baseEdges, ...newEdges];
    const updatedNodes = baseNodes.map((n) => {
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

    // Partition returned nodes/edges into updates vs new additions
    const existingNodeIds = new Set(nodes.map((n) => n.id));
    const existingEdgeIds = new Set(updatedEdges.map((e) => e.id));
    const { updates: updateNodes, additions: trulyNewNodes } = partitionByExisting(rawNewNodes, existingNodeIds);
    const { updates: updateEdges, additions: trulyNewEdges } = partitionByExisting(rawNewEdges, existingEdgeIds);

    // Apply updates to existing nodes and edges
    const baseNodes = applyNodeUpdates(nodes, updateNodes);
    const baseEdges = applyEdgeUpdates(updatedEdges, updateEdges);

    // Re-fetch parent in case it was updated by the callback
    const effectiveParent = baseNodes.find((n) => n.id === sourceId);

    const newNodes = trulyNewNodes.map((n) => ({
        ...n,
        position: n.position || { x: 0, y: 0 },
    }));

    const newEdges = trulyNewEdges.map(normalizeEdge);

    const allFinalEdges = [...baseEdges, ...newEdges];
    const finalNodes = placeNewNodes(sourceId, effectiveParent, baseNodes, newNodes, newEdges, baseEdges);
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

    const newEdge = normalizeEdge(result.edge);
    const allNextEdges = [...edges, newEdge];
    return { nodes, edges: allNextEdges };
}

/**
 * Delete a node and all connected edges.
 * Handle reindexing is handled by the reindexAllHandles useMemo in OrthogonalFlow.
 * Returns { nodes, edges } or null.
 */
export function deleteNode(nodes, edges, nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    const remainingNodes = nodes.filter((n) => n.id !== nodeId);
    const remainingEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

    return { nodes: remainingNodes, edges: remainingEdges };
}

/**
 * Delete an edge.
 * Handle reindexing is handled by the reindexAllHandles useMemo in OrthogonalFlow.
 * Returns { nodes, edges } or null.
 */
export function deleteEdge(nodes, edges, edgeId) {
    const deleted = edges.find((e) => e.id === edgeId);
    if (!deleted) return null;

    const remaining = edges.filter((e) => e.id !== edgeId);
    return { nodes, edges: remaining };
}

/**
 * Re-layout all nodes using dagre.
 * Returns { nodes, edges }.
 */
export function layoutAll(nodes, edges) {
    const { visibleNodes: vNodes, visibleEdges: vEdges } = getVisibleGraph(nodes, edges);
    const positioned = layoutGraphDagre(vNodes, vEdges);
    const posMap = new Map(positioned.map((n) => [n.id, n.position]));
    const finalNodes = nodes.map((n) => {
        const pos = posMap.get(n.id);
        return pos ? { ...n, position: pos } : n;
    });
    return { nodes: finalNodes, edges };
}

// ---------------------------------------------------------------------------
// Cascade deletion helpers (internal)
// ---------------------------------------------------------------------------

/**
 * BFS to collect all descendant nodes from a set of start IDs, stopping at
 * (but not including traversal past) the stopId.
 */
function collectDescendantsUntil(startIds, stopId, edges) {
    const result = new Set();
    const queue = [...startIds];
    const visited = new Set();
    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        if (id === stopId) continue;
        result.add(id);
        const children = edges.filter(function (e) { return e.source === id; }).map(function (e) { return e.target; });
        for (const c of children) queue.push(c);
    }
    return result;
}

/**
 * Remove a branch node, its merge, and all path nodes between them.
 * Reconnects the branch's parent to the merge's child via createEdge.
 */
function deleteBranchGroup(branchId, nodes, edges, createEdge) {
    const mergeId = findMergeNode(branchId, nodes, edges);

    const childIds = edges.filter(function (e) { return e.source === branchId; }).map(function (e) { return e.target; });
    const toRemove = collectDescendantsUntil(childIds, mergeId, edges);
    toRemove.add(branchId);
    if (mergeId) toRemove.add(mergeId);

    // Find parent of branch and child of merge for reconnection
    const parentEdge = edges.find(function (e) { return e.target === branchId; });
    const mergeChildEdge = mergeId ? edges.find(function (e) { return e.source === mergeId; }) : null;

    const newNodes = nodes.filter(function (n) { return !toRemove.has(n.id); });
    let newEdges = edges.filter(function (e) { return !toRemove.has(e.source) && !toRemove.has(e.target); });

    // Reconnect parent → merge's child
    if (parentEdge && mergeChildEdge && createEdge) {
        const reconnect = createEdge(parentEdge.source, mergeChildEdge.target);
        if (reconnect) {
            newEdges = [].concat(newEdges, [normalizeEdge(reconnect)]);
        }
    }

    return { nodes: newNodes, edges: newEdges };
}

/**
 * Remove a regular (non-branch, non-merge) node.
 * If the node is a simple 1-in/1-out chain link, reconnects via createEdge.
 */
function deleteRegularNode(nodeId, nodes, edges, createEdge) {
    const inputEdges = edges.filter(function (e) { return e.target === nodeId; });
    const outputEdges = edges.filter(function (e) { return e.source === nodeId; });

    const newNodes = nodes.filter(function (n) { return n.id !== nodeId; });
    let newEdges = edges.filter(function (e) { return e.source !== nodeId && e.target !== nodeId; });

    // Simple chain: one input, one output → reconnect
    if (inputEdges.length === 1 && outputEdges.length === 1 && createEdge) {
        const parentEdge = inputEdges[0];
        const childEdge = outputEdges[0];
        const reconnect = createEdge(parentEdge.source, childEdge.target);
        if (reconnect) {
            newEdges = [].concat(newEdges, [normalizeEdge(reconnect)]);
        }
    }

    return { nodes: newNodes, edges: newEdges };
}

/**
 * When only one branch remains, inline it: remove branch node, merge node,
 * and deleted path nodes; reconnect parent → remaining path start and
 * remaining path end → merge's child.
 */
function inlineLastBranch(branchId, mergeId, pathNodes, edgeId, remainingEdge, graph) {
    var edges = graph.edges;
    var nodes = graph.nodes;
    var createEdge = graph.createEdge;
    const remainingPathStartId = remainingEdge.target;
    const parentEdge = edges.find(function (e) { return e.target === branchId; });
    const mergeChildEdge = mergeId
        ? edges.find(function (e) { return e.source === mergeId; })
        : null;

    const toRemove = new Set(pathNodes);
    toRemove.add(branchId);
    if (mergeId) toRemove.add(mergeId);

    const newNodes = nodes.filter(function (n) { return !toRemove.has(n.id); });
    let newEdges = edges.filter(function (e) {
        return !toRemove.has(e.source) && !toRemove.has(e.target) &&
            e.id !== edgeId && e.id !== remainingEdge.id;
    });

    if (parentEdge && createEdge) {
        const reconnect = createEdge(parentEdge.source, remainingPathStartId);
        if (reconnect) {
            newEdges = newEdges.concat([normalizeEdge(reconnect)]);
        }
    }

    if (mergeChildEdge && createEdge) {
        const pathEndEdge = edges.find(function (e) {
            return e.target === mergeId && !pathNodes.has(e.source) && e.source !== branchId;
        });
        const endId = pathEndEdge ? pathEndEdge.source : remainingPathStartId;
        const reconnect = createEdge(endId, mergeChildEdge.target);
        if (reconnect) {
            newEdges = newEdges.concat([normalizeEdge(reconnect)]);
        }
    }

    return { nodes: newNodes, edges: newEdges };
}

/**
 * Multiple branches remain after deletion — remove path nodes.
 * Handle reindexing is handled by the reindexAllHandles useMemo in OrthogonalFlow.
 */
function removePathAndReindex(branchId, mergeId, pathNodes, edgeId, edges, nodes) {
    const newNodes = nodes.filter(function (n) { return !pathNodes.has(n.id); });
    const newEdges = edges.filter(function (e) {
        return e.id !== edgeId && !pathNodes.has(e.source) && !pathNodes.has(e.target);
    });

    return { nodes: newNodes, edges: newEdges };
}

/**
 * Remove a branch path (the edge from branch → path start, and all nodes
 * along that path up to the merge). If only one branch remains after removal,
 * the branch/merge structure is inlined. Otherwise handles are reindexed.
 */
function deleteBranchPath(edgeId, edge, nodes, edges, createEdge) {
    const branchId = edge.source;
    const pathStartId = edge.target;
    const mergeId = findMergeNode(branchId, nodes, edges);

    const pathNodes = collectDescendantsUntil([pathStartId], mergeId, edges);

    // Count remaining branches after removing this one
    const remainingBranchEdges = edges.filter(function (e) { return e.source === branchId && e.id !== edgeId; });

    if (remainingBranchEdges.length === 1) {
        return inlineLastBranch(branchId, mergeId, pathNodes, edgeId, remainingBranchEdges[0], { edges, nodes, createEdge });
    }

    return removePathAndReindex(branchId, mergeId, pathNodes, edgeId, edges, nodes);
}

// ---------------------------------------------------------------------------
// Cascade deletion (exported)
// ---------------------------------------------------------------------------

/**
 * Cascade delete a node, handling branch/merge groups and regular nodes.
 * options.createEdge(source, target) → edge object or null to skip reconnection.
 * Returns { nodes, edges } or null.
 */
export function cascadeDeleteNode(nodes, edges, nodeId, options) {
    const opts = options || {};
    const createEdge = opts.createEdge || null;
    const node = nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return null;

    if (node.data && node.data.isBranch) {
        return deleteBranchGroup(nodeId, nodes, edges, createEdge);
    }

    if (node.data && node.data.isMerge) {
        const branchId = findOwningBranch(nodeId, nodes, edges);
        if (branchId) {
            return deleteBranchGroup(branchId, nodes, edges, createEdge);
        }
        return deleteNode(nodes, edges, nodeId);
    }

    return deleteRegularNode(nodeId, nodes, edges, createEdge);
}

/**
 * Cascade delete an edge, handling branch path edges and regular edges.
 * options.createEdge(source, target) → edge object or null to skip reconnection.
 * options.isBranchEdge(edge) → boolean, identifies branch path edges.
 * Returns { nodes, edges } or null.
 */
export function cascadeDeleteEdge(nodes, edges, edgeId, options) {
    const opts = options || {};
    const createEdge = opts.createEdge || null;
    const isBranchEdge = opts.isBranchEdge || null;
    const edge = edges.find(function (e) { return e.id === edgeId; });
    if (!edge) return null;

    if (isBranchEdge && isBranchEdge(edge)) {
        return deleteBranchPath(edgeId, edge, nodes, edges, createEdge);
    }

    return deleteEdge(nodes, edges, edgeId);
}
