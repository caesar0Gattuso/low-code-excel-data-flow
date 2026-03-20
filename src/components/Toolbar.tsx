import { useFlowStore } from '@/store/useFlowStore'
import type { EdgeStyle } from '@/store/useFlowStore'
import type { EngineRequest, EngineResponse, TemplateData, SerializedNode, SerializedEdge, FlowNodeData, ExcelOutputConfig } from '@/types'
import { exportTemplate, importTemplate } from '@/utils/templateIO'
import { exportToExcel, exportWithSplit } from '@/utils/excelUtils'
import { calcAutoLayout, animateToLayout } from '@/utils/autoLayout'
import { useRef, useCallback, useState } from 'react'
import type { Node } from '@xyflow/react'
import { HelpDialog } from './HelpDialog'

export function Toolbar() {
  const [helpOpen, setHelpOpen] = useState(false)
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const inputDataMap = useFlowStore((s) => s.inputDataMap)
  const outputMap = useFlowStore((s) => s.outputMap)
  const isExecuting = useFlowStore((s) => s.isExecuting)
  const setNodes = useFlowStore((s) => s.setNodes)
  const setEdges = useFlowStore((s) => s.setEdges)
  const setIsExecuting = useFlowStore((s) => s.setIsExecuting)
  const setExecutionResults = useFlowStore((s) => s.setExecutionResults)
  const edgeStyle = useFlowStore((s) => s.edgeStyle)
  const setEdgeStyle = useFlowStore((s) => s.setEdgeStyle)
  const importRef = useRef<HTMLInputElement>(null)

  const handleExecute = useCallback(() => {
    if (nodes.length === 0) return

    setIsExecuting(true)
    const worker = new Worker(new URL('@/engine/computeWorker.ts', import.meta.url), { type: 'module' })

    const serializedNodes: SerializedNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'operator',
      position: n.position,
      data: n.data as FlowNodeData,
    }))

    const serializedEdges: SerializedEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }))

    const request: EngineRequest = {
      type: 'execute',
      nodes: serializedNodes,
      edges: serializedEdges,
      inputData: inputDataMap,
    }

    worker.postMessage(request)

    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const msg = event.data
      if (msg.type === 'result') {
        setExecutionResults(msg.previews ?? {}, msg.inputPreviews ?? {}, msg.outputs ?? {})
        worker.terminate()
      } else if (msg.type === 'error') {
        alert('执行出错: ' + msg.error)
        setIsExecuting(false)
        worker.terminate()
      }
    }

    worker.onerror = (err) => {
      alert('Worker 错误: ' + err.message)
      setIsExecuting(false)
      worker.terminate()
    }
  }, [nodes, edges, inputDataMap, setIsExecuting, setExecutionResults])

  const handleExportTemplate = useCallback(() => {
    const template: TemplateData = {
      version: '1.0.0',
      name: `settlement_${new Date().toISOString().slice(0, 10)}`,
      createdAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type ?? 'operator',
        position: n.position,
        data: n.data as FlowNodeData,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    }
    exportTemplate(template)
  }, [nodes, edges])

  const handleImportTemplate = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const template = await importTemplate(file)
        const restoredNodes: Node<FlowNodeData>[] = template.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }))
        setNodes(restoredNodes)
        setEdges(
          template.edges.map((ed) => ({
            id: ed.id,
            source: ed.source,
            target: ed.target,
            sourceHandle: ed.sourceHandle,
            targetHandle: ed.targetHandle,
          })),
        )
      } catch (err) {
        alert('导入失败: ' + (err instanceof Error ? err.message : String(err)))
      }
      e.target.value = ''
    },
    [setNodes, setEdges],
  )

  const handleMergeDownload = useCallback(() => {
    if (Object.keys(outputMap).length === 0) {
      alert('请先执行流程')
      return
    }
    const tables: Record<string, typeof outputMap[string]> = {}
    for (const [nodeId, data] of Object.entries(outputMap)) {
      const node = nodes.find((n) => n.id === nodeId)
      const cfg = node ? (node.data as FlowNodeData).config as ExcelOutputConfig : null
      const sheetName = cfg?.sheetName ?? nodeId
      const splitCols = cfg?.splitByColumns?.length ? cfg.splitByColumns : null

      if (splitCols) {
        if (cfg?.splitMode === 'files') {
          // 多文件模式：在合并下载时单独导出
          exportWithSplit(data, splitCols, 'files', sheetName, cfg.fileName || 'final_result.xlsx')
        } else {
          // sheets 模式：展开到合并文件中
          const validCols = splitCols.filter((c) => data.columns.includes(c))
          if (validCols.length > 0) {
            const groups = new Map<string, typeof data.rows>()
            for (const row of data.rows) {
              const key = validCols.map((c) => String(row[c] ?? '')).join('_')
              if (!groups.has(key)) groups.set(key, [])
              groups.get(key)!.push(row)
            }
            for (const [key, rows] of groups) {
              tables[key.slice(0, 31)] = { columns: data.columns, rows }
            }
          } else {
            tables[sheetName] = data
          }
        }
      } else {
        tables[sheetName] = data
      }
    }
    if (Object.keys(tables).length > 0) {
      exportToExcel(tables, 'final_result.xlsx')
    }
  }, [outputMap, nodes])

  const handleSeparateDownload = useCallback(() => {
    if (Object.keys(outputMap).length === 0) {
      alert('请先执行流程')
      return
    }
    for (const [nodeId, data] of Object.entries(outputMap)) {
      const node = nodes.find((n) => n.id === nodeId)
      const cfg = node ? (node.data as FlowNodeData).config as ExcelOutputConfig : null
      const fileName = cfg?.fileName || 'final_result.xlsx'
      const sheetName = cfg?.sheetName || 'Result'
      const splitCols = cfg?.splitByColumns?.length ? cfg.splitByColumns : null

      if (splitCols) {
        exportWithSplit(data, splitCols, cfg?.splitMode ?? 'sheets', sheetName, fileName)
      } else {
        exportToExcel({ [sheetName]: data }, fileName)
      }
    }
  }, [outputMap, nodes])

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return
    const { nodePositions, edgeWaypoints } = calcAutoLayout(nodes, edges)

    // 先把 waypoints 写入边（不影响动画）
    const edgeType = edgeStyle === 'routed' ? 'routed' : edgeStyle === 'smoothstep' ? 'smoothstep' : 'default'
    const updatedEdges = edges.map((e) => ({
      ...e,
      type: edgeType,
      data: {
        ...((e.data as Record<string, unknown>) ?? {}),
        waypoints: edgeWaypoints[e.id] ?? undefined,
      },
    }))
    setEdges(updatedEdges)

    // 再启动节点位置动画
    animateToLayout(nodes, nodePositions, setNodes)
  }, [nodes, edges, edgeStyle, setNodes, setEdges])

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
      <h1 className="text-sm font-bold text-gray-800 mr-4">Excel 数据流结算引擎</h1>
      <div className="h-5 w-px bg-gray-300" />

      <button
        onClick={handleExecute}
        disabled={isExecuting}
        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExecuting ? '执行中...' : '▶ 执行'}
      </button>

      <button
        onClick={handleAutoLayout}
        disabled={nodes.length === 0}
        title="自动整理节点位置"
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ⊞ 整理布局
      </button>

      {/* 连线模式三段式切换 */}
      <div className="flex items-center rounded border border-gray-200 overflow-hidden text-[11px] font-medium">
        {(
          [
            { key: 'bezier', label: '曲线' },
            { key: 'smoothstep', label: '折线' },
            { key: 'routed', label: '精确路由' },
          ] as { key: EdgeStyle; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setEdgeStyle(key)}
            title={
              key === 'bezier'
                ? '贝塞尔曲线（默认）'
                : key === 'smoothstep'
                  ? '直角折线，减少穿越'
                  : 'Dagre 精确路由，点击「整理布局」后生效'
            }
            className={[
              'px-2.5 py-1.5 transition-colors',
              edgeStyle === key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={handleMergeDownload}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
      >
        合并下载
      </button>

      <button
        onClick={handleSeparateDownload}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
      >
        全部单独下载
      </button>

      <div className="h-5 w-px bg-gray-300" />

      <button
        onClick={handleExportTemplate}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
      >
        导出模板
      </button>

      <button
        onClick={() => importRef.current?.click()}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
      >
        导入模板
      </button>

      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportTemplate} />

      <div className="flex-1" />

      <button
        onClick={() => setHelpOpen(true)}
        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
      >
        ? 帮助
      </button>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  )
}
