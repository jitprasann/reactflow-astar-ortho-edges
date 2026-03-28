// Node dimension/position helpers — shared across JSX components
export function resolveNodeX(node) {
    if (node.positionAbsolute && node.positionAbsolute.x != null) return node.positionAbsolute.x;
    return node.position.x;
}

export function resolveNodeY(node) {
    if (node.positionAbsolute && node.positionAbsolute.y != null) return node.positionAbsolute.y;
    return node.position.y;
}

export function resolveNodeWidth(node, fallback) {
    if (node.width != null) return node.width;
    if (node.data && node.data.width != null) return node.data.width;
    return fallback;
}

export function resolveNodeHeight(node, fallback) {
    if (node.height != null) return node.height;
    if (node.data && node.data.height != null) return node.data.height;
    return fallback;
}

export const DEFAULTS = {
    padding: 20,
    sourceStubLength: 20,
    targetStubLength: 20,
    bendPenalty: 100,
    earlyBendBias: 0.01,
    nodeWidth: 80,
    nodeHeight: 80,
    edgeStrokeColor: "#555",
    edgeStrokeWidth: 1.5,
    edgeSeparation: 5,
    bendRadius: 8,
    horizontalGap: 48,
    verticalGap: 80,
    verticalGapWithLabel: 116,
    verticalGapMerge: 40,
    perBranchCollapse: false,
    collapseAnimation: true,
    edgeLabelFontSize: 11,
    edgeLabelOffset: 4,
    edgeLabelBackground: "#ffffff",
    edgeLabelDistanceFromTarget: 80,
    edgeSelectedColor: "#1976d2",
    edgeSelectedWidth: 2.5,
    addButtonVerticalOffset: 16,
    addButtonRightOffset: null,
    addButtonSize: 24,
};
