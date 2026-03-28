# Read-Only Mode

OrthogonalFlow supports a fully read-only mode without any library changes. All interactive elements self-suppress when their corresponding callback prop is omitted.

## Usage

Pass only the display props — omit all interaction callbacks:

```jsx
<OrthogonalFlow
    api={flowApi}
    nodes={nodes}
    edges={edges}
    onChange={handleChange}
    onNodesChange={handleNodesChange}
    onEdgesChange={handleEdgesChange}
    nodeTypes={nodeTypes}
>
    <Controls />
    <Background />
</OrthogonalFlow>
```

This gives you a pan/zoom-only graph with no editing capabilities.

## Props to Omit

| Prop | Interactive Element Disabled |
|---|---|
| `renderNodeMenu` | Node "+" button and dropdown menu |
| `renderEdgeMenu` | Edge "+" button and dropdown menu |
| `onDeleteNode` | Node delete "×" button |
| `onDeleteEdge` | Edge delete "×" button |
| `onLabelChange` | Double-click label editing |
| `onCreateNode` | Child node creation |
| `onCreateNodeInline` | Inline node insertion on edges |
| `onConnectNodes` | Drag-to-connect between nodes |
| `nodeCallbacks` | Collapse toggle, type change, and custom actions |
| `edgeToolbar` | Edge toolbar configuration |

## Selective Read-Only

You can also selectively disable features. For example, allow collapsing but prevent editing:

```jsx
<OrthogonalFlow
    api={flowApi}
    nodes={nodes}
    edges={edges}
    onChange={handleChange}
    onNodesChange={handleNodesChange}
    onEdgesChange={handleEdgesChange}
    nodeCallbacks={{ onToggleCollapse: handleCollapse }}
    nodeTypes={nodeTypes}
>
    <Controls />
    <Background />
</OrthogonalFlow>
```

## Per-Node Label Editing

Individual nodes can disable label editing by setting `data.editable` to `false`, even when `onLabelChange` is provided globally:

```js
{
    id: "locked-node",
    type: "square",
    data: { label: "Cannot edit this", editable: false, width: 80, height: 80 },
}
```

## Per-Edge Toolbar Control

Individual edges can hide specific toolbar buttons via `data.edgeToolbar`:

```js
{
    id: "e1",
    source: "a",
    target: "b",
    data: {
        edgeToolbar: {
            addButton: { hidden: true },
            deleteButton: { hidden: true },
        },
    },
}
```
