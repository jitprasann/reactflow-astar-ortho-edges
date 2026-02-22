import React, { createContext, useContext, useMemo } from "react";
import { useStore, useEdges } from "reactflow";
import {
    computeOrthogonalPath,
    separateOverlappingEdges,
} from "./orthogonalRouter.js";
import { DEFAULTS } from "./defaults.js";

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

/**
 * Resolve handle position and direction from nodeInternals handleBounds.
 * Falls back to port formula when handleBounds is unavailable.
 * Returns { x, y, dir } where dir is the stub direction.
 */
function getHandleInfo(node, handleId, handleType, cfg) {
    const nodeX = node.positionAbsolute?.x ?? node.position.x;
    const nodeY = node.positionAbsolute?.y ?? node.position.y;
    const nodeWidth = node.width ?? node.data?.width ?? cfg.nodeWidth;
    const nodeHeight = node.height ?? node.data?.height ?? cfg.nodeHeight;

    // Try DOM-measured handleBounds first
    const bounds = node.handleBounds;
    if (bounds) {
        const handles = handleType === "source" ? bounds.source : bounds.target;
        if (handles) {
            const handle = handles.find((h) => h.id === handleId);
            if (handle) {
                return {
                    x: nodeX + handle.x + handle.width / 2,
                    y: nodeY + handle.y + handle.height / 2,
                    dir:
                        POSITION_TO_DIR[handle.position] ||
                        (handleType === "source" ? "bottom" : "top"),
                };
            }
        }
    }

    // Fallback: compute from SquareNode port formula
    const idx = parseInt((handleId || "").split("-")[1], 10) || 0;

    if (handleType === "source") {
        const total = node.data?.outputs || 1;
        return {
            x: nodeX + ((idx + 1) / (total + 1)) * nodeWidth,
            y: nodeY + nodeHeight,
            dir: "bottom",
        };
    } else {
        const total = node.data?.inputs || 1;
        return {
            x: nodeX + ((idx + 1) / (total + 1)) * nodeWidth,
            y: nodeY,
            dir: "top",
        };
    }
}

/**
 * For merge nodes (entire circle = single handle), determine the entry point
 * and direction based on where the source node sits relative to the merge.
 * - Source to the left → enter from left side
 * - Source to the right → enter from right side
 * - Source roughly centered above → enter from top
 */
function getMergeTargetInfo(sourceNode, mergeNode, cfg) {
    const srcX = sourceNode.positionAbsolute?.x ?? sourceNode.position.x;
    const srcW = sourceNode.width ?? sourceNode.data?.width ?? cfg.nodeWidth;
    const srcCenterX = srcX + srcW / 2;

    const tgtX = mergeNode.positionAbsolute?.x ?? mergeNode.position.x;
    const tgtY = mergeNode.positionAbsolute?.y ?? mergeNode.position.y;
    const tgtW = mergeNode.width ?? mergeNode.data?.width ?? 40;
    const tgtH = mergeNode.height ?? mergeNode.data?.height ?? 40;
    const tgtCenterX = tgtX + tgtW / 2;
    const tgtCenterY = tgtY + tgtH / 2;
    const radius = tgtW / 2;

    const dx = srcCenterX - tgtCenterX;
    // Threshold: if source center is within half the merge width, treat as "above"
    const threshold = tgtW / 2;

    if (dx < -threshold) {
        // Source is to the left → enter from left
        return { x: tgtX, y: tgtCenterY, dir: "left" };
    } else if (dx > threshold) {
        // Source is to the right → enter from right
        return { x: tgtX + tgtW, y: tgtCenterY, dir: "right" };
    } else {
        // Source is roughly centered → enter from top
        return { x: tgtCenterX, y: tgtY, dir: "top" };
    }
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

            const sourceNode = nodeInternals.get(edge.source);
            const targetNode = nodeInternals.get(edge.target);
            if (!sourceNode || !targetNode) continue;

            const srcInfo = getHandleInfo(
                sourceNode,
                edge.sourceHandle,
                "source",
                cfg,
            );
            let tgtInfo;

            // Merge node: dynamically compute entry side based on source position
            if (targetNode.data?.isMerge) {
                tgtInfo = getMergeTargetInfo(sourceNode, targetNode, cfg);
            } else {
                tgtInfo = getHandleInfo(
                    targetNode,
                    edge.targetHandle,
                    "target",
                    cfg,
                );
            }

            // Build obstacle list excluding source and target nodes
            const obstacles = [];
            for (const [id, n] of nodeInternals) {
                if (id === edge.source || id === edge.target) continue;
                obstacles.push({
                    id,
                    x: n.positionAbsolute?.x ?? n.position.x,
                    y: n.positionAbsolute?.y ?? n.position.y,
                    width: n.width ?? n.data?.width ?? cfg.nodeWidth,
                    height: n.height ?? n.data?.height ?? cfg.nodeHeight,
                });
            }

            const edgeCfg = {
                ...cfg,
                ...(edge.data?.routingConfig || {}),
                sourceDir: srcInfo.dir,
                targetDir: tgtInfo.dir,
                // Apply early-bend bias only for edges that carry a label so
                // the horizontal segment (where the label sits) appears close
                // to the source. Unlabelled edges keep the late-bend default.
                earlyBendBias: edge.data?.label ? cfg.earlyBendBias : 0,
            };
            const { points } = computeOrthogonalPath(
                srcInfo.x,
                srcInfo.y,
                tgtInfo.x,
                tgtInfo.y,
                obstacles,
                edgeCfg,
            );

            edgePaths.push({ id: edge.id, points });
        }

        // Apply separation and rounding across all edges
        const separated = separateOverlappingEdges(
            edgePaths,
            cfg.edgeSeparation,
            cfg.bendRadius,
        );

        const map = new Map();
        for (const ep of separated) {
            map.set(ep.id, { path: ep.path, points: ep.points });
        }
        window.edgeMap = map;
        window.myedges = edges;
        window.mynodes = nodeInternals;
        return map;
    }, [nodeInternals, edges, config]);

    return (
        <EdgeRoutingContext.Provider value={pathMap}>
            {children}
        </EdgeRoutingContext.Provider>
    );
}
