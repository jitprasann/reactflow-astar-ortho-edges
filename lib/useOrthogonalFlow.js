import { useRef } from "react";

/**
 * Hook that returns a stable API object for OrthogonalFlow.
 * Methods are attached by the <OrthogonalFlow> component.
 *
 * Usage:
 *   const flowApi = useOrthogonalFlow();
 *   <OrthogonalFlow api={flowApi} ... />
 *   flowApi.addNode(parentId, 'node');
 *   flowApi.layout();
 */
export default function useOrthogonalFlow() {
    const apiRef = useRef({});
    return apiRef.current;
}
