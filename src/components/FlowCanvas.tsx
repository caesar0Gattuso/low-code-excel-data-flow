import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useFlowStore } from '@/store/useFlowStore'
import { useTemporalStore } from '@/store/useTemporalStore'
import { nodeTypes } from '@/nodes'
import { RoutedEdge } from '@/nodes/RoutedEdge'
import { getOperatorMeta, operatorRegistry } from '@/utils/operatorRegistry'
import { ContextMenu } from './ContextMenu'
import { DataPreviewModal } from './DataPreviewModal'
import type { OperatorType, FlowNodeData, NodeCategory } from '@/types'

let nodeIdCounter = 0

const edgeTypes = {
  default: RoutedEdge,
  smoothstep: RoutedEdge,
  routed: RoutedEdge,
}

const categoryIcon: Record<NodeCategory, string> = {
  input:       '📂',
  transformer: '⚙️',
  restructure: '🔧',
  aggregator:  '🔗',
  output:      '📤',
}

type MenuState = {
  x: number
  y: number
  flowPos: { x: number; y: number }
  nodeId?: string
} | null

export function FlowCanvas() {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const onNodesChange = useFlowStore((s) => s.onNodesChange)
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange)
  const onConnect = useFlowStore((s) => s.onConnect)
  const addNode = useFlowStore((s) => s.addNode)
  const setEdges = useFlowStore((s) => s.setEdges)
  const selectNode = useFlowStore((s) => s.selectNode)
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId)
  const clipboard = useFlowStore((s) => s.clipboard)
  const copyNodes = useFlowStore((s) => s.copyNodes)
  const pasteNodes = useFlowStore((s) => s.pasteNodes)
  const deleteNodes = useFlowStore((s) => s.deleteNodes)
  const edgeStyle = useFlowStore((s) => s.edgeStyle)
  const clearEdgeWaypoints = useFlowStore((s) => s.clearEdgeWaypoints)
  const selectionOnDrag = useFlowStore((s) => s.selectionOnDrag)
  const previewNodeId = useFlowStore((s) => s.previewNodeId)
  const setPreviewNodeId = useFlowStore((s) => s.setPreviewNodeId)
  const previewMap = useFlowStore((s) => s.previewMap)
  const inputPreviewMap = useFlowStore((s) => s.inputPreviewMap)
  const outputMap = useFlowStore((s) => s.outputMap)
  const previewTotals = useFlowStore((s) => s.previewTotals)
  const { undo, redo, pastStates, futureStates } = useTemporalStore()
  const { screenToFlowPosition } = useReactFlow()

  const [menu, setMenu] = useState<MenuState>(null)
  const lastFlowPosRef = useRef<{ x: number; y: number }>({ x: 100, y: 100 })

  // 节点被手动拖动后，waypoints 失效，清除
  const waypointsClearedRef = useRef(false)

  const closeMenu = useCallback(() => setMenu(null), [])

  // 根据 edgeStyle 决定默认边类型
  const edgeTypeName = edgeStyle === 'routed' ? 'routed' : edgeStyle === 'smoothstep' ? 'smoothstep' : 'default'

  const defaultEdgeOptions = useMemo(() => ({
    style: { strokeWidth: 2, stroke: '#94a3b8' },
    animated: false,
    type: edgeTypeName,
  }), [edgeTypeName])

  // edgeStyle 切换时，同步更新现有边的 type
  const edgeTypeRef = useRef(edgeTypeName)
  useEffect(() => {
    if (edgeTypeRef.current === edgeTypeName) return
    edgeTypeRef.current = edgeTypeName
    setEdges(
      useFlowStore.getState().edges.map((e) => ({ ...e, type: edgeTypeName }))
    )
  }, [edgeTypeName, setEdges])

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      lastFlowPosRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    },
    [screenToFlowPosition],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (pastStates.length > 0) undo()
      } else if (
        (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault()
        if (futureStates.length > 0) redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedNodeId) copyNodes([selectedNodeId])
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard.length > 0) pasteNodes(lastFlowPosRef.current)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId, clipboard, copyNodes, pasteNodes, undo, redo, pastStates.length, futureStates.length])

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

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
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
      // 有节点位置变化时清除 waypoints（仅在精确路由模式下）
      const hasDrag = changes.some((c) => c.type === 'position' && c.dragging)
      if (hasDrag && edgeStyle === 'routed' && !waypointsClearedRef.current) {
        waypointsClearedRef.current = true
        clearEdgeWaypoints()
      }
      if (!hasDrag) waypointsClearedRef.current = false

      const removedIds = changes
        .filter((c): c is NodeChange & { type: 'remove'; id: string } => c.type === 'remove')
        .map((c) => c.id)
      if (removedIds.length > 0 && selectedNodeId && removedIds.includes(selectedNodeId)) {
        selectNode(null)
      }
      onNodesChange(changes)
    },
    [onNodesChange, selectNode, selectedNodeId, edgeStyle, clearEdgeWaypoints],
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => selectNode(node.id),
    [selectNode],
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
    closeMenu()
  }, [selectNode, closeMenu])

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      selectNode(node.id)
      setMenu({
        x: event.clientX,
        y: event.clientY,
        flowPos: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        nodeId: node.id,
      })
    },
    [selectNode, screenToFlowPosition],
  )

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      const e = event as React.MouseEvent
      setMenu({
        x: e.clientX,
        y: e.clientY,
        flowPos: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      })
    },
    [screenToFlowPosition],
  )

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

  const menuItems = menu
    ? menu.nodeId
      ? [
          { label: '复制节点', icon: '⎘', onClick: () => copyNodes([menu.nodeId!]) },
          { label: '---', icon: '', onClick: () => {} },
          { label: '删除节点', icon: '🗑', danger: true, onClick: () => deleteNodes([menu.nodeId!]) },
        ]
      : [
          {
            label: clipboard.length > 0 ? `粘贴节点 (${clipboard.length})` : '粘贴节点',
            icon: '📋',
            disabled: clipboard.length === 0,
            onClick: () => pasteNodes(menu.flowPos),
          },
          { label: '---', icon: '', onClick: () => {} },
          ...operatorRegistry.map((op) => ({
            label: op.label,
            icon: categoryIcon[op.category as NodeCategory] ?? '◆',
            onClick: () => {
              const meta = getOperatorMeta(op.type)
              if (!meta) return
              const newNode: Node<FlowNodeData> = {
                id: `node_${++nodeIdCounter}_${Date.now()}`,
                type: 'operator',
                position: menu.flowPos,
                data: {
                  label: meta.label,
                  category: meta.category,
                  operatorType: meta.type,
                  config: structuredClone(meta.defaultConfig),
                },
              }
              addNode(newNode)
            },
          })),
        ]
    : []

  return (
    <div className="flex-1 h-full" onMouseMove={onMouseMove}>
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
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        isValidConnection={isValidConnection}
        selectionOnDrag={selectionOnDrag}
        panOnDrag={selectionOnDrag ? false : true}
        selectionMode={SelectionMode.Partial}
        edgesFocusable
        edgesReconnectable
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-gray-50"
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} className="!bg-white !border-gray-200" />
      </ReactFlow>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />
      )}

      {/* 数据预览弹窗：渲染在 React Flow 节点树之外，避免内部 state 变化引发画布重绘 */}
      {previewNodeId && (
        <DataPreviewModal
          title={(() => {
            const n = nodes.find((nd) => nd.id === previewNodeId)
            const d = n?.data as FlowNodeData | undefined
            return d?.customName || d?.label || previewNodeId
          })()}
          outputTable={outputMap[previewNodeId]}
          previewTable={previewMap[previewNodeId]}
          inputTable={inputPreviewMap[previewNodeId]}
          totalRows={previewTotals[previewNodeId]}
          onClose={() => setPreviewNodeId(null)}
        />
      )}
    </div>
  )
}
