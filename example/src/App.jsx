import React, { useCallback, useEffect, useMemo, useState } from "react";
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
    useAutoLayout,
    getVisibleGraph,
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
// Merge handles: left branch -> input-left, center -> input-top, right -> input-right
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
    makeEdge(
        "e-branch-elseif",
        "branch1",
        "output-1",
        "elseif-node",
        "input-0",
        { label: "Else If" },
    ),
    makeEdge("e-branch-else", "branch1", "output-2", "else-node", "input-0", { label: "Else" }),
    // All branches connect to merge's single handle — router picks entry side dynamically
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
    const [allNodes, setAllNodes] = useState(rawNodes);
    const [allEdges, setAllEdges] = useState(rawEdges);
    const [layoutReady, setLayoutReady] = useState(false);

    const { layoutAll, addNodes } = useAutoLayout();

    // Toggle collapse — re-layout visible graph so gaps close/open
    const onToggleCollapse = useCallback(
        async (nodeId, collapsed) => {
            const updatedNodes = allNodes.map((n) =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, collapsed } }
                    : n,
            );

            // Compute visible subset and re-layout to close/open gaps
            const { visibleNodes: vNodes, visibleEdges: vEdges } =
                getVisibleGraph(updatedNodes, allEdges);
            const positioned = await layoutAll(vNodes, vEdges);

            // Merge new positions back into the full node list
            const posMap = new Map(
                positioned.map((n) => [n.id, n.position]),
            );
            setAllNodes(
                updatedNodes.map((n) => {
                    const pos = posMap.get(n.id);
                    return pos ? { ...n, position: pos } : n;
                }),
            );
        },
        [allNodes, allEdges, layoutAll],
    );

    // Add node/branch below a parent
    const onAddNode = useCallback(
        async (parentId, type) => {
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

                // Find existing child edges from parent and re-attach them from the new node
                const childEdges = allEdges.filter(
                    (e) => e.source === parentId,
                );
                const updatedEdges = allEdges.map((e) =>
                    e.source === parentId
                        ? { ...e, source: nodeId, sourceHandle: "output-0" }
                        : e,
                );

                const newEdge = makeEdge(
                    nextId("e"),
                    parentId,
                    "output-0",
                    nodeId,
                    "input-0",
                );

                // Ensure parent has at least 1 output
                const updatedNodes = allNodes.map((n) =>
                    n.id === parentId && (n.data.outputs || 0) === 0
                        ? { ...n, data: { ...n.data, outputs: 1 } }
                        : n,
                );

                const positioned = await addNodes(
                    updatedNodes,
                    [...updatedEdges, newEdge],
                    parentId,
                    [newNode],
                    [newEdge],
                );
                setAllNodes(positioned);
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

                // Re-attach parent's child edges from merge node
                const updatedEdges = allEdges.map((e) =>
                    e.source === parentId
                        ? { ...e, source: mergeId, sourceHandle: "output-0" }
                        : e,
                );

                const newEdges = [
                    makeEdge(
                        nextId("e"),
                        parentId,
                        "output-0",
                        branchId,
                        "input-0",
                    ),
                    makeEdge(
                        nextId("e"),
                        branchId,
                        "output-0",
                        ifId,
                        "input-0",
                        { label: "If" },
                    ),
                    makeEdge(
                        nextId("e"),
                        branchId,
                        "output-1",
                        elseId,
                        "input-0",
                        { label: "Else" },
                    ),
                    makeEdge(nextId("e"), ifId, "output-0", mergeId, "input-0"),
                    makeEdge(
                        nextId("e"),
                        elseId,
                        "output-0",
                        mergeId,
                        "input-0",
                    ),
                ];

                // Ensure parent has at least 1 output
                const updatedNodes = allNodes.map((n) =>
                    n.id === parentId && (n.data.outputs || 0) === 0
                        ? { ...n, data: { ...n.data, outputs: 1 } }
                        : n,
                );

                const positioned = await addNodes(
                    updatedNodes,
                    [...updatedEdges, ...newEdges],
                    parentId,
                    newNodes,
                    newEdges,
                );
                setAllNodes(positioned);
                setAllEdges([...updatedEdges, ...newEdges]);
            }
        },
        [allNodes, allEdges, addNodes],
    );

    // Inject callbacks into nodes
    const { visibleNodes, visibleEdges } = useMemo(() => {
        const withCallbacks = allNodes.map((n) => {
            const extra = {};
            if (n.type === "branch") extra.onToggleCollapse = onToggleCollapse;
            if (n.type !== "merge") extra.onAddNode = onAddNode;
            return Object.keys(extra).length > 0
                ? { ...n, data: { ...n.data, ...extra } }
                : n;
        });
        return getVisibleGraph(withCallbacks, allEdges);
    }, [allNodes, allEdges, onToggleCollapse, onAddNode]);

    // Initial layout
    useEffect(() => {
        if (layoutReady) return;
        layoutAll(rawNodes, rawEdges).then((positioned) => {
            setAllNodes(positioned);
            setLayoutReady(true);
        });
    }, [layoutReady, layoutAll]);

    // Handle React Flow changes (drag, select)
    const onNodesChange = useCallback((changes) => {
        setAllNodes((nds) => applyNodeChanges(changes, nds));
    }, []);

    const onEdgesChange = useCallback((changes) => {
        setAllEdges((eds) => applyEdgeChanges(changes, eds));
    }, []);

    // Manual edge connection
    const onConnect = useCallback((params) => {
        setAllEdges((eds) =>
            addEdge(
                {
                    ...params,
                    type: "orthogonal",
                    markerEnd: { type: MarkerType.ArrowClosed },
                },
                eds,
            ),
        );
    }, []);

    // Re-layout
    const handleLayout = useCallback(async () => {
        const positioned = await layoutAll(allNodes, allEdges);
        setAllNodes(positioned);
    }, [allNodes, allEdges, layoutAll]);

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
