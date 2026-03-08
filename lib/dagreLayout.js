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
 * Build a positioned node array using dagre.
 *
 * Uses a custom ranker (longestPathFromSource) so branch children at the
 * same depth always share the same rank (same y-level), even when one
 * branch grows deeper than its siblings.
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
        ranksep: cfg.verticalGapWithLabel || cfg.verticalGap,
        marginx: 0,
        marginy: 0,
        ranker: longestPathFromSource,
    });

    for (const node of nodes) {
        g.setNode(node.id, {
            width: (node.data && node.data.width != null) ? node.data.width : cfg.nodeWidth,
            height: (node.data && node.data.height != null) ? node.data.height : cfg.nodeHeight,
        });
    }

    // Insert edges into dagre in REVERSE desired left-to-right order so that
    // dagre's biasRight pass (which reverses equal-barycenter siblings) produces
    // the correct final ordering.
    //
    // Default order key: numeric suffix of sourceHandle ("output-2" → 2).
    // User override:     set edge.data.order to an integer (0 = leftmost).
    //
    // Edges from sources with only one outgoing edge are unaffected.
    const edgesBySource = new Map();
    for (const edge of edges) {
        if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, []);
        edgesBySource.get(edge.source).push(edge);
    }
    for (const group of edgesBySource.values()) {
        if (group.length > 1) {
            const handleIndex = (h) => {
                const r = (h || "output-0").match(/(\d+)$/);
                return r ? parseInt(r[1], 10) : 0;
            };
            group.sort((a, b) => {
                const oa = (a.data && a.data.order != null) ? a.data.order : handleIndex(a.sourceHandle);
                const ob = (b.data && b.data.order != null) ? b.data.order : handleIndex(b.sourceHandle);
                return ob - oa; // descending → biasRight flips to ascending
            });
        }
        for (const edge of group) {
            g.setEdge(edge.source, edge.target, { id: edge.id });
        }
    }

    dagre.layout(g);

    // --- Post-layout: compact layers without labeled edges ---
    // Group nodes by rank (layer)
    const rankToNodes = new Map();
    for (const nId of g.nodes()) {
        const n = g.node(nId);
        if (!n) continue;
        const rank = n.rank ?? 0;
        if (!rankToNodes.has(rank)) rankToNodes.set(rank, []);
        rankToNodes.get(rank).push(nId);
    }

    const ranks = [...rankToNodes.keys()].sort((a, b) => a - b);

    if (ranks.length > 1) {
        const maxGap = cfg.verticalGapWithLabel;
        const normalGap = cfg.verticalGap;
        const mergeGap = cfg.verticalGapMerge ?? normalGap;

        // Build lookup structures
        const edgeMap = new Map(edges.map((e) => [`${e.source}__${e.target}`, e]));
        const nodeDataMap = new Map(nodes.map((n) => [n.id, n]));

        // For each pair of adjacent ranks, determine the desired gap:
        //   - If any edge between them has a label → verticalGapWithLabel (116px)
        //   - If any node in the current rank is a merge node → verticalGapMerge (40px)
        //   - Otherwise → verticalGap (80px)
        let cumulativeShift = 0;
        for (let i = 1; i < ranks.length; i++) {
            const prevRankNodes = rankToNodes.get(ranks[i - 1]);
            const curRankNodes = rankToNodes.get(ranks[i]);

            let hasLabel = false;
            for (const srcId of prevRankNodes) {
                for (const tgtId of curRankNodes) {
                    const e = edgeMap.get(`${srcId}__${tgtId}`);
                    if (e && e.data && e.data.label) { hasLabel = true; break; }
                }
                if (hasLabel) break;
            }

            let hasMerge = false;
            if (!hasLabel) {
                for (const nId of curRankNodes) {
                    const nd = nodeDataMap.get(nId);
                    if (nd && nd.data && nd.data.isMerge) { hasMerge = true; break; }
                }
            }

            let desiredGap = normalGap;
            if (hasLabel) desiredGap = maxGap;
            else if (hasMerge) desiredGap = mergeGap;
            cumulativeShift += maxGap - desiredGap;

            // Shift all nodes in current rank up by cumulative shift
            if (cumulativeShift > 0) {
                for (const nId of curRankNodes) {
                    const n = g.node(nId);
                    n.y -= cumulativeShift;
                }
            }
        }
    }

    return nodes.map((node) => {
        const n = g.node(node.id);
        if (!n) return node;

        const width = (node.data && node.data.width != null) ? node.data.width : cfg.nodeWidth;
        const height = (node.data && node.data.height != null) ? node.data.height : cfg.nodeHeight;

        return {
            ...node,
            position: {
                x: n.x - width / 2,
                y: n.y - height / 2,
            },
        };
    });
}
