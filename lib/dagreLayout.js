import dagre from "@dagrejs/dagre";
import { DEFAULTS } from "./defaults.js";

/**
 * Custom dagre ranker: longest path FROM source (Kahn's BFS).
 *
 * dagre calls this with its own internal graph when `ranker` is a function
 * (`if (ranker instanceof Function) return ranker(g)`). We must set
 * `g.node(id).rank` for every node.
 *
 * Using parent_rank + edge.minlen (minlen is doubled by makeSpaceForEdgeLabels)
 * so no dagre edge constraint is violated.
 *
 * Branch children are all the same distance from the source, so they always
 * share the same rank — even when one branch grows deeper.
 */
function longestPathFromSource(g) {
    const inDeg = new Map();
    const adj = new Map(); // id → [{ w, minlen }]

    for (const n of g.nodes()) {
        inDeg.set(n, 0);
        adj.set(n, []);
    }
    for (const e of g.edges()) {
        const minlen = (g.edge(e) || {}).minlen || 1;
        adj.get(e.v).push({ w: e.w, minlen });
        inDeg.set(e.w, inDeg.get(e.w) + 1);
    }

    const queue = g.nodes().filter((n) => inDeg.get(n) === 0);
    for (const n of queue) g.node(n).rank = 0;

    while (queue.length) {
        const id = queue.shift();
        const parentRank = g.node(id).rank;
        for (const { w: childId, minlen } of adj.get(id)) {
            const child = g.node(childId);
            child.rank = Math.max(child.rank ?? 0, parentRank + minlen);
            inDeg.set(childId, inDeg.get(childId) - 1);
            if (inDeg.get(childId) === 0) queue.push(childId);
        }
    }
}

/**
 * Post-layout fix: ensure branch children appear left-to-right in handle
 * index order (output-0 leftmost, output-1 next, etc.).
 *
 * dagre's biasRight pass reverses equal-barycenter siblings, which flips
 * branch children since they all share the same parent. This fix detects the
 * reversal and corrects it by swapping x positions.
 *
 * Each corrected child's entire subtree is shifted by the same delta.
 * Traversal stops only at the merge node that collects ALL siblings of the
 * current branch group — inner merge nodes (belonging to nested branches)
 * travel with the subtree so they stay correctly positioned.
 */
function fixBranchOrdering(g, nodes, edges) {
    // outgoing[source] = [{target, handleIndex}]
    const outgoing = new Map();
    for (const edge of edges) {
        if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
        const m = (edge.sourceHandle || "output-0").match(/(\d+)$/);
        const handleIndex = m ? parseInt(m[1], 10) : 0;
        outgoing.get(edge.source).push({ target: edge.target, handleIndex });
    }

    // Adjacency for subtree traversal
    const adj = new Map();
    for (const e of g.edges()) {
        if (!adj.has(e.v)) adj.set(e.v, []);
        adj.get(e.v).push(e.w);
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    /**
     * Find the first merge node (data.isMerge) reachable from ALL childIds.
     * This is the merge node that belongs specifically to this branch group.
     */
    function findGroupMerge(childIds) {
        const reachSets = childIds.map((startId) => {
            const visited = new Set();
            const stack = [startId];
            while (stack.length) {
                const id = stack.pop();
                if (visited.has(id)) continue;
                visited.add(id);
                for (const c of adj.get(id) || []) stack.push(c);
            }
            return visited;
        });

        const queue = [...childIds];
        const visited = new Set();
        while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            if (
                nodeMap.get(id)?.data?.isMerge &&
                reachSets.every((s) => s.has(id))
            ) {
                return id;
            }
            for (const c of adj.get(id) || []) queue.push(c);
        }
        return null;
    }

    /** Collect all nodes reachable from startId, stopping at stopId. */
    function getSubtree(startId, stopId) {
        const subtree = new Set();
        const stack = [startId];
        while (stack.length) {
            const id = stack.pop();
            if (subtree.has(id) || id === stopId) continue;
            subtree.add(id);
            for (const c of adj.get(id) || []) stack.push(c);
        }
        return subtree;
    }

    for (const [, childList] of outgoing) {
        if (childList.length < 2) continue;

        const byHandle = [...childList].sort((a, b) => a.handleIndex - b.handleIndex);
        const groupMergeId = findGroupMerge(byHandle.map((c) => c.target));

        const currentXs = byHandle.map(({ target }) => g.node(target).x);
        const sortedXs = [...currentXs].sort((a, b) => a - b);

        byHandle.forEach(({ target }, i) => {
            const delta = sortedXs[i] - g.node(target).x;
            if (delta === 0) return;
            for (const id of getSubtree(target, groupMergeId)) {
                g.node(id).x += delta;
            }
        });
    }
}

/**
 * Build a positioned node array using dagre.
 *
 * Uses a custom ranker (longestPathFromSource) so branch children at the
 * same depth always share the same rank (same y-level), even when one
 * branch grows deeper than its siblings.
 *
 * Applies fixBranchOrdering after layout to guarantee output-0 is always
 * leftmost, output-1 next, etc., regardless of dagre's internal pass order.
 *
 * Coordinate note:
 *   dagre outputs node x/y as the node *centre*; React Flow expects *top-left*.
 *   We subtract half the node dimensions when mapping back.
 */
export function layoutGraphDagre(nodes, edges, config) {
    const cfg = { ...DEFAULTS, ...(config || {}) };

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: "TB",
        nodesep: cfg.horizontalGap,
        ranksep: cfg.verticalGap,
        marginx: 0,
        marginy: 0,
        ranker: longestPathFromSource,
    });

    for (const node of nodes) {
        g.setNode(node.id, {
            width: node.data?.width ?? cfg.nodeWidth,
            height: node.data?.height ?? cfg.nodeHeight,
        });
    }

    for (const edge of edges) {
        g.setEdge(edge.source, edge.target, { id: edge.id });
    }

    dagre.layout(g);
    fixBranchOrdering(g, nodes, edges);

    return nodes.map((node) => {
        const n = g.node(node.id);
        if (!n) return node;

        const width = node.data?.width ?? cfg.nodeWidth;
        const height = node.data?.height ?? cfg.nodeHeight;

        return {
            ...node,
            position: {
                x: n.x - width / 2,
                y: n.y - height / 2,
            },
        };
    });
}
