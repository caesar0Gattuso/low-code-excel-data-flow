import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { temporal } from 'zundo'
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

export type NodeStatus = 'idle' | 'running' | 'success' | 'error'

export interface NodeStatusEntry {
  status: NodeStatus
  errorMsg?: string
}

export interface FlowState {
  nodes: Node<FlowNodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  inputDataMap: Record<string, DataTable>
  excelSheetsMap: Record<string, Record<string, DataTable>>
  previewMap: Record<string, DataTable>
  inputPreviewMap: Record<string, DataTable>
  outputMap: Record<string, DataTable>
  isExecuting: boolean
  clipboard: ClipboardNode[]
  edgeStyle: EdgeStyle
  /** 每个节点的执行状态 */
  nodeStatusMap: Record<string, NodeStatusEntry>
  /** 每条边流过的数据行数（执行后） */
  edgeRowCountMap: Record<string, number>
  /** 当前打开数据预览弹窗的节点 id（null 表示关闭） */
  previewNodeId: string | null
  /** 每个节点输出的真实总行数（previewMap 只缓存 200 行） */
  previewTotals: Record<string, number>
  /** 画布拖拽模式：true = 框选，false = 平移 */
  selectionOnDrag: boolean
  /** 当前视图模式：design = 完整画布，simple = 简洁执行模式 */
  viewMode: 'design' | 'simple'

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
  setExecutionResults: (
    previews: Record<string, DataTable>,
    inputPreviews: Record<string, DataTable>,
    outputs: Record<string, DataTable>,
    edgeRowCounts?: Record<string, number>,
    previewTotals?: Record<string, number>,
  ) => void
  setIsExecuting: (v: boolean) => void
  clearResults: () => void
  copyNodes: (nodeIds: string[]) => void
  pasteNodes: (position: { x: number; y: number }) => void
  deleteNodes: (nodeIds: string[]) => void
  setEdgeStyle: (style: EdgeStyle) => void
  clearEdgeWaypoints: () => void
  setNodeStatus: (nodeId: string, status: NodeStatus, errorMsg?: string) => void
  clearNodeStatuses: () => void
  setSelectionOnDrag: (v: boolean) => void
  setViewMode: (mode: 'design' | 'simple') => void
  setPreviewNodeId: (id: string | null) => void
}

export const useFlowStore = create<FlowState>()(
  temporal(
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
        nodeStatusMap: {},
        edgeRowCountMap: {},
        previewTotals: {},
        previewNodeId: null,
        selectionOnDrag: false,
        viewMode: 'design',

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
        setExecutionResults: (previews, inputPreviews, outputs, edgeRowCounts, previewTotals) =>
          set({
            previewMap: previews,
            inputPreviewMap: inputPreviews,
            outputMap: outputs,
            edgeRowCountMap: edgeRowCounts ?? {},
            previewTotals: previewTotals ?? {},
            isExecuting: false,
          }),
        setIsExecuting: (v) => set({ isExecuting: v }),
        clearResults: () => set({ previewMap: {}, inputPreviewMap: {}, outputMap: {}, edgeRowCountMap: {}, nodeStatusMap: {}, previewTotals: {} }),

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

        setNodeStatus: (nodeId, status, errorMsg) =>
          set((s) => ({ nodeStatusMap: { ...s.nodeStatusMap, [nodeId]: { status, errorMsg } } })),

        clearNodeStatuses: () => set({ nodeStatusMap: {} }),

        setSelectionOnDrag: (v) => set({ selectionOnDrag: v }),

        setViewMode: (mode) => set({ viewMode: mode }),

        setPreviewNodeId: (id) => set({ previewNodeId: id }),
      }),
      {
        name: 'excel-data-flow-store',
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
        }),
      },
    ),
    {
      // 只对 nodes 和 edges 做历史快照
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      // 节流 300ms：拖动节点时合并快照，避免每帧都记录
      handleSet: (handleSet) => {
        let timer: ReturnType<typeof setTimeout> | null = null
        return (state) => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            handleSet(state)
            timer = null
          }, 300)
        }
      },
      limit: 50,
    },
  ),
)
