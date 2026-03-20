import { useFlowStore } from '@/store/useFlowStore'
import type { EdgeStyle } from '@/store/useFlowStore'
import { useTemporalStore } from '@/store/useTemporalStore'
import type { EngineRequest, EngineResponse, TemplateData, SerializedNode, SerializedEdge, FlowNodeData, ExcelOutputConfig } from '@/types'
import { exportTemplate, importTemplate } from '@/utils/templateIO'
import { exportToExcel, exportWithSplit } from '@/utils/excelUtils'
import { calcAutoLayout, animateToLayout } from '@/utils/autoLayout'
import { alignNodes, type AlignDirection } from '@/utils/alignNodes'
import { useRef, useCallback, useState, useEffect } from 'react'
import type { Node } from '@xyflow/react'
import { HelpDialog } from './HelpDialog'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)

// ─── 导出模板弹窗 ─────────────────────────────────────────────
function ExportDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (mode: 'design' | 'simple') => void
}) {
  const [selected, setSelected] = useState<'design' | 'simple'>('design')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">导出模板</h2>
          <p className="text-xs text-gray-500 mt-1">选择接收者打开此模板时默认进入的视图模式</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* 设计模式选项 */}
          <button
            onClick={() => setSelected('design')}
            className={[
              'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
              selected === 'design'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <span className="text-2xl mt-0.5">🎨</span>
            <div>
              <p className={['text-sm font-semibold', selected === 'design' ? 'text-indigo-700' : 'text-gray-700'].join(' ')}>
                设计视图（默认）
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                接收者可以查看完整的流程图，适合技术人员或需要二次修改的场景
              </p>
            </div>
            <span className={['ml-auto mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
              selected === 'design' ? 'border-indigo-500' : 'border-gray-300'].join(' ')}>
              {selected === 'design' && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
            </span>
          </button>

          {/* 简洁模式选项 */}
          <button
            onClick={() => setSelected('simple')}
            className={[
              'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
              selected === 'simple'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <span className="text-2xl mt-0.5">⚡</span>
            <div>
              <p className={['text-sm font-semibold', selected === 'simple' ? 'text-amber-700' : 'text-gray-700'].join(' ')}>
                简洁执行模式
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                隐藏流程图，只展示文件上传和下载，适合最终用户日常使用
              </p>
            </div>
            <span className={['ml-auto mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
              selected === 'simple' ? 'border-amber-500' : 'border-gray-300'].join(' ')}>
              {selected === 'simple' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
            </span>
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className={[
              'px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              selected === 'simple'
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-indigo-600 hover:bg-indigo-700',
            ].join(' ')}
          >
            确认导出
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 主工具栏 ────────────────────────────────────────────────
export function Toolbar() {
  const [helpOpen, setHelpOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const { undo, redo, pastStates, futureStates } = useTemporalStore()
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const inputDataMap = useFlowStore((s) => s.inputDataMap)
  const outputMap = useFlowStore((s) => s.outputMap)
  const isExecuting = useFlowStore((s) => s.isExecuting)
  const setNodes = useFlowStore((s) => s.setNodes)
  const setEdges = useFlowStore((s) => s.setEdges)
  const setIsExecuting = useFlowStore((s) => s.setIsExecuting)
  const setNodeStatus = useFlowStore((s) => s.setNodeStatus)
  const clearNodeStatuses = useFlowStore((s) => s.clearNodeStatuses)
  const setExecutionResults = useFlowStore((s) => s.setExecutionResults)
  const edgeStyle = useFlowStore((s) => s.edgeStyle)
  const setEdgeStyle = useFlowStore((s) => s.setEdgeStyle)
  const selectionOnDrag = useFlowStore((s) => s.selectionOnDrag)
  const setSelectionOnDrag = useFlowStore((s) => s.setSelectionOnDrag)
  const viewMode = useFlowStore((s) => s.viewMode)
  const setViewMode = useFlowStore((s) => s.setViewMode)
  const importRef = useRef<HTMLInputElement>(null)

  // 选中节点数量（2+ 才显示对齐条）
  const selectedNodes = nodes.filter((n) => n.selected)
  const hasMultiSelect = selectedNodes.length >= 2

  const handleAlign = useCallback(
    (dir: AlignDirection) => {
      setNodes(alignNodes(nodes, dir))
    },
    [nodes, setNodes],
  )

  const handleExecute = useCallback(() => {
    if (nodes.length === 0) return

    setIsExecuting(true)
    clearNodeStatuses()
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
        setExecutionResults(msg.previews ?? {}, msg.inputPreviews ?? {}, msg.outputs ?? {}, msg.edgeRowCounts, msg.previewTotals)
        worker.terminate()
      } else if (msg.type === 'progress' && msg.progress) {
        const s = msg.progress.status === 'running' ? 'running'
          : msg.progress.status === 'error' ? 'error' : 'success'
        setNodeStatus(msg.progress.nodeId, s, msg.progress.errorMsg)
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
  }, [nodes, edges, inputDataMap, setIsExecuting, setExecutionResults, setNodeStatus, clearNodeStatuses])

  const handleExportConfirm = useCallback((mode: 'design' | 'simple') => {
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
      defaultMode: mode,
    }
    exportTemplate(template)
    setExportDialogOpen(false)
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
        if (template.defaultMode) {
          setViewMode(template.defaultMode)
        }
      } catch (err) {
        alert('导入失败: ' + (err instanceof Error ? err.message : String(err)))
      }
      e.target.value = ''
    },
    [setNodes, setEdges, setViewMode],
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
          exportWithSplit(data, splitCols, 'files', sheetName, cfg.fileName || 'final_result.xlsx')
        } else {
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

    animateToLayout(nodes, nodePositions, setNodes as (nodes: Node[]) => void)
  }, [nodes, edges, edgeStyle, setNodes, setEdges])

  // ⌘/Ctrl + Enter 触发执行
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) return
      e.preventDefault()
      handleExecute()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleExecute])

  // ─── 公共部分：两种模式都有 ───────────────────────────────
  const commonRight = (
    <>
      <div className="flex-1" />
      <button
        onClick={() => setViewMode(viewMode === 'design' ? 'simple' : 'design')}
        title={viewMode === 'design' ? '切换到简洁执行模式' : '返回完整设计视图'}
        className={[
          'px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap',
          viewMode === 'simple'
            ? 'bg-amber-500 text-white'
            : 'text-gray-600 bg-gray-100 hover:bg-gray-200',
        ].join(' ')}
      >
        {viewMode === 'simple' ? '🎨 设计视图' : '⚡ 简洁模式'}
      </button>
      <div className="h-5 w-px bg-gray-300 flex-shrink-0" />
      <button
        onClick={() => setExportDialogOpen(true)}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors whitespace-nowrap"
      >
        导出模板
      </button>
      <button
        onClick={() => importRef.current?.click()}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors whitespace-nowrap"
      >
        导入模板
      </button>
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportTemplate} />
      <button
        onClick={() => setHelpOpen(true)}
        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors whitespace-nowrap"
      >
        ? 帮助
      </button>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onConfirm={handleExportConfirm}
      />
    </>
  )

  // ─── 简洁模式工具栏 ──────────────────────────────────────
  if (viewMode === 'simple') {
    return (
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
        <h1 className="text-sm font-bold text-gray-800 whitespace-nowrap">Excel 数据流结算引擎</h1>
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full whitespace-nowrap">
          简洁模式
        </span>
        {commonRight}
      </header>
    )
  }

  // ─── 设计模式工具栏 ──────────────────────────────────────
  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 overflow-x-auto">
      <h1 className="text-sm font-bold text-gray-800 mr-4 whitespace-nowrap">Excel 数据流结算引擎</h1>
      <div className="h-5 w-px bg-gray-300 flex-shrink-0" />

      {/* 撤销 / 重做 */}
      <button
        onClick={() => undo()}
        disabled={pastStates.length === 0}
        title="撤销 (Ctrl+Z)"
        className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        ↩ 撤销
      </button>
      <button
        onClick={() => redo()}
        disabled={futureStates.length === 0}
        title="重做 (Ctrl+Y)"
        className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        ↪ 重做
      </button>
      <div className="h-5 w-px bg-gray-300 flex-shrink-0" />

      <button
        onClick={handleExecute}
        disabled={isExecuting}
        title={`执行流程 (${isMac ? '⌘' : 'Ctrl'}+Enter)`}
        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {isExecuting ? '执行中...' : '▶ 执行'}
      </button>

      <button
        onClick={handleAutoLayout}
        disabled={nodes.length === 0}
        title="自动整理节点位置"
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        ⊞ 整理布局
      </button>

      {/* 框选 / 拖拽 模式切换 */}
      <button
        onClick={() => setSelectionOnDrag(!selectionOnDrag)}
        title={selectionOnDrag ? '当前：框选模式（点击切回拖拽）\nShift+拖拽 也可随时框选' : '当前：拖拽模式（点击切换为框选）\nShift+拖拽 也可随时框选'}
        className={[
          'px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap',
          selectionOnDrag
            ? 'bg-indigo-600 text-white'
            : 'text-gray-600 bg-gray-100 hover:bg-gray-200',
        ].join(' ')}
      >
        {selectionOnDrag ? '⬚ 框选' : '✋ 拖拽'}
      </button>

      {/* 对齐工具条：2+ 节点被选中时显示 */}
      {hasMultiSelect && (
        <>
          <div className="h-5 w-px bg-gray-300 flex-shrink-0" />
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-gray-400 mr-1">对齐</span>
            {(
              [
                { dir: 'left',    title: '左对齐' },
                { dir: 'centerH', title: '水平居中' },
                { dir: 'right',   title: '右对齐' },
                { dir: 'top',     title: '上对齐' },
                { dir: 'centerV', title: '垂直居中' },
                { dir: 'bottom',  title: '下对齐' },
              ] as { dir: AlignDirection; title: string }[]
            ).map(({ dir, title }) => (
              <button
                key={dir}
                onClick={() => handleAlign(dir)}
                title={title}
                className="px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors"
              >
                {title}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 连线模式三段式切换 */}
      <div className="flex items-center rounded border border-gray-200 overflow-hidden text-[11px] font-medium flex-shrink-0">
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
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors whitespace-nowrap"
      >
        合并下载
      </button>

      <button
        onClick={handleSeparateDownload}
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors whitespace-nowrap"
      >
        全部单独下载
      </button>

      {commonRight}
    </header>
  )
}
