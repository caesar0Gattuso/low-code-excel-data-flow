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

export interface FlowState {
  nodes: Node<FlowNodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  /** ExcelInput 节点 id -> 已加载的数据 */
  inputDataMap: Record<string, DataTable>
  /** ExcelInput 节点 id -> 该文件的所有 Sheet 数据 */
  excelSheetsMap: Record<string, Record<string, DataTable>>
  /** 执行后，每个节点的预览 */
  previewMap: Record<string, DataTable>
  /** 执行后，输出节点的最终结果 */
  outputMap: Record<string, DataTable>
  isExecuting: boolean

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
  setExecutionResults: (previews: Record<string, DataTable>, outputs: Record<string, DataTable>) => void
  setIsExecuting: (v: boolean) => void
  clearResults: () => void
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
      outputMap: {},
      isExecuting: false,

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
      setExecutionResults: (previews, outputs) => set({ previewMap: previews, outputMap: outputs, isExecuting: false }),
      setIsExecuting: (v) => set({ isExecuting: v }),
      clearResults: () => set({ previewMap: {}, outputMap: {} }),
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
