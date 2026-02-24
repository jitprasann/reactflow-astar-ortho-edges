// Primary API — wrapper component + hook
export { default as OrthogonalFlow } from './OrthogonalFlow.jsx';
export { default as useOrthogonalFlow } from './useOrthogonalFlow.js';

// Re-export from reactflow so app doesn't need to import reactflow directly
export { Controls, Background, MiniMap, applyNodeChanges, applyEdgeChanges } from 'reactflow';

// Graph utilities
export {
    nextOutputIdx,
    nextInputIdx,
    injectHandleCounts,
    normalizeEdge,
    assignHandles,
    reindexHandlesAfterDelete,
    findMergeNode,
    placeNewNodes,
} from './graphUtils.js';

// Graph actions (pure state transforms)
export {
    toggleCollapse, addNode, addNodeInline,
    connectNodes, deleteEdge, layoutAll,
} from './graphActions.js';

// Node & edge components (for advanced usage / custom node types)
export { default as OrthogonalEdge } from './OrthogonalEdge.jsx';
export { default as NodeShell } from './NodeShell.jsx';
export { default as AddNodeMenu } from './AddNodeMenu.jsx';
export { default as ActionNode } from './ActionNode.jsx';
export { default as EdgeRoutingProvider } from './EdgeRoutingProvider.jsx';
export { default as useAutoLayout } from './useAutoLayout.js';
export { computeOrthogonalPath, waypointsToSvgPath, separateOverlappingEdges } from './orthogonalRouter.js';
export { layoutGraph, addNodesToLayout, getVisibleGraph } from './layoutEngine.js';
export { layoutGraphDagre } from './dagreLayout.js';
export { DEFAULTS } from './defaults.js';
