import React, { useCallback, useMemo, useRef, useState } from "react";
import ReactFlow, {
    ReactFlowProvider,
    Controls,
    Background,
    MarkerType,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";

import {
    OrthogonalEdge,
    SquareNode,
    MergeNode,
    BranchNode,
    EdgeRoutingProvider,
    getVisibleGraph,
    layoutGraphDagre,
    DEFAULTS,
} from "../../lib/index.js";

const nodeTypes = {
    square: SquareNode,
    merge: MergeNode,
    branch: BranchNode,
};
const edgeTypes = { orthogonal: OrthogonalEdge };

const makeEdge = (id, source, sourceHandle, target, targetHandle, data) => ({
    id,
    source,
    sourceHandle,
    target,
    targetHandle,
    type: "orthogonal",
    markerEnd: { type: MarkerType.ArrowClosed },
    ...(data ? { data } : {}),
});

// Branching flow: Start -> Branch -> (If, ElseIf, Else) -> Merge -> End
// No explicit inputs/outputs — derived from edges at render time.
const rawNodes = [
    { id: "start",      type: "square", position: { x: 0, y: 0 }, data: { label: "Start",         width: 150, height: 60 } },
    { id: "branch1",    type: "branch", position: { x: 0, y: 0 }, data: { label: "Branch",        width: 150, height: 60 } },
    { id: "if-node",    type: "square", position: { x: 0, y: 0 }, data: { label: "If Path",       width: 120, height: 50 } },
    { id: "elseif-node",type: "square", position: { x: 0, y: 0 }, data: { label: "Else-If Path",  width: 120, height: 50 } },
    { id: "else-node",  type: "square", position: { x: 0, y: 0 }, data: { label: "Else Path",     width: 120, height: 50 } },
    { id: "merge1",     type: "merge",  position: { x: 0, y: 0 }, data: { label: "", isMerge: true, width: 40,  height: 40 } },
    { id: "end",        type: "square", position: { x: 0, y: 0 }, data: { label: "End",           width: 150, height: 60 } },
];

const rawEdges = [
    makeEdge("e-start-branch",  "start",      "output-0", "branch1",    "input-0"),
    makeEdge("e-branch-if",     "branch1",    "output-0", "if-node",    "input-0", { label: "If" }),
    makeEdge("e-branch-elseif", "branch1",    "output-1", "elseif-node","input-0", { label: "Else If" }),
    makeEdge("e-branch-else",   "branch1",    "output-2", "else-node",  "input-0", { label: "Else" }),
    makeEdge("e-if-merge",      "if-node",    "output-0", "merge1",     "input-0"),
    makeEdge("e-elseif-merge",  "elseif-node","output-0", "merge1",     "input-0"),
    makeEdge("e-else-merge",    "else-node",  "output-0", "merge1",     "input-0"),
    makeEdge("e-merge-end",     "merge1",     "output-0", "end",        "input-0"),
];

let idCounter = 1;
function nextId(prefix) {
    return `${prefix}-${idCounter++}`;
}

let nodeCounter = 0;
function nextNodeLabel() {
    return `Node ${++nodeCounter}`;
}

/** Next available output-N handle index for a source node based on existing edges. */
function nextOutputIdx(nodeId, edges) {
    return edges
        .filter((e) => e.source === nodeId)
        .reduce((max, e) => {
            const idx = parseInt((e.sourceHandle || "output-0").split("-")[1], 10) || 0;
            return Math.max(max, idx + 1);
        }, 0);
}

/** Next available input-N handle index for a target node based on existing edges. */
function nextInputIdx(nodeId, edges) {
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
 * Without this, newly added nodes have 0 handles and edges can't connect.
 */
function injectHandleCounts(nodes, edges) {
    const outputCounts = new Map();
    const inputCounts  = new Map();
    for (const e of edges) {
        const outIdx = parseInt((e.sourceHandle || "output-0").split("-")[1], 10) || 0;
        const inIdx  = parseInt((e.targetHandle || "input-0").split("-")[1], 10)  || 0;
        outputCounts.set(e.source, Math.max(outputCounts.get(e.source) || 0, outIdx + 1));
        inputCounts.set(e.target,  Math.max(inputCounts.get(e.target)  || 0, inIdx  + 1));
    }
    return nodes.map((n) => ({
        ...n,
        data: {
            ...n.data,
            inputs:  inputCounts.get(n.id)  || 0,
            outputs: outputCounts.get(n.id) || 0,
        },
    }));
}

/**
 * Position new nodes below a parent node using a mini dagre layout, then shift
 * all downstream nodes down to make room. Used by onAddNodeInline only.
 */
function placeNewNodes(parentId, parentNode, updatedNodes, newNodes, newEdges, updatedEdges) {
    if (!parentNode) return [...updatedNodes, ...newNodes];

    const miniNodeIds = new Set([parentId, ...newNodes.map((n) => n.id)]);
    const miniEdges = newEdges.filter(
        (e) => miniNodeIds.has(e.source) && miniNodeIds.has(e.target)
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
        ...positioned.map((n) => n.position.y + (n.data?.height ?? DEFAULTS.nodeHeight))
    );

    const allEdgesScope = [...updatedEdges, ...newEdges];
    const directDownstream = new Set(
        allEdgesScope
            .filter((e) => newIds.has(e.source) && !newIds.has(e.target))
            .map((e) => e.target)
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
        ...[...directDownstream].map((id) => nodeMap.get(id)?.position.y ?? Infinity)
    );
    const shift = newBottom + DEFAULTS.verticalGap - downstreamTopY;

    const finalUpdated =
        shift > 0
            ? updatedNodes.map((n) =>
                  downstreamIds.has(n.id)
                      ? { ...n, position: { x: n.position.x, y: n.position.y + shift } }
                      : n
              )
            : updatedNodes;

    return [...finalUpdated, ...positioned];
}

function Flow() {
    const [allNodes, setAllNodes] = useState(() => injectHandleCounts(layoutGraphDagre(rawNodes, rawEdges), rawEdges));
    const [allEdges, setAllEdges] = useState(rawEdges);

    // Refs to always access latest state from callbacks (avoids stale closures)
    const nodesRef = useRef(allNodes);
    nodesRef.current = allNodes;
    const edgesRef = useRef(allEdges);
    edgesRef.current = allEdges;

    const onToggleCollapse = useCallback(
        (nodeId, collapsed) => {
            const curNodes = nodesRef.current;
            const curEdges = edgesRef.current;
            const updatedNodes = curNodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, collapsed } } : n,
            );
            const { visibleNodes: vNodes, visibleEdges: vEdges } = getVisibleGraph(updatedNodes, curEdges);
            const positioned = layoutGraphDagre(vNodes, vEdges);
            const posMap = new Map(positioned.map((n) => [n.id, n.position]));
            setAllNodes(
                injectHandleCounts(
                    updatedNodes.map((n) => {
                        const pos = posMap.get(n.id);
                        return pos ? { ...n, position: pos } : n;
                    }),
                    curEdges,
                ),
            );
        },
        [],
    );

    /**
     * Add a new node or branch node as a new output from a parent.
     * Keeps all existing edges intact — no handle counts stored in node data.
     */
    const onAddNode = useCallback(
        (parentId, type) => {
            const curNodes = nodesRef.current;
            const curEdges = edgesRef.current;
            const outIdx = nextOutputIdx(parentId, curEdges);
            const parentNode = curNodes.find((n) => n.id === parentId);
            if (!parentNode) return;

            let newNodes, newEdges;

            if (type === "node") {
                const newNodeId = nextId("node");
                newNodes = [
                    { id: newNodeId, type: "square", position: { x: 0, y: 0 }, data: { label: nextNodeLabel(), width: 150, height: 60 } },
                ];

                // If parent is a branch node, add label and connect to its merge node
                if (parentNode.type === "branch") {
                    const label = `Condition ${outIdx + 1}`;
                    newEdges = [
                        makeEdge(nextId("e"), parentId, `output-${outIdx}`, newNodeId, "input-0", { label }),
                    ];
                    // Find the merge node: BFS from branch's existing children
                    const childIds = curEdges.filter((e) => e.source === parentId).map((e) => e.target);
                    const adjMap = new Map();
                    for (const e of curEdges) {
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
                        const node = curNodes.find((n) => n.id === id);
                        if (node?.data?.isMerge) { mergeId = id; break; }
                        for (const c of adjMap.get(id) || []) queue.push(c);
                    }
                    if (mergeId) {
                        newEdges.push(
                            makeEdge(nextId("e"), newNodeId, "output-0", mergeId, "input-0"),
                        );
                    }
                } else {
                    newEdges = [
                        makeEdge(nextId("e"), parentId, `output-${outIdx}`, newNodeId, "input-0"),
                    ];
                }
            } else {
                const branchId = nextId("branch");
                const ifId     = nextId("if");
                const elseId   = nextId("else");
                const mergeId  = nextId("merge");
                newNodes = [
                    { id: branchId, type: "branch", position: { x: 0, y: 0 }, data: { label: "Branch", width: 150, height: 60 } },
                    { id: ifId,     type: "square", position: { x: 0, y: 0 }, data: { label: "If",     width: 120, height: 50 } },
                    { id: elseId,   type: "square", position: { x: 0, y: 0 }, data: { label: "Else",   width: 120, height: 50 } },
                    { id: mergeId,  type: "merge",  position: { x: 0, y: 0 }, data: { label: "", isMerge: true, width: 40, height: 40 } },
                ];
                newEdges = [
                    makeEdge(nextId("e"), parentId, `output-${outIdx}`, branchId, "input-0"),
                    makeEdge(nextId("e"), branchId, "output-0", ifId,    "input-0", { label: "If" }),
                    makeEdge(nextId("e"), branchId, "output-1", elseId,  "input-0", { label: "Else" }),
                    makeEdge(nextId("e"), ifId,     "output-0", mergeId, "input-0"),
                    makeEdge(nextId("e"), elseId,   "output-0", mergeId, "input-0"),
                ];
            }

            // Collect existing direct children of parent
            const existingSiblingIds = curEdges
                .filter((e) => e.source === parentId)
                .map((e) => e.target);
            const existingSiblings = curNodes.filter((n) => existingSiblingIds.includes(n.id));

            // Mini graph: parent + existing siblings + new nodes
            const miniNodes = [parentNode, ...existingSiblings, ...newNodes];
            const newNodeIds = new Set(newNodes.map((n) => n.id));
            const siblingIds = new Set(existingSiblingIds);
            // Edges: parent→siblings (existing) + all new edges within mini graph
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

            // Delta to keep parent in its original position
            const dx = parentNode.position.x - miniParent.position.x;
            const dy = parentNode.position.y - miniParent.position.y;

            // Build position map for siblings + new nodes (not parent)
            const posMap = new Map();
            for (const n of mini) {
                if (n.id === parentId) continue;
                posMap.set(n.id, { x: n.position.x + dx, y: n.position.y + dy });
            }

            // Apply: update sibling positions, add new nodes with positions
            const allNextEdges = [...curEdges, ...newEdges];
            const updatedNodes = curNodes.map((n) => {
                const pos = posMap.get(n.id);
                return pos ? { ...n, position: pos } : n;
            });
            const positionedNew = newNodes.map((n) => ({
                ...n,
                position: posMap.get(n.id) || n.position,
            }));

            setAllNodes(injectHandleCounts([...updatedNodes, ...positionedNew], allNextEdges));
            setAllEdges(allNextEdges);
        },
        [],
    );

    /**
     * Insert a new node or branch structure inline between an edge's source and target.
     * Removes the original edge and rewires through the new structure.
     */
    const onAddNodeInline = useCallback(
        (edgeId, type) => {
            const curNodes = nodesRef.current;
            const curEdges = edgesRef.current;
            const edge = curEdges.find((e) => e.id === edgeId);
            if (!edge) return;

            const { source: sourceId, sourceHandle, target: targetId, targetHandle } = edge;
            const parentNode = curNodes.find((n) => n.id === sourceId);
            const updatedEdges = curEdges.filter((e) => e.id !== edgeId);

            if (type === "node") {
                const nodeId = nextId("node");
                const newNode = {
                    id: nodeId,
                    type: "square",
                    position: { x: 0, y: 0 },
                    data: { label: nextNodeLabel(), width: 150, height: 60 },
                };
                const newEdges = [
                    makeEdge(nextId("e"), sourceId, sourceHandle, nodeId, "input-0"),
                    makeEdge(nextId("e"), nodeId, "output-0", targetId, targetHandle),
                ];
                const allFinalEdges = [...updatedEdges, ...newEdges];
                setAllNodes(injectHandleCounts(placeNewNodes(sourceId, parentNode, curNodes, [newNode], newEdges, updatedEdges), allFinalEdges));
                setAllEdges(allFinalEdges);
            } else if (type === "branch") {
                const branchId = nextId("branch");
                const ifId = nextId("if");
                const elseId = nextId("else");
                const mergeId = nextId("merge");
                const newNodes = [
                    { id: branchId, type: "branch", position: { x: 0, y: 0 }, data: { label: "Branch", width: 150, height: 60 } },
                    { id: ifId,     type: "square", position: { x: 0, y: 0 }, data: { label: "If",     width: 120, height: 50 } },
                    { id: elseId,   type: "square", position: { x: 0, y: 0 }, data: { label: "Else",   width: 120, height: 50 } },
                    { id: mergeId,  type: "merge",  position: { x: 0, y: 0 }, data: { label: "", isMerge: true, width: 40, height: 40 } },
                ];
                const newEdges = [
                    makeEdge(nextId("e"), sourceId,  sourceHandle, branchId, "input-0"),
                    makeEdge(nextId("e"), branchId,  "output-0",   ifId,    "input-0", { label: "If" }),
                    makeEdge(nextId("e"), branchId,  "output-1",   elseId,  "input-0", { label: "Else" }),
                    makeEdge(nextId("e"), ifId,      "output-0",   mergeId, "input-0"),
                    makeEdge(nextId("e"), elseId,    "output-0",   mergeId, "input-0"),
                    makeEdge(nextId("e"), mergeId,   "output-0",   targetId, targetHandle),
                ];
                const allFinalEdges = [...updatedEdges, ...newEdges];
                setAllNodes(injectHandleCounts(placeNewNodes(sourceId, parentNode, curNodes, newNodes, newEdges, updatedEdges), allFinalEdges));
                setAllEdges(allFinalEdges);
            }
        },
        [],
    );

    /**
     * Connect two existing nodes with a new edge using the next available handles.
     * No node data update needed — handle counts are derived from edges in useMemo.
     */
    const onConnectToExisting = useCallback(
        (sourceNodeId, targetNodeId) => {
            const curEdges = edgesRef.current;
            const outIdx = nextOutputIdx(sourceNodeId, curEdges);
            const inIdx  = nextInputIdx(targetNodeId,  curEdges);
            const newEdge = makeEdge(
                nextId("e"),
                sourceNodeId, `output-${outIdx}`,
                targetNodeId, `input-${inIdx}`,
            );
            setAllEdges((prev) => [...prev, newEdge]);
        },
        [],
    );

    const onDeleteEdge = useCallback((edgeId) => {
        const curEdges = edgesRef.current;
        const curNodes = nodesRef.current;
        const deleted = curEdges.find((e) => e.id === edgeId);
        if (!deleted) return;

        const remaining = curEdges.filter((e) => e.id !== edgeId);

        // Re-index source handles: close gaps so handles stay contiguous
        const srcId = deleted.source;
        const srcEdges = remaining
            .filter((e) => e.source === srcId)
            .sort((a, b) => {
                const ai = parseInt((a.sourceHandle || "output-0").split("-")[1], 10) || 0;
                const bi = parseInt((b.sourceHandle || "output-0").split("-")[1], 10) || 0;
                return ai - bi;
            });
        const srcRemap = new Map();
        srcEdges.forEach((e, i) => srcRemap.set(e.id, `output-${i}`));

        // Re-index target handles: close gaps
        const tgtId = deleted.target;
        const tgtEdges = remaining
            .filter((e) => e.target === tgtId)
            .sort((a, b) => {
                const ai = parseInt((a.targetHandle || "input-0").split("-")[1], 10) || 0;
                const bi = parseInt((b.targetHandle || "input-0").split("-")[1], 10) || 0;
                return ai - bi;
            });
        const tgtRemap = new Map();
        tgtEdges.forEach((e, i) => tgtRemap.set(e.id, `input-${i}`));

        const reindexed = remaining.map((e) => {
            let edge = e;
            if (srcRemap.has(e.id) && e.source === srcId) {
                edge = { ...edge, sourceHandle: srcRemap.get(e.id) };
            }
            if (tgtRemap.has(e.id) && e.target === tgtId) {
                edge = { ...edge, targetHandle: tgtRemap.get(e.id) };
            }
            return edge;
        });

        setAllNodes(injectHandleCounts(curNodes, reindexed));
        setAllEdges(reindexed);
    }, []);

    const { visibleNodes, visibleEdges } = useMemo(() => {
        const withCallbacks = allNodes.map((n) => {
            const extra = {};
            if (n.type === "branch") extra.onToggleCollapse = onToggleCollapse;
            if (n.type !== "merge") extra.onAddNode = onAddNode;
            return Object.keys(extra).length > 0
                ? { ...n, data: { ...n.data, ...extra } }
                : n;
        });
        const { visibleNodes: vn, visibleEdges: ve } = getVisibleGraph(withCallbacks, allEdges);

        // Derive inputs/outputs counts purely from visible edges.
        // A handle only exists if an edge uses it.
        const outputCounts = new Map();
        const inputCounts  = new Map();
        for (const e of ve) {
            const outIdx = parseInt((e.sourceHandle || "output-0").split("-")[1], 10) || 0;
            const inIdx  = parseInt((e.targetHandle || "input-0").split("-")[1], 10)  || 0;
            outputCounts.set(e.source, Math.max(outputCounts.get(e.source) || 0, outIdx + 1));
            inputCounts.set(e.target,  Math.max(inputCounts.get(e.target)  || 0, inIdx  + 1));
        }

        // Connectable nodes for "Connect to" section (visible, non-merge)
        const connectableNodes = vn
            .filter((n) => !n.data?.isMerge)
            .map((n) => ({ id: n.id, label: n.data?.label || n.id }));

        const finalNodes = vn.map((n) => {
            const withCounts = {
                ...n,
                data: {
                    ...n.data,
                    inputs:  inputCounts.get(n.id)  || 0,
                    outputs: outputCounts.get(n.id) || 0,
                },
            };
            if (n.data?.isMerge) return withCounts;
            return {
                ...withCounts,
                data: {
                    ...withCounts.data,
                    otherNodes: connectableNodes.filter((c) => c.id !== n.id),
                    onConnectToExisting,
                },
            };
        });

        const edgesWithCallbacks = ve.map((e) => ({
            ...e,
            data: { ...(e.data || {}), onDeleteEdge, onAddNodeInline },
        }));

        return { visibleNodes: finalNodes, visibleEdges: edgesWithCallbacks };
    }, [allNodes, allEdges, onToggleCollapse, onAddNode, onDeleteEdge, onAddNodeInline, onConnectToExisting]);

    const onNodesChange = useCallback((changes) => {
        setAllNodes((nds) => applyNodeChanges(changes, nds));
    }, []);

    const onEdgesChange = useCallback((changes) => {
        setAllEdges((eds) => applyEdgeChanges(changes, eds));
    }, []);

    const onConnect = useCallback((params) => {
        setAllEdges((eds) =>
            addEdge(
                { ...params, type: "orthogonal", markerEnd: { type: MarkerType.ArrowClosed } },
                eds,
            ),
        );
    }, []);

    const handleLayout = useCallback(() => {
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        setAllNodes(injectHandleCounts(layoutGraphDagre(curNodes, curEdges), curEdges));
    }, []);

    return (
        <div style={{ width: "100vw", height: "100vh" }}>
            <div className="controls-panel">
                <button onClick={handleLayout}>Re-Layout</button>
            </div>
            <ReactFlow
                nodes={visibleNodes}
                edges={visibleEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                deleteKeyCode="Delete"
            >
                <Controls />
                <Background />
            </ReactFlow>
        </div>
    );
}

export default function App() {
    return (
        <ReactFlowProvider>
            <EdgeRoutingProvider>
                <Flow />
            </EdgeRoutingProvider>
        </ReactFlowProvider>
    );
}
