# Read-Only Mode

OrthogonalFlow supports a fully read-only mode. All interactive elements self-suppress when their corresponding callback prop is omitted or configured to hide.

## Full Read-Only Example

```jsx
<OrthogonalFlow
    api={flowApi}
    nodes={nodes}
    edges={edges}
    onChange={handleChange}
    onNodesChange={handleNodesChange}
    onEdgesChange={handleEdgesChange}
    deleteKeyCode={null}
    edgeToolbar={{
        deleteButton: { hidden: true },
        addButton: { hidden: true },
    }}
    nodeCallbacks={{ hideDeleteButton: true }}
    nodeTypes={nodeTypes}
>
    <Controls />
    <Background />
</OrthogonalFlow>
```

This gives you a pan/zoom-only graph with no editing capabilities.

## Props to Omit or Configure

### Omit these props to disable their features

| Prop | Interactive Element Disabled |
|---|---|
| `renderNodeMenu` | Node "+" button and dropdown menu |
| `renderEdgeMenu` | Edge "+" button and dropdown menu |
| `onLabelChange` | Double-click label editing |
| `onCreateNode` | Child node creation |
| `onCreateNodeInline` | Inline node insertion on edges |
| `onConnectNodes` | Drag-to-connect between nodes |

### Set these props to hide delete UI

| Prop | Value | Effect |
|---|---|---|
| `deleteKeyCode` | `null` | Disables keyboard deletion |
| `edgeToolbar` | `{ deleteButton: { hidden: true } }` | Hides edge delete button |
| `edgeToolbar` | `{ addButton: { hidden: true } }` | Hides edge add button |
| `nodeCallbacks` | `{ hideDeleteButton: true }` | Hides node delete button |

## Selective Read-Only

You can selectively disable features. For example, allow collapsing but prevent editing:

```jsx
<OrthogonalFlow
    api={flowApi}
    nodes={nodes}
    edges={edges}
    onChange={handleChange}
    onNodesChange={handleNodesChange}
    onEdgesChange={handleEdgesChange}
    deleteKeyCode={null}
    edgeToolbar={{
        deleteButton: { hidden: true },
        addButton: { hidden: true },
    }}
    nodeCallbacks={{
        hideDeleteButton: true,
        onToggleCollapse: handleCollapse,
    }}
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
