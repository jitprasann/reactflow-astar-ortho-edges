import React, { useState, useCallback } from "react";
import {
    OrthogonalFlow,
    useOrthogonalFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    cascadeDeleteNode,
    cascadeDeleteEdge,
} from "../../lib/index.js";
import "reactflow/dist/style.css";

import SquareNode from "./SquareNode.jsx";
import BranchNode from "./BranchNode.jsx";
import MergeNode from "./MergeNode.jsx";

const nodeTypes = {
    square: SquareNode,
    branch: BranchNode,
    merge: MergeNode,
};

// --- App business logic: IDs, labels ---
let idCounter = 1;
function nextId(prefix) {
    return `${prefix}-${idCounter++}`;
}

let nodeCounter = 0;
function nextNodeLabel() {
    return `Node ${++nodeCounter}`;
}

// --- Initial graph data (backup — full branch example) ---
// const rawNodesBackup = [
//     { id: "start", type: "square", position: { x: 0, y: 0 }, data: { label: "Start", width: 80, height: 80 } },
//     { id: "branch1", type: "branch", position: { x: 0, y: 0 }, data: { label: "Branch", isBranch: true, width: 80, height: 80 } },
//     { id: "if-node", type: "square", position: { x: 0, y: 0 }, data: { label: "If Path", width: 80, height: 80 } },
//     { id: "elseif-node", type: "square", position: { x: 0, y: 0 }, data: { label: "Else-If Path", width: 80, height: 80 } },
//     { id: "else-node", type: "square", position: { x: 0, y: 0 }, data: { label: "Else Path", width: 80, height: 80 } },
//     { id: "merge1", type: "merge", position: { x: 0, y: 0 }, data: { label: "", isMerge: true, width: 40, height: 40 } },
//     { id: "end", type: "square", position: { x: 0, y: 0 }, data: { label: "End", width: 80, height: 80 } },
// ];
// const rawEdgesBackup = [
//     { id: "e-start-branch", source: "start", sourceHandle: "output-0", target: "branch1", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
//     { id: "e-branch-if", source: "branch1", sourceHandle: "output-0", target: "if-node", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" }, data: { label: "If" } },
//     { id: "e-branch-elseif", source: "branch1", sourceHandle: "output-1", target: "elseif-node", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" }, data: { label: "Else If" } },
//     { id: "e-branch-else", source: "branch1", sourceHandle: "output-2", target: "else-node", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" }, data: { label: "Else" } },
//     { id: "e-if-merge", source: "if-node", sourceHandle: "output-0", target: "merge1", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
//     { id: "e-elseif-merge", source: "elseif-node", sourceHandle: "output-0", target: "merge1", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
//     { id: "e-else-merge", source: "else-node", sourceHandle: "output-0", target: "merge1", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
//     { id: "e-merge-end", source: "merge1", sourceHandle: "output-0", target: "end", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
// ];

// --- Simple two-node graph ---
const initialNodes = [
    {
        id: "start",
        type: "square",
        position: { x: 100, y: 100 },
        data: { label: "Start", width: 80, height: 80 },
    },
    {
        id: "end",
        type: "square",
        position: { x: 100, y: 260 },
        data: { label: "End", width: 80, height: 80 },
    },
];

const initialEdges = [
    {
        id: "e-start-end",
        source: "start",
        sourceHandle: "output-0",
        target: "end",
        targetHandle: "input-0",
        type: "orthogonal",
        markerEnd: { type: "arrowclosed" },
    },
];

// --- Menu styles ---
const sectionHeaderStyle = {
    padding: "4px 12px 2px",
    fontSize: 10,
    color: "#999",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    userSelect: "none",
};

const menuItemStyle = {
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    color: "#333",
    whiteSpace: "nowrap",
};

function MenuItem({ onClick, children, style: extraStyle }) {
    return (
        <div
            onClick={onClick}
            style={{ ...menuItemStyle, ...extraStyle }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
            onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
            }
        >
            {children}
        </div>
    );
}

export default function App() {
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const flowApi = useOrthogonalFlow();

    const handleChange = useCallback(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
    }, []);

    const handleNodesChange = useCallback((changes) => {
        setNodes((nds) => applyNodeChanges(changes, nds));
    }, []);

    const handleEdgesChange = useCallback((changes) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    }, []);

    // Cascade deletion callbacks
    const handleDeleteNode = useCallback(
        (nodeId, node, { nodes: ns, edges: es }) => {
            return cascadeDeleteNode(ns, es, nodeId, {
                createEdge: (source, target) => ({
                    id: nextId("e"),
                    source,
                    target,
                    type: "orthogonal",
                    markerEnd: { type: "arrowclosed" },
                }),
            });
        },
        [],
    );

    const handleDeleteEdge = useCallback(
        (edgeId, edge, { nodes: ns, edges: es }) => {
            return cascadeDeleteEdge(ns, es, edgeId, {
                createEdge: (source, target) => ({
                    id: nextId("e"),
                    source,
                    target,
                    type: "orthogonal",
                    markerEnd: { type: "arrowclosed" },
                }),
                isBranchEdge: (e) => e.data && e.data.label,
            });
        },
        [],
    );

    // Label validation: reject duplicate labels
    const handleLabelChange = useCallback((nodeId, newLabel, { nodes: ns }) => {
        var duplicate = ns.some(function (n) {
            return n.id !== nodeId && n.data && n.data.label === newLabel;
        });
        if (duplicate) {
            alert("Label \"" + newLabel + "\" already exists. Please use a unique label.");
            return null;
        }
        return newLabel;
    }, []);

    // Change node type callback (passed via nodeCallbacks)
    const handleChangeType = useCallback((nodeId, newType) => {
        setNodes((nds) =>
            nds.map((n) => (n.id === nodeId ? { ...n, type: newType } : n)),
        );
    }, []);

    // Helper: build a parent update node with child count in label
    function parentWithChildCount(parentNode, newChildCount) {
        var baseLabel = parentNode.data.label.split(" (")[0];
        var label = baseLabel + " (" + newChildCount + " children)";
        return {
            id: parentNode.id,
            data: { ...parentNode.data, label: label },
        };
    }

    // Factory: app decides IDs, labels, structure for new nodes
    const handleCreateNode = useCallback((parentId, type, context) => {
        var childCount = context.existingOutputCount + 1;

        if (type === "node") {
            const nodeId = nextId("node");
            return {
                nodes: [
                    {
                        id: nodeId,
                        type: "square",
                        data: { label: nextNodeLabel(), width: 80, height: 80 },
                    },
                    parentWithChildCount(context.parentNode, childCount),
                ],
                edges: [
                    { id: nextId("e"), source: parentId, target: nodeId },
                ],
            };
        }
        if (type === "branch") {
            const bId = nextId("branch");
            const ifId = nextId("if");
            const elseId = nextId("else");
            const mId = nextId("merge");
            return {
                nodes: [
                    {
                        id: bId,
                        type: "branch",
                        data: {
                            label: "Branch",
                            isBranch: true,
                            width: 80,
                            height: 80,
                        },
                    },
                    {
                        id: ifId,
                        type: "square",
                        data: { label: "If", width: 80, height: 80 },
                    },
                    {
                        id: elseId,
                        type: "square",
                        data: { label: "Else", width: 80, height: 80 },
                    },
                    {
                        id: mId,
                        type: "merge",
                        data: {
                            label: "",
                            isMerge: true,
                            width: 40,
                            height: 40,
                        },
                    },
                    parentWithChildCount(context.parentNode, childCount),
                ],
                edges: [
                    { id: nextId("e"), source: parentId, target: bId },
                    {
                        id: nextId("e"),
                        source: bId,
                        target: ifId,
                        data: { label: "If" },
                    },
                    {
                        id: nextId("e"),
                        source: bId,
                        target: elseId,
                        data: { label: "Else" },
                    },
                    { id: nextId("e"), source: ifId, target: mId },
                    { id: nextId("e"), source: elseId, target: mId },
                ],
            };
        }
        if (type === "condition") {
            const condId = nextId("cond");
            const newEdges = [
                { id: nextId("e"), source: parentId, target: condId, data: { label: "Condition" } },
            ];
            if (context && context.mergeNodeId) {
                newEdges.push({ id: nextId("e"), source: condId, target: context.mergeNodeId });
            }
            return {
                nodes: [
                    {
                        id: condId,
                        type: "square",
                        data: { label: nextNodeLabel(), width: 80, height: 80 },
                    },
                    parentWithChildCount(context.parentNode, childCount),
                ],
                edges: newEdges,
            };
        }
    }, []);

    // Factory: app decides IDs, labels for inline node insertion
    const handleCreateNodeInline = useCallback(
        (edgeId, sourceId, targetId, type) => {
            // Get source node to demonstrate updating existing nodes
            var allNodes = flowApi.getNodes && flowApi.getNodes();
            var allEdges = flowApi.getEdges && flowApi.getEdges();
            var sourceNode = allNodes && allNodes.find(function (n) { return n.id === sourceId; });

            if (type === "node") {
                const nodeId = nextId("node");
                var returnedNodes = [
                    {
                        id: nodeId,
                        type: "square",
                        data: {
                            label: nextNodeLabel(),
                            width: 80,
                            height: 80,
                        },
                    },
                ];
                // Update source node label with child count
                if (sourceNode && allEdges) {
                    var currentChildren = allEdges.filter(function (e) { return e.source === sourceId; }).length;
                    returnedNodes.push(parentWithChildCount(sourceNode, currentChildren));
                }
                return {
                    nodes: returnedNodes,
                    edges: [
                        { id: nextId("e"), source: sourceId, target: nodeId },
                        { id: nextId("e"), source: nodeId, target: targetId },
                    ],
                };
            }
            if (type === "branch") {
                const bId = nextId("branch");
                const ifId = nextId("if");
                const elseId = nextId("else");
                const mId = nextId("merge");
                var branchNodes = [
                    {
                        id: bId,
                        type: "branch",
                        data: {
                            label: "Branch",
                            isBranch: true,
                            width: 80,
                            height: 80,
                        },
                    },
                    {
                        id: ifId,
                        type: "square",
                        data: { label: "If", width: 80, height: 80 },
                    },
                    {
                        id: elseId,
                        type: "square",
                        data: { label: "Else", width: 80, height: 80 },
                    },
                    {
                        id: mId,
                        type: "merge",
                        data: {
                            label: "",
                            isMerge: true,
                            width: 40,
                            height: 40,
                        },
                    },
                ];
                if (sourceNode && allEdges) {
                    var currentChildren = allEdges.filter(function (e) { return e.source === sourceId; }).length;
                    branchNodes.push(parentWithChildCount(sourceNode, currentChildren));
                }
                return {
                    nodes: branchNodes,
                    edges: [
                        { id: nextId("e"), source: sourceId, target: bId },
                        {
                            id: nextId("e"),
                            source: bId,
                            target: ifId,
                            data: { label: "If" },
                        },
                        {
                            id: nextId("e"),
                            source: bId,
                            target: elseId,
                            data: { label: "Else" },
                        },
                        { id: nextId("e"), source: ifId, target: mId },
                        { id: nextId("e"), source: elseId, target: mId },
                        { id: nextId("e"), source: mId, target: targetId },
                    ],
                };
            }
        },
        [flowApi],
    );

    // Factory: app decides edge ID for connecting existing nodes
    const handleConnectNodes = useCallback((sourceId, targetId) => {
        return {
            edge: { id: nextId("e"), source: sourceId, target: targetId },
        };
    }, []);

    // App-controlled menu CONTENT for node "+" button
    const renderNodeMenu = useCallback(
        (nodeId) => {
            var allNodes = flowApi.getNodes && flowApi.getNodes();
            var node = allNodes && allNodes.find(function (n) { return n.id === nodeId; });
            if (node && node.id === "end") return null;
            var isBranch = node && node.data && node.data.isBranch;
            if (isBranch) {
                return { onClick: function() { flowApi.addNode(nodeId, "condition"); } };
            }
            return (
                <div>
                    <div style={sectionHeaderStyle}>Add new</div>
                    <MenuItem onClick={() => flowApi.addNode(nodeId, "node")}>
                        Add Node
                    </MenuItem>
                    <MenuItem
                        onClick={() => flowApi.addNode(nodeId, "branch")}
                        style={{ borderTop: "1px solid #eee" }}
                    >
                        Add Branch
                    </MenuItem>
                    <div
                        style={{ borderTop: "2px solid #eee", marginTop: 2 }}
                    />
                    <div style={sectionHeaderStyle}>Connect to</div>
                    {flowApi.getNodes &&
                        flowApi
                            .getNodes()
                            .filter(function (n) { return n.id !== nodeId && !(n.data && n.data.isMerge); })
                            .map((n) => (
                                <MenuItem
                                    key={n.id}
                                    onClick={() =>
                                        flowApi.connectNodes(nodeId, n.id)
                                    }
                                >
                                    {(n.data && n.data.label) || n.id}
                                </MenuItem>
                            ))}
                </div>
            );
        },
        [flowApi],
    );

    // App-controlled menu CONTENT for edge "+" button
    const renderEdgeMenu = useCallback(
        (edgeId, sourceId, targetId) => {
            var allNodes = flowApi.getNodes && flowApi.getNodes();
            var sourceNode = allNodes && allNodes.find(function (n) { return n.id === sourceId; });
            if (sourceNode && sourceNode.data && sourceNode.data.isBranch) {
                return { onClick: function() { flowApi.addNodeInline(edgeId, "node"); } };
            }
            return (
                <div>
                    <div style={sectionHeaderStyle}>Insert between</div>
                    <MenuItem onClick={() => flowApi.addNodeInline(edgeId, "node")}>
                        Add Node
                    </MenuItem>
                    <MenuItem
                        onClick={() => flowApi.addNodeInline(edgeId, "branch")}
                        style={{ borderTop: "1px solid #eee" }}
                    >
                        Add Branch
                    </MenuItem>
                </div>
            );
        },
        [flowApi],
    );

    return (
        <div style={{ width: "100vw", height: "100vh" }}>
            <div className="controls-panel">
                <button onClick={() => flowApi.layout()}>Re-Layout</button>
            </div>
            <OrthogonalFlow
                api={flowApi}
                nodes={nodes}
                edges={edges}
                onChange={handleChange}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onCreateNode={handleCreateNode}
                onCreateNodeInline={handleCreateNodeInline}
                onConnectNodes={handleConnectNodes}
                onDeleteNode={handleDeleteNode}
                onDeleteEdge={handleDeleteEdge}
                onLabelChange={handleLabelChange}
                renderNodeMenu={renderNodeMenu}
                renderEdgeMenu={renderEdgeMenu}
                nodeCallbacks={{
                    onChangeType: handleChangeType,
                    availableTypes: ["square", "branch"],
                }}
                nodeTypes={nodeTypes}
                autoLayout={true}
            >
                <Controls />
                <Background />
            </OrthogonalFlow>
        </div>
    );
}
