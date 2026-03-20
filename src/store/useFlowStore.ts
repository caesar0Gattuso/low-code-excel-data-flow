import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import type { FlowNodeData, DataTable } from '@/types'

type ClipboardNode = {
  type: string
  data: FlowNodeData
  position: { x: number; y: number }
}

export type EdgeStyle = 'bezier' | 'smoothstep' | 'routed'

export interface FlowState {
  nodes: Node<FlowNodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  /** ExcelInput 节点 id -> 已加载的数据 */
  inputDataMap: Record<string, DataTable>
  /** ExcelInput 节点 id -> 该文件的所有 Sheet 数据 */
  excelSheetsMap: Record<string, Record<string, DataTable>>
  /** 执行后，每个节点的输出预览 */
  previewMap: Record<string, DataTable>
  /** 执行后，每个节点的输入预览 */
  inputPreviewMap: Record<string, DataTable>
  /** 执行后，输出节点的最终结果 */
  outputMap: Record<string, DataTable>
  isExecuting: boolean
  /** 内存剪贴板（不持久化） */
  clipboard: ClipboardNode[]
  /** 连线渲染模式 */
  edgeStyle: EdgeStyle

  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setNodes: (nodes: Node<FlowNodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (node: Node<FlowNodeData>) => void
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void
  selectNode: (nodeId: string | null) => void
  setInputData: (nodeId: string, data: DataTable) => void
  setExcelSheets: (nodeId: string, sheets: Record<string, DataTable>) => void
  setExecutionResults: (previews: Record<string, DataTable>, inputPreviews: Record<string, DataTable>, outputs: Record<string, DataTable>) => void
  setIsExecuting: (v: boolean) => void
  clearResults: () => void
  /** 将指定 id 的节点写入剪贴板 */
  copyNodes: (nodeIds: string[]) => void
  /** 在指定画布坐标粘贴剪贴板节点 */
  pasteNodes: (position: { x: number; y: number }) => void
  /** 删除指定 id 的节点 */
  deleteNodes: (nodeIds: string[]) => void
  /** 设置连线渲染模式 */
  setEdgeStyle: (style: EdgeStyle) => void
  /** 清除所有边的 waypoints（节点手动移动后调用） */
  clearEdgeWaypoints: () => void
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      inputDataMap: {},
      excelSheetsMap: {},
      previewMap: {},
      inputPreviewMap: {},
      outputMap: {},
      isExecuting: false,
      clipboard: [],
      edgeStyle: 'bezier',

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) as Node<FlowNodeData>[] })
      },
      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) })
      },
      onConnect: (connection) => {
        const newEdge: Edge = {
          ...connection,
          id: `edge_${Date.now()}`,
          selectable: true,
          style: { strokeWidth: 2, stroke: '#94a3b8' },
        }
        set({ edges: addEdge(newEdge, get().edges) })
      },
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
      updateNodeData: (nodeId, partial) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...partial } as FlowNodeData } : n,
          ),
        })),
      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
      setInputData: (nodeId, data) =>
        set((s) => ({ inputDataMap: { ...s.inputDataMap, [nodeId]: data } })),
      setExcelSheets: (nodeId, sheets) =>
        set((s) => ({ excelSheetsMap: { ...s.excelSheetsMap, [nodeId]: sheets } })),
      setExecutionResults: (previews, inputPreviews, outputs) => set({ previewMap: previews, inputPreviewMap: inputPreviews, outputMap: outputs, isExecuting: false }),
      setIsExecuting: (v) => set({ isExecuting: v }),
      clearResults: () => set({ previewMap: {}, inputPreviewMap: {}, outputMap: {} }),

      copyNodes: (nodeIds) => {
        const { nodes } = get()
        const targets = nodes.filter((n) => nodeIds.includes(n.id))
        if (targets.length === 0) return
        set({
          clipboard: targets.map((n) => ({
            type: n.type ?? 'operator',
            data: structuredClone(n.data),
            position: { ...n.position },
          })),
        })
      },

      pasteNodes: (pastePos) => {
        const { clipboard, nodes } = get()
        if (clipboard.length === 0) return

        // 以第一个节点为锚点，其余保持相对偏移
        const anchor = clipboard[0].position
        const timestamp = Date.now()
        const newNodes: Node<FlowNodeData>[] = clipboard.map((item, idx) => ({
          id: `node_copy_${timestamp}_${idx}`,
          type: item.type,
          position: {
            x: pastePos.x + (item.position.x - anchor.x),
            y: pastePos.y + (item.position.y - anchor.y),
          },
          data: structuredClone(item.data),
        }))

        set({ nodes: [...nodes, ...newNodes] })
      },

      deleteNodes: (nodeIds) => {
        const { nodes, edges, selectedNodeId } = get()
        const next = nodes.filter((n) => !nodeIds.includes(n.id))
        const nextEdges = edges.filter(
          (e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target),
        )
        set({
          nodes: next,
          edges: nextEdges,
          selectedNodeId: selectedNodeId && nodeIds.includes(selectedNodeId) ? null : selectedNodeId,
        })
      },

      setEdgeStyle: (style) => set({ edgeStyle: style }),

      clearEdgeWaypoints: () => {
        set((s) => ({
          edges: s.edges.map((e) => ({
            ...e,
            data: { ...((e.data as Record<string, unknown>) ?? {}), waypoints: undefined },
          })),
        }))
      },
    }),
    {
      name: 'excel-data-flow-store',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
    },
  ),
)
