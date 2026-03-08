import React, { createContext, useContext, useMemo } from "react";
import { useStore, useEdges } from "reactflow";
import {
    computeOrthogonalPath,
    separateOverlappingEdges,
} from "./orthogonalRouter.js";
import { DEFAULTS, resolveNodeX, resolveNodeY, resolveNodeWidth, resolveNodeHeight } from "./defaults.js";

const EdgeRoutingContext = createContext(null);

/**
 * Hook to read a pre-computed separated path for a specific edge.
 * Returns { path, points } or null if no EdgeRoutingProvider is present.
 */
export function useEdgeRouting(edgeId) {
    const ctx = useContext(EdgeRoutingContext);
    if (!ctx) return null;
    return ctx.get(edgeId) || null;
}

// Map React Flow Position strings to stub directions
const POSITION_TO_DIR = {
    top: "top",
    bottom: "bottom",
    left: "left",
    right: "right",
};

// ---------- Handle resolution helpers ----------

function resolveHandleFromBounds(node, handleId, handleType, nodeX, nodeY) {
    const bounds = node.handleBounds;
    if (!bounds) return null;
    const handles = handleType === "source" ? bounds.source : bounds.target;
    if (!handles) return null;
    const handle = handles.find((h) => h.id === handleId);
    if (!handle) return null;
    return {
        x: nodeX + handle.x + handle.width / 2,
        y: nodeY + handle.y + handle.height / 2,
        dir:
            POSITION_TO_DIR[handle.position] ||
            (handleType === "source" ? "bottom" : "top"),
    };
}

function resolveHandleFallback(node, handleId, handleType, nodeX, nodeY, nodeWidth, nodeHeight) {
    const idx = parseInt((handleId || "").split("-")[1], 10) || 0;

    if (handleType === "source") {
        const total = (node.data && node.data.outputs) || 1;
        const offset = (idx - (total - 1) / 2) * 8;
        return {
            x: nodeX + nodeWidth / 2 + offset,
            y: nodeY + nodeHeight,
            dir: "bottom",
        };
    }
    const total = (node.data && node.data.inputs) || 1;
    const offset = (idx - (total - 1) / 2) * 8;
    return {
        x: nodeX + nodeWidth / 2 + offset,
        y: nodeY,
        dir: "top",
    };
}

/**
 * Resolve handle position and direction from nodeInternals handleBounds.
 * Falls back to port formula when handleBounds is unavailable.
 * Returns { x, y, dir } where dir is the stub direction.
 */
function getHandleInfo(node, handleId, handleType, cfg) {
    const nodeX = resolveNodeX(node);
    const nodeY = resolveNodeY(node);
    const nodeWidth = resolveNodeWidth(node, cfg.nodeWidth);
    const nodeHeight = resolveNodeHeight(node, cfg.nodeHeight);

    // Try DOM-measured handleBounds first
    const fromBounds = resolveHandleFromBounds(node, handleId, handleType, nodeX, nodeY);
    if (fromBounds) return fromBounds;

    // Fallback: centered handles 8px apart
    return resolveHandleFallback(node, handleId, handleType, nodeX, nodeY, nodeWidth, nodeHeight);
}

/**
 * For merge nodes (entire circle = single handle), determine the entry point
 * and direction based on where the source node sits relative to the merge.
 * - Source to the left → enter from left side
 * - Source to the right → enter from right side
 * - Source roughly centered above → enter from top
 */
function getMergeTargetInfo(sourceNode, mergeNode, cfg) {
    const srcX = resolveNodeX(sourceNode);
    const srcW = resolveNodeWidth(sourceNode, cfg.nodeWidth);
    const srcCenterX = srcX + srcW / 2;

    const tgtX = resolveNodeX(mergeNode);
    const tgtY = resolveNodeY(mergeNode);
    const tgtW = resolveNodeWidth(mergeNode, 40);
    const tgtH = resolveNodeHeight(mergeNode, 40);
    const tgtCenterX = tgtX + tgtW / 2;
    const tgtCenterY = tgtY + tgtH / 2;

    const dx = srcCenterX - tgtCenterX;
    // Threshold: if source center is within half the merge width, treat as "above"
    const threshold = tgtW / 2;

    if (dx < -threshold) {
        return { x: tgtX, y: tgtCenterY, dir: "left" };
    }
    if (dx > threshold) {
        return { x: tgtX + tgtW, y: tgtCenterY, dir: "right" };
    }
    return { x: tgtCenterX, y: tgtY, dir: "top" };
}

// ---------- Edge computation helpers ----------

function buildNodeRect(n, cfg) {
    return {
        id: n.id,
        x: resolveNodeX(n),
        y: resolveNodeY(n),
        width: resolveNodeWidth(n, cfg.nodeWidth),
        height: resolveNodeHeight(n, cfg.nodeHeight),
    };
}

function buildObstacleList(nodeInternals, sourceId, targetId, cfg) {
    const obstacles = [];
    for (const [id, n] of nodeInternals) {
        if (id === sourceId || id === targetId) continue;
        if (id.startsWith('__action')) continue;
        obstacles.push(buildNodeRect(n, cfg));
    }
    return obstacles;
}

function computeEdgePath(edge, nodeInternals, cfg) {
    const sourceNode = nodeInternals.get(edge.source);
    const targetNode = nodeInternals.get(edge.target);
    if (!sourceNode || !targetNode) return null;

    const srcInfo = getHandleInfo(sourceNode, edge.sourceHandle, "source", cfg);

    // Merge node: dynamically compute entry side based on source position
    const tgtInfo = (targetNode.data && targetNode.data.isMerge)
        ? getMergeTargetInfo(sourceNode, targetNode, cfg)
        : getHandleInfo(targetNode, edge.targetHandle, "target", cfg);

    const obstacles = buildObstacleList(nodeInternals, edge.source, edge.target, cfg);

    const edgeCfg = {
        ...cfg,
        ...((edge.data && edge.data.routingConfig) || {}),
        sourceDir: srcInfo.dir,
        targetDir: tgtInfo.dir,
        earlyBendBias: (targetNode.data && targetNode.data.isMerge) ? 0 : cfg.earlyBendBias,
    };

    const { points } = computeOrthogonalPath(
        srcInfo.x, srcInfo.y, tgtInfo.x, tgtInfo.y, obstacles, edgeCfg,
    );

    return { id: edge.id, points };
}

/**
 * Centralized edge routing provider. Place as a child of <ReactFlow>.
 * Computes all orthogonal paths in one pass, applies overlap separation,
 * and distributes results via context so each OrthogonalEdge can read its
 * pre-computed path without redundant calculation.
 */
export default function EdgeRoutingProvider({ children, config }) {
    const nodeInternals = useStore((state) => state.nodeInternals);
    const edges = useEdges();

    const pathMap = useMemo(() => {
        const cfg = { ...DEFAULTS, ...(config || {}) };

        if (!nodeInternals || nodeInternals.size === 0 || edges.length === 0) {
            return new Map();
        }

        const edgePaths = [];
        for (const edge of edges) {
            if (edge.type !== "orthogonal") continue;
            const result = computeEdgePath(edge, nodeInternals, cfg);
            if (result) edgePaths.push(result);
        }

        // Apply separation and rounding across all edges
        const separated = separateOverlappingEdges(
            edgePaths, cfg.edgeSeparation, cfg.bendRadius,
        );

        const map = new Map();
        for (const ep of separated) {
            map.set(ep.id, { path: ep.path, points: ep.points });
        }
        return map;
    }, [nodeInternals, edges, config]);

    return (
        <EdgeRoutingContext.Provider value={pathMap}>
            {children}
        </EdgeRoutingContext.Provider>
    );
}
