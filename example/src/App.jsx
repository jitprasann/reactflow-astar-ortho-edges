import React, { useCallback, useMemo, useState } from "react";
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
const rawNodes = [
    {
        id: "start",
        type: "square",
        position: { x: 0, y: 0 },
        data: { label: "Start", inputs: 0, outputs: 1, width: 150, height: 60 },
    },
    {
        id: "branch1",
        type: "branch",
        position: { x: 0, y: 0 },
        data: {
            label: "Branch",
            inputs: 1,
            outputs: 3,
            width: 150,
            height: 60,
        },
    },
    {
        id: "if-node",
        type: "square",
        position: { x: 0, y: 0 },
        data: {
            label: "If Path",
            inputs: 1,
            outputs: 1,
            width: 120,
            height: 50,
        },
    },
    {
        id: "elseif-node",
        type: "square",
        position: { x: 0, y: 0 },
        data: {
            label: "Else-If Path",
            inputs: 1,
            outputs: 1,
            width: 120,
            height: 50,
        },
    },
    {
        id: "else-node",
        type: "square",
        position: { x: 0, y: 0 },
        data: {
            label: "Else Path",
            inputs: 1,
            outputs: 1,
            width: 120,
            height: 50,
        },
    },
    {
        id: "merge1",
        type: "merge",
        position: { x: 0, y: 0 },
        data: { label: "", inputs: 3, isMerge: true, width: 40, height: 40 },
    },
    {
        id: "end",
        type: "square",
        position: { x: 0, y: 0 },
        data: { label: "End", inputs: 1, outputs: 0, width: 150, height: 60 },
    },
];

const rawEdges = [
    makeEdge("e-start-branch", "start", "output-0", "branch1", "input-0"),
    makeEdge("e-branch-if", "branch1", "output-0", "if-node", "input-0", { label: "If" }),
    makeEdge("e-branch-elseif", "branch1", "output-1", "elseif-node", "input-0", { label: "Else If" }),
    makeEdge("e-branch-else", "branch1", "output-2", "else-node", "input-0", { label: "Else" }),
    makeEdge("e-if-merge", "if-node", "output-0", "merge1", "input-0"),
    makeEdge("e-elseif-merge", "elseif-node", "output-0", "merge1", "input-0"),
    makeEdge("e-else-merge", "else-node", "output-0", "merge1", "input-0"),
    makeEdge("e-merge-end", "merge1", "output-0", "end", "input-0"),
];

let idCounter = 1;
function nextId(prefix) {
    return `${prefix}-${idCounter++}`;
}

function Flow() {
    const [allNodes, setAllNodes] = useState(() => layoutGraphDagre(rawNodes, rawEdges));
    const [allEdges, setAllEdges] = useState(rawEdges);

    const onToggleCollapse = useCallback(
        (nodeId, collapsed) => {
            const updatedNodes = allNodes.map((n) =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, collapsed } }
                    : n,
            );
            const { visibleNodes: vNodes, visibleEdges: vEdges } =
                getVisibleGraph(updatedNodes, allEdges);
            const positioned = layoutGraphDagre(vNodes, vEdges);
            const posMap = new Map(positioned.map((n) => [n.id, n.position]));
            setAllNodes(
                updatedNodes.map((n) => {
                    const pos = posMap.get(n.id);
                    return pos ? { ...n, position: pos } : n;
                }),
            );
        },
        [allNodes, allEdges],
    );

    const onAddNode = useCallback(
        (parentId, type) => {
            const parentNode = allNodes.find((n) => n.id === parentId);

            // Layout only the new nodes relative to the parent, then shift
            // all downstream nodes down to make room for the new structure.
            function placeNewNodes(updatedNodes, newNodes, newEdges, updatedEdges) {
                if (!parentNode) return [...updatedNodes, ...newNodes];

                // Step 1: position new nodes via mini-graph
                const mini = layoutGraphDagre([parentNode, ...newNodes], newEdges);
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

                // Step 2: find bottom of new nodes
                const newBottom = Math.max(
                    ...positioned.map((n) => n.position.y + (n.data?.height ?? DEFAULTS.nodeHeight))
                );

                // Step 3: find direct downstream nodes (new structure → existing graph)
                const allEdges = [...updatedEdges, ...newEdges];
                const directDownstream = new Set(
                    allEdges
                        .filter((e) => newIds.has(e.source) && !newIds.has(e.target))
                        .map((e) => e.target)
                );

                if (directDownstream.size === 0) return [...updatedNodes, ...positioned];

                // Step 4: BFS to collect all downstream nodes
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

                // Step 5: shift downstream nodes down to clear the new structure
                const nodeMap = new Map(updatedNodes.map((n) => [n.id, n]));
                const downstreamTopY = Math.min(
                    ...[...directDownstream].map((id) => nodeMap.get(id)?.position.y ?? Infinity)
                );
                const shift = (newBottom + DEFAULTS.verticalGap) - downstreamTopY;

                const finalUpdated = shift > 0
                    ? updatedNodes.map((n) =>
                        downstreamIds.has(n.id)
                            ? { ...n, position: { x: n.position.x, y: n.position.y + shift } }
                            : n
                      )
                    : updatedNodes;

                return [...finalUpdated, ...positioned];
            }

            if (type === "node") {
                const nodeId = nextId("node");
                const newNode = {
                    id: nodeId,
                    type: "square",
                    position: { x: 0, y: 0 },
                    data: {
                        label: nodeId,
                        inputs: 1,
                        outputs: 1,
                        width: 150,
                        height: 60,
                    },
                };

                const updatedEdges = allEdges.map((e) =>
                    e.source === parentId
                        ? { ...e, source: nodeId, sourceHandle: "output-0" }
                        : e,
                );
                const newEdge = makeEdge(nextId("e"), parentId, "output-0", nodeId, "input-0");
                const updatedNodes = allNodes.map((n) =>
                    n.id === parentId && (n.data.outputs || 0) === 0
                        ? { ...n, data: { ...n.data, outputs: 1 } }
                        : n,
                );

                setAllNodes(placeNewNodes(updatedNodes, [newNode], [newEdge], updatedEdges));
                setAllEdges([...updatedEdges, newEdge]);
            } else if (type === "branch") {
                const branchId = nextId("branch");
                const ifId = nextId("if");
                const elseId = nextId("else");
                const mergeId = nextId("merge");

                const newNodes = [
                    {
                        id: branchId,
                        type: "branch",
                        position: { x: 0, y: 0 },
                        data: {
                            label: "Branch",
                            inputs: 1,
                            outputs: 2,
                            width: 150,
                            height: 60,
                        },
                    },
                    {
                        id: ifId,
                        type: "square",
                        position: { x: 0, y: 0 },
                        data: {
                            label: "If",
                            inputs: 1,
                            outputs: 1,
                            width: 120,
                            height: 50,
                        },
                    },
                    {
                        id: elseId,
                        type: "square",
                        position: { x: 0, y: 0 },
                        data: {
                            label: "Else",
                            inputs: 1,
                            outputs: 1,
                            width: 120,
                            height: 50,
                        },
                    },
                    {
                        id: mergeId,
                        type: "merge",
                        position: { x: 0, y: 0 },
                        data: {
                            label: "",
                            inputs: 2,
                            isMerge: true,
                            width: 40,
                            height: 40,
                        },
                    },
                ];

                const updatedEdges = allEdges.map((e) =>
                    e.source === parentId
                        ? { ...e, source: mergeId, sourceHandle: "output-0" }
                        : e,
                );
                const newEdges = [
                    makeEdge(nextId("e"), parentId, "output-0", branchId, "input-0"),
                    makeEdge(nextId("e"), branchId, "output-0", ifId, "input-0", { label: "If" }),
                    makeEdge(nextId("e"), branchId, "output-1", elseId, "input-0", { label: "Else" }),
                    makeEdge(nextId("e"), ifId, "output-0", mergeId, "input-0"),
                    makeEdge(nextId("e"), elseId, "output-0", mergeId, "input-0"),
                ];

                const updatedNodes = allNodes.map((n) =>
                    n.id === parentId && (n.data.outputs || 0) === 0
                        ? { ...n, data: { ...n.data, outputs: 1 } }
                        : n,
                );

                setAllNodes(placeNewNodes(updatedNodes, newNodes, newEdges, updatedEdges));
                setAllEdges([...updatedEdges, ...newEdges]);
            }
        },
        [allNodes, allEdges],
    );

    const onDeleteEdge = useCallback((edgeId) => {
        setAllEdges((eds) => eds.filter((e) => e.id !== edgeId));
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
        const edgesWithDelete = ve.map((e) => ({
            ...e,
            data: { ...(e.data || {}), onDeleteEdge },
        }));
        return { visibleNodes: vn, visibleEdges: edgesWithDelete };
    }, [allNodes, allEdges, onToggleCollapse, onAddNode, onDeleteEdge]);

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
        const positioned = layoutGraphDagre(allNodes, allEdges);
        setAllNodes(positioned);
    }, [allNodes, allEdges]);

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
