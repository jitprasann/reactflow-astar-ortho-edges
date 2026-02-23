import { MarkerType } from "reactflow";
import { layoutGraphDagre } from "./dagreLayout.js";
import { DEFAULTS } from "./defaults.js";

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
 * Assign sourceHandle/targetHandle to edges that don't have them.
 * Uses existingEdges to determine the next available handle indices.
 */
export function assignHandles(newEdges, existingEdges) {
    // Build running counts from existing edges
    const outCounts = new Map();
    const inCounts = new Map();
    for (const e of existingEdges) {
        if (e.sourceHandle) {
            const idx = parseInt(e.sourceHandle.split("-")[1], 10) || 0;
            outCounts.set(e.source, Math.max(outCounts.get(e.source) || 0, idx + 1));
        }
        if (e.targetHandle) {
            const idx = parseInt(e.targetHandle.split("-")[1], 10) || 0;
            inCounts.set(e.target, Math.max(inCounts.get(e.target) || 0, idx + 1));
        }
    }

    return newEdges.map((edge) => {
        const result = { ...edge };

        if (!result.sourceHandle) {
            const idx = outCounts.get(result.source) || 0;
            result.sourceHandle = `output-${idx}`;
            outCounts.set(result.source, idx + 1);
        }
        if (!result.targetHandle) {
            const idx = inCounts.get(result.target) || 0;
            result.targetHandle = `input-${idx}`;
            inCounts.set(result.target, idx + 1);
        }

        return result;
    });
}

/**
 * Re-index handles after deleting an edge so handles stay contiguous.
 */
export function reindexHandlesAfterDelete(remainingEdges, deletedEdge) {
    // Re-index source handles: close gaps
    const srcId = deletedEdge.source;
    const srcEdges = remainingEdges
        .filter((e) => e.source === srcId)
        .sort((a, b) => {
            const ai = parseInt((a.sourceHandle || "output-0").split("-")[1], 10) || 0;
            const bi = parseInt((b.sourceHandle || "output-0").split("-")[1], 10) || 0;
            return ai - bi;
        });
    const srcRemap = new Map();
    srcEdges.forEach((e, i) => srcRemap.set(e.id, `output-${i}`));

    // Re-index target handles: close gaps
    const tgtId = deletedEdge.target;
    const tgtEdges = remainingEdges
        .filter((e) => e.target === tgtId)
        .sort((a, b) => {
            const ai = parseInt((a.targetHandle || "input-0").split("-")[1], 10) || 0;
            const bi = parseInt((b.targetHandle || "input-0").split("-")[1], 10) || 0;
            return ai - bi;
        });
    const tgtRemap = new Map();
    tgtEdges.forEach((e, i) => tgtRemap.set(e.id, `input-${i}`));

    return remainingEdges.map((e) => {
        let edge = e;
        if (srcRemap.has(e.id) && e.source === srcId) {
            edge = { ...edge, sourceHandle: srcRemap.get(e.id) };
        }
        if (tgtRemap.has(e.id) && e.target === tgtId) {
            edge = { ...edge, targetHandle: tgtRemap.get(e.id) };
        }
        return edge;
    });
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
        if (node?.data?.isMerge) {
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
        ...positioned.map((n) => n.position.y + (n.data?.height ?? DEFAULTS.nodeHeight)),
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
        ...[...directDownstream].map((id) => nodeMap.get(id)?.position.y ?? Infinity),
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
