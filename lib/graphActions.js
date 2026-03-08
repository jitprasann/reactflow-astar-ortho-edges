import { getVisibleGraph } from "./layoutEngine.js";
import { layoutGraphDagre } from "./dagreLayout.js";
import {
    nextOutputIdx,
    normalizeEdge,
    assignHandles,
    reindexHandlesAfterDelete,
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

    // Build adjacency map for cascading position deltas to descendants
    const adjMap = new Map();
    for (const e of edges) {
        if (!adjMap.has(e.source)) adjMap.set(e.source, []);
        adjMap.get(e.source).push(e.target);
    }

    // For each existing sibling that moved, cascade the delta to all descendants
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const sibId of existingSiblingIds) {
        const newPos = posMap.get(sibId);
        if (!newPos) continue;
        const oldNode = nodeMap.get(sibId);
        if (!oldNode) continue;
        const sdx = newPos.x - oldNode.position.x;
        const sdy = newPos.y - oldNode.position.y;
        if (sdx === 0 && sdy === 0) continue;

        // BFS to shift all descendants
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
 * Delete a node and all connected edges, reindex handles on affected neighbors.
 * Returns { nodes, edges } or null.
 */
export function deleteNode(nodes, edges, nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    const connectedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);
    const remainingNodes = nodes.filter((n) => n.id !== nodeId);

    if (connectedEdges.length === 0) {
        return { nodes: remainingNodes, edges };
    }

    let remainingEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

    // Collect affected neighbor nodes for handle reindexing
    const affectedSources = new Set();
    const affectedTargets = new Set();
    for (const e of connectedEdges) {
        if (e.target === nodeId) affectedSources.add(e.source);
        if (e.source === nodeId) affectedTargets.add(e.target);
    }

    // Reindex source handles for parent nodes that lost an outgoing edge
    for (const srcId of affectedSources) {
        const srcEdges = remainingEdges
            .filter((e) => e.source === srcId)
            .sort((a, b) => {
                const ai = parseInt((a.sourceHandle || "output-0").split("-")[1], 10) || 0;
                const bi = parseInt((b.sourceHandle || "output-0").split("-")[1], 10) || 0;
                return ai - bi;
            });
        const remap = new Map();
        srcEdges.forEach((e, i) => remap.set(e.id, "output-" + i));
        remainingEdges = remainingEdges.map((e) =>
            remap.has(e.id) && e.source === srcId
                ? { ...e, sourceHandle: remap.get(e.id) }
                : e
        );
    }

    // Reindex target handles for child nodes that lost an incoming edge
    for (const tgtId of affectedTargets) {
        const tgtEdges = remainingEdges
            .filter((e) => e.target === tgtId)
            .sort((a, b) => {
                const ai = parseInt((a.targetHandle || "input-0").split("-")[1], 10) || 0;
                const bi = parseInt((b.targetHandle || "input-0").split("-")[1], 10) || 0;
                return ai - bi;
            });
        const remap = new Map();
        tgtEdges.forEach((e, i) => remap.set(e.id, "input-" + i));
        remainingEdges = remainingEdges.map((e) =>
            remap.has(e.id) && e.target === tgtId
                ? { ...e, targetHandle: remap.get(e.id) }
                : e
        );
    }

    return { nodes: remainingNodes, edges: remainingEdges };
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

// ---------------------------------------------------------------------------
// Cascade deletion helpers (internal)
// ---------------------------------------------------------------------------

/**
 * Remove a branch node, its merge, and all path nodes between them.
 * Reconnects the branch's parent to the merge's child via createEdge.
 */
function deleteBranchGroup(branchId, nodes, edges, createEdge) {
    const mergeId = findMergeNode(branchId, nodes, edges);

    // Collect all nodes between branch and merge
    const toRemove = new Set([branchId]);
    if (mergeId) toRemove.add(mergeId);

    const queue = edges.filter(function (e) { return e.source === branchId; }).map(function (e) { return e.target; });
    const visited = new Set();
    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        if (id === mergeId) continue;
        toRemove.add(id);
        const children = edges.filter(function (e) { return e.source === id; }).map(function (e) { return e.target; });
        for (const c of children) queue.push(c);
    }

    // Find parent of branch and child of merge for reconnection
    const parentEdge = edges.find(function (e) { return e.target === branchId; });
    const mergeChildEdge = mergeId ? edges.find(function (e) { return e.source === mergeId; }) : null;

    let newNodes = nodes.filter(function (n) { return !toRemove.has(n.id); });
    let newEdges = edges.filter(function (e) { return !toRemove.has(e.source) && !toRemove.has(e.target); });

    // Reconnect parent → merge's child
    if (parentEdge && mergeChildEdge && createEdge) {
        const reconnect = createEdge(parentEdge.source, mergeChildEdge.target);
        if (reconnect) {
            const assigned = assignHandles([normalizeEdge(reconnect)], newEdges);
            newEdges = [].concat(newEdges, [assigned[0]]);
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
            const assigned = assignHandles([normalizeEdge(reconnect)], newEdges);
            newEdges = [].concat(newEdges, [assigned[0]]);
        }
    }

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

    // Collect all nodes on this branch path (from pathStart to merge, exclusive)
    const pathNodes = new Set();
    const queue = [pathStartId];
    const visited = new Set();
    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        if (id === mergeId) continue;
        pathNodes.add(id);
        const children = edges.filter(function (e) { return e.source === id; }).map(function (e) { return e.target; });
        for (const c of children) queue.push(c);
    }

    // Count remaining branches after removing this one
    const remainingBranchEdges = edges.filter(function (e) { return e.source === branchId && e.id !== edgeId; });

    if (remainingBranchEdges.length === 1) {
        // Only one branch remains → inline it, remove branch + merge
        const remainingEdge = remainingBranchEdges[0];
        const remainingPathStartId = remainingEdge.target;

        const parentEdge = edges.find(function (e) { return e.target === branchId; });
        const mergeChildEdge = mergeId ? edges.find(function (e) { return e.source === mergeId; }) : null;

        // All nodes to remove: deleted path nodes + branch + merge
        const toRemove = new Set(pathNodes);
        toRemove.add(branchId);
        if (mergeId) toRemove.add(mergeId);

        const newNodes = nodes.filter(function (n) { return !toRemove.has(n.id); });
        let newEdges = edges.filter(function (e) {
            return !toRemove.has(e.source) && !toRemove.has(e.target) &&
                e.id !== edgeId && e.id !== remainingEdge.id;
        });

        // Reconnect: parent → remaining path start
        if (parentEdge && createEdge) {
            const reconnectParent = createEdge(parentEdge.source, remainingPathStartId);
            if (reconnectParent) {
                const assignedP = assignHandles([normalizeEdge(reconnectParent)], newEdges);
                newEdges = [].concat(newEdges, [assignedP[0]]);
            }
        }

        // Reconnect: remaining path end → merge's child
        if (mergeChildEdge && createEdge) {
            const pathEndEdge = edges.find(function (e) {
                return e.target === mergeId && !pathNodes.has(e.source) && e.source !== branchId;
            });
            const remainingPathEndId = pathEndEdge ? pathEndEdge.source : remainingPathStartId;

            const reconnectChild = createEdge(remainingPathEndId, mergeChildEdge.target);
            if (reconnectChild) {
                const assignedC = assignHandles([normalizeEdge(reconnectChild)], newEdges);
                newEdges = [].concat(newEdges, [assignedC[0]]);
            }
        }

        return { nodes: newNodes, edges: newEdges };
    }

    // Multiple branches remain → just remove this path
    const newNodes2 = nodes.filter(function (n) { return !pathNodes.has(n.id); });
    let newEdges2 = edges.filter(function (e) {
        return e.id !== edgeId && !pathNodes.has(e.source) && !pathNodes.has(e.target);
    });

    // Reindex source handles on branch node
    const srcEdges = newEdges2
        .filter(function (e) { return e.source === branchId; })
        .sort(function (a, b) {
            const ai = parseInt((a.sourceHandle || "output-0").split("-")[1], 10) || 0;
            const bi = parseInt((b.sourceHandle || "output-0").split("-")[1], 10) || 0;
            return ai - bi;
        });
    const srcRemap = new Map();
    srcEdges.forEach(function (e, i) { srcRemap.set(e.id, "output-" + i); });

    // Reindex target handles on merge node
    if (mergeId) {
        const tgtEdges = newEdges2
            .filter(function (e) { return e.target === mergeId; })
            .sort(function (a, b) {
                const ai = parseInt((a.targetHandle || "input-0").split("-")[1], 10) || 0;
                const bi = parseInt((b.targetHandle || "input-0").split("-")[1], 10) || 0;
                return ai - bi;
            });
        const tgtRemap = new Map();
        tgtEdges.forEach(function (e, i) { tgtRemap.set(e.id, "input-" + i); });

        newEdges2 = newEdges2.map(function (e) {
            let updated = e;
            if (srcRemap.has(e.id) && e.source === branchId) {
                updated = { ...updated, sourceHandle: srcRemap.get(e.id) };
            }
            if (tgtRemap.has(e.id) && e.target === mergeId) {
                updated = { ...updated, targetHandle: tgtRemap.get(e.id) };
            }
            return updated;
        });
    } else {
        newEdges2 = newEdges2.map(function (e) {
            return srcRemap.has(e.id) && e.source === branchId
                ? { ...e, sourceHandle: srcRemap.get(e.id) }
                : e;
        });
    }

    return { nodes: newNodes2, edges: newEdges2 };
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
