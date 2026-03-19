import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useFlowStore } from '@/store/useFlowStore'
import { nodeTypes } from '@/nodes'
import { getOperatorMeta } from '@/utils/operatorRegistry'
import type { OperatorType, FlowNodeData } from '@/types'

let nodeIdCounter = 0

const defaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: '#94a3b8' },
  animated: false,
}

export function FlowCanvas() {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const onNodesChange = useFlowStore((s) => s.onNodesChange)
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange)
  const onConnect = useFlowStore((s) => s.onConnect)
  const addNode = useFlowStore((s) => s.addNode)
  const selectNode = useFlowStore((s) => s.selectNode)
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId)
  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const operatorType = event.dataTransfer.getData('application/reactflow-operator') as OperatorType
      if (!operatorType) return

      const meta = getOperatorMeta(operatorType)
      if (!meta) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: Node<FlowNodeData> = {
        id: `node_${++nodeIdCounter}_${Date.now()}`,
        type: 'operator',
        position,
        data: {
          label: meta.label,
          category: meta.category,
          operatorType: meta.type,
          config: structuredClone(meta.defaultConfig),
        },
      }

      addNode(newNode)
    },
    [addNode, screenToFlowPosition],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedIds = changes
        .filter((c): c is NodeChange & { type: 'remove'; id: string } => c.type === 'remove')
        .map((c) => c.id)
      if (removedIds.length > 0 && selectedNodeId && removedIds.includes(selectedNodeId)) {
        selectNode(null)
      }
      onNodesChange(changes)
    },
    [onNodesChange, selectNode, selectedNodeId],
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const targetNode = nodes.find((n) => n.id === connection.target)
      if (!targetNode) return false
      const targetData = targetNode.data as FlowNodeData
      if (targetData.operatorType === 'join') return true
      return !edges.some((e) => e.target === connection.target)
    },
    [nodes, edges],
  )

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange as (changes: EdgeChange[]) => void}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        isValidConnection={isValidConnection}
        edgesFocusable
        edgesReconnectable
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-gray-50"
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-white !border-gray-200"
        />
      </ReactFlow>
    </div>
  )
}
