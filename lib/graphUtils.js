import { MarkerType } from "reactflow";
import { layoutGraphDagre } from "./dagreLayout.js";
import { DEFAULTS } from "./defaults.js";

/**
 * Remove dangling edges (edges whose source or target node no longer exists).
 * Returns the original `edges` reference when nothing was removed.
 */
export function removeDanglingEdges(nodes, edges) {
    const nodeIds = new Set(nodes.map(function (n) { return n.id; }));
    const cleanEdges = edges.filter(function (e) {
        return nodeIds.has(e.source) && nodeIds.has(e.target);
    });

    if (cleanEdges.length === edges.length) return edges;
    return cleanEdges;
}

/**
 * Reindex all handles so port indices are contiguous (no gaps).
 * Groups edges by source/target node, sorts by current handle index,
 * and remaps to output-0, output-1, ... / input-0, input-1, ...
 * Returns the original `edges` reference when no remapping is needed.
 */
export function reindexAllHandles(edges) {
    // Group edges by source node
    const bySource = new Map();
    for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        var list = bySource.get(e.source);
        if (!list) {
            list = [];
            bySource.set(e.source, list);
        }
        list.push(e);
    }

    // Group edges by target node
    const byTarget = new Map();
    for (var j = 0; j < edges.length; j++) {
        var e2 = edges[j];
        var list2 = byTarget.get(e2.target);
        if (!list2) {
            list2 = [];
            byTarget.set(e2.target, list2);
        }
        list2.push(e2);
    }

    // Build remap: edgeId -> { sourceHandle, targetHandle }
    const remap = new Map();
    var needsRemap = false;

    var MAX = Number.MAX_SAFE_INTEGER;

    bySource.forEach(function (group) {
        group.sort(function (a, b) {
            var ai = a.sourceHandle ? parseInt(a.sourceHandle.split("-")[1], 10) || 0 : MAX;
            var bi = b.sourceHandle ? parseInt(b.sourceHandle.split("-")[1], 10) || 0 : MAX;
            return ai - bi;
        });
        for (var k = 0; k < group.length; k++) {
            var expected = "output-" + k;
            var current = group[k].sourceHandle;
            if (current !== expected) {
                needsRemap = true;
                var entry = remap.get(group[k].id);
                if (!entry) {
                    entry = {};
                    remap.set(group[k].id, entry);
                }
                entry.sourceHandle = expected;
            }
        }
    });

    byTarget.forEach(function (group) {
        group.sort(function (a, b) {
            var ai = a.targetHandle ? parseInt(a.targetHandle.split("-")[1], 10) || 0 : MAX;
            var bi = b.targetHandle ? parseInt(b.targetHandle.split("-")[1], 10) || 0 : MAX;
            return ai - bi;
        });
        for (var k = 0; k < group.length; k++) {
            var expected = "input-" + k;
            var current = group[k].targetHandle;
            if (current !== expected) {
                needsRemap = true;
                var entry = remap.get(group[k].id);
                if (!entry) {
                    entry = {};
                    remap.set(group[k].id, entry);
                }
                entry.targetHandle = expected;
            }
        }
    });

    if (!needsRemap) return edges;

    return edges.map(function (e) {
        var changes = remap.get(e.id);
        if (!changes) return e;
        return { ...e, ...changes };
    });
}

/** Next available output-N handle index for a source node based on existing edges. */
export function nextOutputIdx(nodeId, edges) {
    return edges
        .filter((e) => e.source === nodeId)
        .reduce((max, e) => {
            const idx = parseInt((e.sourceHandle || "output-0").split("-")[1], 10) || 0;
            return Math.max(max, idx + 1);
        }, 0);
}

/** Next available input-N handle index for a target node based on existing edges. */
export function nextInputIdx(nodeId, edges) {
    return edges
        .filter((e) => e.target === nodeId)
        .reduce((max, e) => {
            const idx = parseInt((e.targetHandle || "input-0").split("-")[1], 10) || 0;
            return Math.max(max, idx + 1);
        }, 0);
}

/**
 * Stamp inputs/outputs counts into node data based on edges so that
 * React Flow renders Handle components on the very first render cycle.
 *
 * @deprecated No longer needed — OrthogonalFlow's useMemo re-derives handle
 * counts from visible edges on every render, making external calls redundant.
 * Kept exported for backward compatibility.
 */
export function injectHandleCounts(nodes, edges) {
    const outputCounts = new Map();
    const inputCounts = new Map();
    for (const e of edges) {
        const outIdx = parseInt((e.sourceHandle || "output-0").split("-")[1], 10) || 0;
        const inIdx = parseInt((e.targetHandle || "input-0").split("-")[1], 10) || 0;
        outputCounts.set(e.source, Math.max(outputCounts.get(e.source) || 0, outIdx + 1));
        inputCounts.set(e.target, Math.max(inputCounts.get(e.target) || 0, inIdx + 1));
    }
    return nodes.map((n) => ({
        ...n,
        data: {
            ...n.data,
            inputs: inputCounts.get(n.id) || 0,
            outputs: outputCounts.get(n.id) || 0,
        },
    }));
}

/**
 * Normalize an edge: add type:'orthogonal' and markerEnd if missing.
 */
export function normalizeEdge(edge) {
    return {
        ...edge,
        type: edge.type || "orthogonal",
        markerEnd: edge.markerEnd || { type: MarkerType.ArrowClosed },
    };
}

/**
 * Find the branch node that owns a merge node by BFS backwards.
 * Companion to findMergeNode — walks edges in reverse to locate
 * the branch (node.data.isBranch) that feeds into the given merge.
 */
export function findOwningBranch(mergeId, nodes, edges) {
    const reverseAdj = new Map();
    for (const e of edges) {
        if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, []);
        reverseAdj.get(e.target).push(e.source);
    }
    const visited = new Set();
    const queue = (reverseAdj.get(mergeId) || []).slice();
    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const n = nodes.find((nd) => nd.id === id);
        if (n && n.data && n.data.isBranch) return id;
        const parents = reverseAdj.get(id) || [];
        for (const p of parents) queue.push(p);
    }
    return null;
}

/**
 * Find the merge node associated with a branch node by BFS from its children.
 */
export function findMergeNode(branchId, nodes, edges) {
    const childIds = edges.filter((e) => e.source === branchId).map((e) => e.target);
    const adjMap = new Map();
    for (const e of edges) {
        if (!adjMap.has(e.source)) adjMap.set(e.source, []);
        adjMap.get(e.source).push(e.target);
    }
    let mergeId = null;
    const visited = new Set();
    const queue = [...childIds];
    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((n) => n.id === id);
        if (node && node.data && node.data.isMerge) {
            mergeId = id;
            break;
        }
        for (const c of adjMap.get(id) || []) queue.push(c);
    }
    return mergeId;
}

/**
 * Position new nodes below a parent node using a mini dagre layout, then shift
 * all downstream nodes down to make room.
 */
export function placeNewNodes(parentId, parentNode, updatedNodes, newNodes, newEdges, updatedEdges) {
    if (!parentNode) return [...updatedNodes, ...newNodes];

    const miniNodeIds = new Set([parentId, ...newNodes.map((n) => n.id)]);
    const miniEdges = newEdges.filter(
        (e) => miniNodeIds.has(e.source) && miniNodeIds.has(e.target),
    );
    const mini = layoutGraphDagre([parentNode, ...newNodes], miniEdges);
    const miniParent = mini.find((n) => n.id === parentId);
    if (!miniParent) return [...updatedNodes, ...newNodes];

    const dx = parentNode.position.x - miniParent.position.x;
    const dy = parentNode.position.y - miniParent.position.y;
    const newIds = new Set(newNodes.map((n) => n.id));
    const positioned = mini
        .filter((n) => newIds.has(n.id))
        .map((n) => ({
            ...n,
            position: { x: n.position.x + dx, y: n.position.y + dy },
        }));

    const newBottom = Math.max(
        ...positioned.map((n) => n.position.y + ((n.data && n.data.height != null) ? n.data.height : DEFAULTS.nodeHeight)),
    );

    const allEdgesScope = [...updatedEdges, ...newEdges];
    const directDownstream = new Set(
        allEdgesScope
            .filter((e) => newIds.has(e.source) && !newIds.has(e.target))
            .map((e) => e.target),
    );

    if (directDownstream.size === 0) return [...updatedNodes, ...positioned];

    const adjMap = new Map();
    for (const e of updatedEdges) {
        if (!adjMap.has(e.source)) adjMap.set(e.source, []);
        adjMap.get(e.source).push(e.target);
    }
    const downstreamIds = new Set();
    const queue = [...directDownstream];
    while (queue.length) {
        const id = queue.shift();
        if (downstreamIds.has(id)) continue;
        downstreamIds.add(id);
        for (const c of adjMap.get(id) || []) queue.push(c);
    }

    const nodeMap = new Map(updatedNodes.map((n) => [n.id, n]));
    const downstreamTopY = Math.min(
        ...[...directDownstream].map((id) => { const n = nodeMap.get(id); return (n && n.position) ? n.position.y : Infinity; }),
    );
    const shift = newBottom + DEFAULTS.verticalGap - downstreamTopY;

    const finalUpdated =
        shift > 0
            ? updatedNodes.map((n) =>
                  downstreamIds.has(n.id)
                      ? { ...n, position: { x: n.position.x, y: n.position.y + shift } }
                      : n,
              )
            : updatedNodes;

    return [...finalUpdated, ...positioned];
}
