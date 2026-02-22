import ELK from "elkjs/lib/elk.bundled.js";
import { DEFAULTS } from "./defaults.js";

const elk = new ELK();

/**
 * Convert React Flow nodes + edges into an ELK graph object.
 * Builds explicit ports per node so ELK respects FIXED_ORDER
 * (output-0 = leftmost, output-1 = next, etc.)
 */
function buildElkGraph(nodes, edges, cfg, interactive = false) {
    // Collect ports per node from edges
    // Key: nodeId, Value: { sources: Set<handleId>, targets: Set<handleId> }
    const portSets = new Map();
    for (const node of nodes) {
        portSets.set(node.id, { sources: new Set(), targets: new Set() });
    }
    for (const edge of edges) {
        const src = portSets.get(edge.source);
        if (src) src.sources.add(edge.sourceHandle || "output-0");
        const tgt = portSets.get(edge.target);
        if (tgt) tgt.targets.add(edge.targetHandle || "input-0");
    }

    const children = nodes.map((node) => {
        const ps = portSets.get(node.id);
        const ports = [];
        const nodeWidth = node.data?.width ?? cfg.nodeWidth;
        const nodeHeight = node.data?.height ?? cfg.nodeHeight;

        // Input ports on top (NORTH), sorted by handle index for stable order
        // Centered, 8px apart
        const targetHandles = Array.from(ps.targets).sort();
        targetHandles.forEach((handleId, i) => {
            const offset = (i - (targetHandles.length - 1) / 2) * 8;
            ports.push({
                id: `${node.id}__${handleId}`,
                x: nodeWidth / 2 + offset,
                y: 0,
                width: 1,
                height: 1,
                properties: {
                    "org.eclipse.elk.port.side": "NORTH",
                    "org.eclipse.elk.port.index": String(i),
                },
            });
        });

        // Output ports on bottom (SOUTH), sorted by handle index
        // Centered, 8px apart
        const sourceHandles = Array.from(ps.sources).sort();
        sourceHandles.forEach((handleId, i) => {
            const offset = (i - (sourceHandles.length - 1) / 2) * 8;
            ports.push({
                id: `${node.id}__${handleId}`,
                x: nodeWidth / 2 + offset,
                y: nodeHeight,
                width: 1,
                height: 1,
                properties: {
                    "org.eclipse.elk.port.side": "SOUTH",
                    "org.eclipse.elk.port.index": String(i),
                },
            });
        });

        const child = {
            id: node.id,
            width: nodeWidth,
            height: nodeHeight,
            ports,
            properties: {
                "org.eclipse.elk.portConstraints": "FIXED_POS",
            },
        };

        // In interactive mode, feed existing positions as hints to ELK
        if (
            interactive &&
            node.position &&
            (node.position.x !== 0 || node.position.y !== 0)
        ) {
            child.x = node.position.x;
            child.y = node.position.y;
        }

        return child;
    });

    // Edges reference port IDs
    const elkEdges = edges.map((edge) => ({
        id: edge.id,
        sources: [`${edge.source}__${edge.sourceHandle || "output-0"}`],
        targets: [`${edge.target}__${edge.targetHandle || "input-0"}`],
    }));

    const layoutOptions = {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        // LONGEST_PATH assigns each node to the layer equal to its longest
        // path FROM the source. This guarantees that branch children at the
        // same topological depth (e.g. if/else-if/else nodes) always land in
        // the same horizontal layer, even when one branch grows deeper.
        "elk.layered.layering.strategy": "LONGEST_PATH_SOURCE",
        "elk.spacing.nodeNode": String(cfg.horizontalGap),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(cfg.verticalGap),
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    };

    if (interactive) {
        layoutOptions["org.eclipse.elk.interactive"] = "true";
        layoutOptions[
            "org.eclipse.elk.layered.crossingMinimization.semiInteractive"
        ] = "true";
    }

    return {
        id: "root",
        layoutOptions,
        children,
        edges: elkEdges,
    };
}

/**
 * Map ELK output positions back onto the original React Flow nodes.
 */
function applyElkPositions(elkGraph, originalNodes) {
    const posMap = new Map();
    for (const child of elkGraph.children) {
        posMap.set(child.id, { x: child.x, y: child.y });
    }

    return originalNodes.map((node) => {
        const pos = posMap.get(node.id);
        if (!pos) return node;
        return { ...node, position: { x: pos.x, y: pos.y } };
    });
}

/**
 * Run ELK layout on all nodes and return positioned nodes.
 * Async because ELK runs in a Web Worker / WASM.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} [config] - optional config overrides
 * @returns {Promise<Array>} positioned nodes
 */
export async function layoutGraph(nodes, edges, config) {
    const cfg = { ...DEFAULTS, ...(config || {}) };
    const elkGraph = buildElkGraph(nodes, edges, cfg);
    const layouted = await elk.layout(elkGraph);
    return applyElkPositions(layouted, nodes);
}

/**
 * Add new nodes + edges to an existing graph and re-layout.
 * Runs a full ELK layout over all nodes so ELK's LONGEST_PATH layering
 * correctly places every node, keeping same-depth siblings (e.g. branch
 * children) on the same horizontal layer.
 *
 * @param {Array} existingNodes
 * @param {Array} existingEdges
 * @param {string} parentId - unused, kept for API compatibility
 * @param {Array} newNodes - new nodes to add
 * @param {Array} newEdges - new edges to add
 * @param {Object} [config]
 * @returns {Promise<Array>} all nodes with updated positions
 */
export async function addNodesToLayout(
    existingNodes,
    existingEdges,
    parentId,
    newNodes,
    newEdges,
    config,
) {
    const allNodes = [...existingNodes, ...newNodes];
    const allEdges = [...existingEdges, ...newEdges];
    return layoutGraph(allNodes, allEdges, config);
}

/**
 * Filter out collapsed nodes/edges and generate bypass edges.
 *
 * When a branch node has data.collapsed = true, all nodes between it and
 * its associated merge node (data.isMerge = true) are hidden. A direct
 * bypass edge is created from the branch node to the merge node's child.
 *
 * When perBranchCollapse is enabled and an individual branch child has
 * data.collapsed = true, only that branch path is hidden (nodes between
 * the branch child and the merge node).
 *
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {{ visibleNodes: Array, visibleEdges: Array }}
 */
export function getVisibleGraph(nodes, edges) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const childrenOf = new Map(); // parentId -> [childId, ...]
    const parentOf = new Map(); // childId -> parentId

    for (const edge of edges) {
        if (!childrenOf.has(edge.source)) childrenOf.set(edge.source, []);
        childrenOf.get(edge.source).push(edge.target);
        parentOf.set(edge.target, edge.source);
    }

    const hiddenIds = new Set();

    /**
     * Find the merge node associated with a branch node.
     * A merge node is the first downstream node with data.isMerge = true
     * that is reachable from all branches of the given branch node.
     */
    function findMergeNode(branchId) {
        const branchChildren = childrenOf.get(branchId) || [];
        if (branchChildren.length < 2) return null;

        // BFS from each branch child, collect all reachable nodes
        const reachSets = branchChildren.map((startId) => {
            const visited = new Set();
            const queue = [startId];
            while (queue.length > 0) {
                const id = queue.shift();
                if (visited.has(id)) continue;
                visited.add(id);
                const kids = childrenOf.get(id) || [];
                for (const kid of kids) queue.push(kid);
            }
            return visited;
        });

        // Find the first merge node reachable from ALL branches
        // Search in BFS order from branch children for earliest merge
        const queue = [...branchChildren];
        const visited = new Set();
        while (queue.length > 0) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            const node = nodeMap.get(id);
            if (node && node.data?.isMerge) {
                // Check reachable from all branches
                const allReach = reachSets.every((set) => set.has(id));
                if (allReach) return id;
            }
            const kids = childrenOf.get(id) || [];
            for (const kid of kids) queue.push(kid);
        }
        return null;
    }

    /**
     * Collect all node IDs between a start node (exclusive) and a merge node (inclusive).
     */
    function collectBetween(startId, mergeId) {
        const between = new Set();
        const queue = childrenOf.get(startId) || [];
        const visited = new Set();
        for (const child of queue) {
            const stack = [child];
            while (stack.length > 0) {
                const id = stack.pop();
                if (visited.has(id)) continue;
                visited.add(id);
                between.add(id);
                if (id === mergeId) continue; // don't traverse past merge
                const kids = childrenOf.get(id) || [];
                for (const kid of kids) stack.push(kid);
            }
        }
        return between;
    }

    /**
     * Collect nodes in a single branch path from branchChild down to mergeId (exclusive).
     */
    function collectBranchPath(branchChildId, mergeId) {
        const path = new Set();
        const stack = [branchChildId];
        const visited = new Set();
        while (stack.length > 0) {
            const id = stack.pop();
            if (visited.has(id)) continue;
            visited.add(id);
            if (id === mergeId) continue; // stop at merge, don't include it
            path.add(id);
            const kids = childrenOf.get(id) || [];
            for (const kid of kids) stack.push(kid);
        }
        return path;
    }

    // Process full group collapses (branch node with data.collapsed = true)
    for (const node of nodes) {
        if (!node.data?.collapsed) continue;

        const children = childrenOf.get(node.id) || [];
        if (children.length < 2) continue; // not a branch node

        const mergeId = findMergeNode(node.id);
        if (!mergeId) continue;

        const between = collectBetween(node.id, mergeId);
        for (const id of between) hiddenIds.add(id);
    }

    // Process per-branch collapses (individual branch child with data.collapsed = true)
    for (const node of nodes) {
        if (!node.data?.collapsed) continue;
        if (hiddenIds.has(node.id)) continue; // already hidden by full group collapse

        const parent = parentOf.get(node.id);
        if (!parent) continue;

        const siblings = childrenOf.get(parent) || [];
        if (siblings.length < 2) continue; // parent is not a branch node

        const mergeId = findMergeNode(parent);
        if (!mergeId) continue;

        const branchPath = collectBranchPath(node.id, mergeId);
        for (const id of branchPath) hiddenIds.add(id);
    }

    // Build visible nodes
    const visibleNodes = nodes.filter((n) => !hiddenIds.has(n.id));

    // Build visible edges + bypass edges
    const visibleEdges = [];
    const bypassEdges = new Set(); // track to avoid duplicates

    for (const edge of edges) {
        const sourceHidden = hiddenIds.has(edge.source);
        const targetHidden = hiddenIds.has(edge.target);

        if (!sourceHidden && !targetHidden) {
            visibleEdges.push(edge);
        } else if (!sourceHidden && targetHidden) {
            // Source visible, target hidden: find bypass target
            // Walk from source's collapsed branch through to merge's child
            const mergeId = findMergeNode(edge.source);
            if (mergeId) {
                const mergeChildren = childrenOf.get(mergeId) || [];
                for (const child of mergeChildren) {
                    if (!hiddenIds.has(child)) {
                        const bypassKey = `${edge.source}->${child}`;
                        if (!bypassEdges.has(bypassKey)) {
                            bypassEdges.add(bypassKey);
                            visibleEdges.push({
                                id: `bypass-${edge.source}-${child}`,
                                source: edge.source,
                                target: child,
                                type: edge.type,
                                markerEnd: edge.markerEnd,
                                data: { ...edge.data, isBypass: true },
                            });
                        }
                    }
                }
            }
        }
        // If source is hidden, edge is fully hidden (no bypass from hidden source)
    }

    return { visibleNodes, visibleEdges };
}
