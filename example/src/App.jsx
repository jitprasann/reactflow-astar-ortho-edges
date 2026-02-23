import React, { useState, useCallback } from "react";
import {
    OrthogonalFlow,
    useOrthogonalFlow,
    Controls,
    Background,
    layoutGraphDagre,
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

// --- Initial graph data ---
// No explicit handles — the library assigns them on first render.
const rawNodes = [
    { id: "start",       type: "square", position: { x: 0, y: 0 }, data: { label: "Start",        width: 150, height: 60 } },
    { id: "branch1",     type: "branch", position: { x: 0, y: 0 }, data: { label: "Branch",       width: 150, height: 60 } },
    { id: "if-node",     type: "square", position: { x: 0, y: 0 }, data: { label: "If Path",      width: 120, height: 50 } },
    { id: "elseif-node", type: "square", position: { x: 0, y: 0 }, data: { label: "Else-If Path", width: 120, height: 50 } },
    { id: "else-node",   type: "square", position: { x: 0, y: 0 }, data: { label: "Else Path",    width: 120, height: 50 } },
    { id: "merge1",      type: "merge",  position: { x: 0, y: 0 }, data: { label: "", isMerge: true, width: 40, height: 40 } },
    { id: "end",         type: "square", position: { x: 0, y: 0 }, data: { label: "End",          width: 150, height: 60 } },
];

const rawEdges = [
    { id: "e-start-branch",  source: "start",       sourceHandle: "output-0", target: "branch1",     targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
    { id: "e-branch-if",     source: "branch1",     sourceHandle: "output-0", target: "if-node",     targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" }, data: { label: "If" } },
    { id: "e-branch-elseif", source: "branch1",     sourceHandle: "output-1", target: "elseif-node", targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" }, data: { label: "Else If" } },
    { id: "e-branch-else",   source: "branch1",     sourceHandle: "output-2", target: "else-node",   targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" }, data: { label: "Else" } },
    { id: "e-if-merge",      source: "if-node",     sourceHandle: "output-0", target: "merge1",      targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
    { id: "e-elseif-merge",  source: "elseif-node", sourceHandle: "output-0", target: "merge1",      targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
    { id: "e-else-merge",    source: "else-node",   sourceHandle: "output-0", target: "merge1",      targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
    { id: "e-merge-end",     source: "merge1",      sourceHandle: "output-0", target: "end",         targetHandle: "input-0", type: "orthogonal", markerEnd: { type: "arrowclosed" } },
];

// Pre-layout and inject handle counts for initial render
const initialNodes = layoutGraphDagre(rawNodes, rawEdges);
const initialEdges = rawEdges;

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
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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

    // Factory: app decides IDs, labels, structure for new nodes
    const handleCreateNode = useCallback((parentId, type, context) => {
        if (type === "node") {
            const nodeId = nextId("node");
            const newEdges = [{ id: nextId("e"), source: parentId, target: nodeId }];
            if (context.mergeNodeId) {
                newEdges.push({ id: nextId("e"), source: nodeId, target: context.mergeNodeId });
            }
            return {
                nodes: [{ id: nodeId, type: "square", data: { label: nextNodeLabel(), width: 150, height: 60 } }],
                edges: newEdges,
            };
        }
        if (type === "branch") {
            const bId = nextId("branch");
            const ifId = nextId("if");
            const elseId = nextId("else");
            const mId = nextId("merge");
            return {
                nodes: [
                    { id: bId,     type: "branch", data: { label: "Branch", width: 150, height: 60 } },
                    { id: ifId,    type: "square", data: { label: "If",     width: 120, height: 50 } },
                    { id: elseId,  type: "square", data: { label: "Else",   width: 120, height: 50 } },
                    { id: mId,     type: "merge",  data: { label: "", isMerge: true, width: 40, height: 40 } },
                ],
                edges: [
                    { id: nextId("e"), source: parentId, target: bId },
                    { id: nextId("e"), source: bId, target: ifId,   data: { label: "If" } },
                    { id: nextId("e"), source: bId, target: elseId, data: { label: "Else" } },
                    { id: nextId("e"), source: ifId,   target: mId },
                    { id: nextId("e"), source: elseId, target: mId },
                ],
            };
        }
    }, []);

    // Factory: app decides IDs, labels for inline node insertion
    const handleCreateNodeInline = useCallback((edgeId, sourceId, targetId, type) => {
        if (type === "node") {
            const nodeId = nextId("node");
            return {
                nodes: [{ id: nodeId, type: "square", data: { label: nextNodeLabel(), width: 150, height: 60 } }],
                edges: [
                    { id: nextId("e"), source: sourceId, target: nodeId },
                    { id: nextId("e"), source: nodeId,   target: targetId },
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
                    { id: bId,     type: "branch", data: { label: "Branch", width: 150, height: 60 } },
                    { id: ifId,    type: "square", data: { label: "If",     width: 120, height: 50 } },
                    { id: elseId,  type: "square", data: { label: "Else",   width: 120, height: 50 } },
                    { id: mId,     type: "merge",  data: { label: "", isMerge: true, width: 40, height: 40 } },
                ],
                edges: [
                    { id: nextId("e"), source: sourceId, target: bId },
                    { id: nextId("e"), source: bId,   target: ifId,   data: { label: "If" } },
                    { id: nextId("e"), source: bId,   target: elseId, data: { label: "Else" } },
                    { id: nextId("e"), source: ifId,  target: mId },
                    { id: nextId("e"), source: elseId, target: mId },
                    { id: nextId("e"), source: mId,   target: targetId },
                ],
            };
        }
    }, []);

    // Factory: app decides edge ID for connecting existing nodes
    const handleConnectNodes = useCallback((sourceId, targetId) => {
        return { edge: { id: nextId("e"), source: sourceId, target: targetId } };
    }, []);

    // App-controlled menu CONTENT for node "+" button
    const renderNodeMenu = useCallback(
        (nodeId) => (
            <div>
                <div style={sectionHeaderStyle}>Add new</div>
                <MenuItem onClick={() => flowApi.addNode(nodeId, "node")}>Add Node</MenuItem>
                <MenuItem onClick={() => flowApi.addNode(nodeId, "branch")} style={{ borderTop: "1px solid #eee" }}>
                    Add Branch
                </MenuItem>
                <div style={{ borderTop: "2px solid #eee", marginTop: 2 }} />
                <div style={sectionHeaderStyle}>Connect to</div>
                {flowApi.getNodes && flowApi.getNodes()
                    .filter((n) => n.id !== nodeId && !n.data?.isMerge)
                    .map((n) => (
                        <MenuItem key={n.id} onClick={() => flowApi.connectNodes(nodeId, n.id)}>
                            {n.data?.label || n.id}
                        </MenuItem>
                    ))}
            </div>
        ),
        [flowApi],
    );

    // App-controlled menu CONTENT for edge "+" button
    const renderEdgeMenu = useCallback(
        (edgeId, sourceId, targetId) => (
            <div>
                <div style={sectionHeaderStyle}>Insert between</div>
                <MenuItem onClick={() => flowApi.addNodeInline(edgeId, "node")}>Add Node</MenuItem>
                <MenuItem onClick={() => flowApi.addNodeInline(edgeId, "branch")} style={{ borderTop: "1px solid #eee" }}>
                    Add Branch
                </MenuItem>
            </div>
        ),
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
                onCreateNode={handleCreateNode}
                onCreateNodeInline={handleCreateNodeInline}
                onConnectNodes={handleConnectNodes}
                renderNodeMenu={renderNodeMenu}
                renderEdgeMenu={renderEdgeMenu}
                nodeTypes={nodeTypes}
            >
                <Controls />
                <Background />
            </OrthogonalFlow>
        </div>
    );
}
