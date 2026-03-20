import { useRef, useCallback, useState } from 'react'
import { useFlowStore } from '@/store/useFlowStore'
import type { FlowNodeData, ExcelInputConfig, ExcelOutputConfig, EngineRequest, EngineResponse, SerializedNode, SerializedEdge } from '@/types'
import { NodeCategory } from '@/types'
import { parseExcelFile } from '@/utils/excelUtils'
import { exportToExcel, exportWithSplit } from '@/utils/excelUtils'

export function SimpleModePanel() {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const inputDataMap = useFlowStore((s) => s.inputDataMap)
  const outputMap = useFlowStore((s) => s.outputMap)
  const setInputData = useFlowStore((s) => s.setInputData)
  const setExcelSheets = useFlowStore((s) => s.setExcelSheets)
  const excelSheetsMap = useFlowStore((s) => s.excelSheetsMap)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const setExecutionResults = useFlowStore((s) => s.setExecutionResults)
  const setNodeStatus = useFlowStore((s) => s.setNodeStatus)
  const clearNodeStatuses = useFlowStore((s) => s.clearNodeStatuses)
  const nodeStatusMap = useFlowStore((s) => s.nodeStatusMap)
  const isExecuting = useFlowStore((s) => s.isExecuting)
  const setIsExecuting = useFlowStore((s) => s.setIsExecuting)
  const setViewMode = useFlowStore((s) => s.setViewMode)

  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  const inputNodes = nodes.filter(
    (n) => (n.data as FlowNodeData).category === NodeCategory.Input,
  )
  const outputNodes = nodes.filter(
    (n) => (n.data as FlowNodeData).category === NodeCategory.Output,
  )

  // 为每个 input 节点提供一个独立的 file ref
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleFileChange = useCallback(
    async (nodeId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setLocalErrors((prev) => ({ ...prev, [nodeId]: '' }))
      try {
        const sheets = await parseExcelFile(file)
        setExcelSheets(nodeId, sheets)
        const nodeData = nodes.find((n) => n.id === nodeId)?.data as FlowNodeData
        const config = (nodeData?.config ?? {}) as ExcelInputConfig
        const names = Object.keys(sheets)
        const targetSheet =
          config.sheetName && sheets[config.sheetName] ? config.sheetName : names[0]
        if (targetSheet && sheets[targetSheet]) {
          updateNodeData(nodeId, {
            config: { ...config, sheetName: targetSheet, fileName: file.name, selectedColumns: undefined },
          })
          setInputData(nodeId, sheets[targetSheet])
        }
      } catch {
        setLocalErrors((prev) => ({ ...prev, [nodeId]: '文件解析失败，请确认是 Excel 格式' }))
      }
      e.target.value = ''
    },
    [nodes, setExcelSheets, setInputData, updateNodeData],
  )

  const handleSheetChange = useCallback(
    (nodeId: string, sheetName: string) => {
      const allSheets = excelSheetsMap[nodeId]
      if (!allSheets || !allSheets[sheetName]) return
      const nodeData = nodes.find((n) => n.id === nodeId)?.data as FlowNodeData
      const config = (nodeData?.config ?? {}) as ExcelInputConfig
      updateNodeData(nodeId, {
        config: { ...config, sheetName, selectedColumns: undefined },
      })
      setInputData(nodeId, allSheets[sheetName])
    },
    [nodes, excelSheetsMap, updateNodeData, setInputData],
  )

  const handleExecute = useCallback(() => {
    if (nodes.length === 0) return
    setIsExecuting(true)
    clearNodeStatuses()

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

    const worker = new Worker(new URL('@/engine/computeWorker.ts', import.meta.url), {
      type: 'module',
    })
    worker.postMessage(request)
    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const msg = event.data
      if (msg.type === 'result') {
        setExecutionResults(
          msg.previews ?? {},
          msg.inputPreviews ?? {},
          msg.outputs ?? {},
          msg.edgeRowCounts,
          msg.previewTotals,
        )
        worker.terminate()
      } else if (msg.type === 'progress' && msg.progress) {
        const s =
          msg.progress.status === 'running'
            ? 'running'
            : msg.progress.status === 'error'
              ? 'error'
              : 'success'
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
  }, [
    nodes,
    edges,
    inputDataMap,
    setIsExecuting,
    setExecutionResults,
    setNodeStatus,
    clearNodeStatuses,
  ])

  const handleDownload = useCallback(
    (nodeId: string) => {
      const data = outputMap[nodeId]
      if (!data) return
      const node = nodes.find((n) => n.id === nodeId)
      const cfg = node
        ? ((node.data as FlowNodeData).config as ExcelOutputConfig)
        : null
      const fileName = cfg?.fileName || 'result.xlsx'
      const sheetName = cfg?.sheetName || 'Sheet1'
      const splitCols = cfg?.splitByColumns?.length ? cfg.splitByColumns : null
      if (splitCols) {
        exportWithSplit(data, splitCols, cfg?.splitMode ?? 'sheets', sheetName, fileName)
      } else {
        exportToExcel({ [sheetName]: data }, fileName)
      }
    },
    [outputMap, nodes],
  )

  const allInputsReady = inputNodes.every((n) => {
    const d = inputDataMap[n.id]
    return d && d.rows.length > 0
  })

  const hasResults = outputNodes.some((n) => outputMap[n.id])

  // 是否所有 output 节点都成功
  const allOutputsOk = outputNodes.length > 0 && outputNodes.every((n) => {
    const entry = nodeStatusMap[n.id]
    return entry?.status === 'success'
  })

  const getNodeLabel = (n: (typeof nodes)[0]) => {
    const d = n.data as FlowNodeData
    return d.label || d.operatorType || n.id
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-auto">
      {/* 顶部 Banner */}
      <div className="flex items-center justify-between px-6 py-3 bg-indigo-600 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-sm font-semibold">简洁执行模式</p>
            <p className="text-xs text-indigo-200">上传数据文件，一键执行，下载结果</p>
          </div>
        </div>
        <button
          onClick={() => setViewMode('design')}
          className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
        >
          ↩ 返回设计视图
        </button>
      </div>

      {/* 流程卡片区 */}
      <div className="flex-1 flex flex-col items-center justify-start gap-6 px-8 py-8 max-w-3xl w-full mx-auto">

        {/* 输入节点区 */}
        <section className="w-full">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            📂 第一步：上传数据文件
          </h2>
          {inputNodes.length === 0 ? (
            <div className="text-sm text-gray-400 bg-white rounded-lg border border-dashed border-gray-200 p-6 text-center">
              当前模板没有输入节点
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {inputNodes.map((node) => {
                const data = node.data as FlowNodeData
                const cfg = (data.config ?? {}) as ExcelInputConfig
                const uploaded = inputDataMap[node.id]
                const allSheets = excelSheetsMap[node.id]
                const sheetNames = allSheets ? Object.keys(allSheets) : []
                const status = nodeStatusMap[node.id]
                const isError = status?.status === 'error'
                const isOk = status?.status === 'success'

                return (
                  <div
                    key={node.id}
                    className={[
                      'bg-white rounded-xl border-2 p-5 transition-colors',
                      isError
                        ? 'border-red-300'
                        : isOk
                          ? 'border-green-300'
                          : uploaded
                            ? 'border-indigo-200'
                            : 'border-gray-200',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {getNodeLabel(node)}
                          {data.note && (
                            <span className="ml-2 text-xs text-gray-400 font-normal">{data.note}</span>
                          )}
                        </p>
                        {uploaded ? (
                          <p className="text-xs text-green-600 mt-1">
                            ✅ {cfg.fileName ?? '已上传'} &nbsp;·&nbsp; {uploaded.columns.length} 列 / {uploaded.rows.length.toLocaleString()} 行
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">尚未上传文件</p>
                        )}

                        {localErrors[node.id] && (
                          <p className="text-xs text-red-500 mt-1">{localErrors[node.id]}</p>
                        )}

                        {/* Sheet 切换 */}
                        {sheetNames.length > 1 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs text-gray-500">Sheet：</span>
                            {sheetNames.map((s) => (
                              <button
                                key={s}
                                onClick={() => handleSheetChange(node.id, s)}
                                className={[
                                  'px-2 py-0.5 text-xs rounded transition-colors',
                                  cfg.sheetName === s
                                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                                ].join(' ')}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => fileRefs.current[node.id]?.click()}
                        className="flex-shrink-0 px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        {uploaded ? '重新上传' : '选择文件'}
                      </button>
                    </div>

                    <input
                      ref={(el) => { fileRefs.current[node.id] = el }}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => handleFileChange(node.id, e)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 执行按钮 */}
        <section className="w-full flex flex-col items-center gap-2">
          <div className="w-px h-6 bg-gray-300" />
          <button
            onClick={handleExecute}
            disabled={isExecuting || !allInputsReady}
            title={!allInputsReady ? '请先上传所有输入文件' : undefined}
            className={[
              'px-8 py-3 text-sm font-semibold rounded-xl transition-all',
              isExecuting || !allInputsReady
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-95',
            ].join(' ')}
          >
            {isExecuting ? '⏳ 执行中...' : '▶ 执行流程'}
          </button>
          {!allInputsReady && inputNodes.length > 0 && (
            <p className="text-xs text-amber-500">请先上传所有输入文件</p>
          )}
          <div className="w-px h-6 bg-gray-300" />
        </section>

        {/* 输出节点区 */}
        <section className="w-full">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            📥 第三步：下载结果
          </h2>
          {outputNodes.length === 0 ? (
            <div className="text-sm text-gray-400 bg-white rounded-lg border border-dashed border-gray-200 p-6 text-center">
              当前模板没有输出节点
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {outputNodes.map((node) => {
                const data = node.data as FlowNodeData
                const cfg = (data.config ?? {}) as ExcelOutputConfig
                const result = outputMap[node.id]
                const status = nodeStatusMap[node.id]
                const isError = status?.status === 'error'
                const isRunning = status?.status === 'running'
                const isOk = status?.status === 'success'

                return (
                  <div
                    key={node.id}
                    className={[
                      'bg-white rounded-xl border-2 p-5 transition-colors',
                      isError
                        ? 'border-red-300'
                        : isOk
                          ? 'border-green-300'
                          : 'border-gray-200',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {getNodeLabel(node)}
                          {data.note && (
                            <span className="ml-2 text-xs text-gray-400 font-normal">{data.note}</span>
                          )}
                        </p>
                        {isRunning && (
                          <p className="text-xs text-indigo-500 mt-1">⏳ 计算中...</p>
                        )}
                        {isError && (
                          <p className="text-xs text-red-500 mt-1">❌ {status?.errorMsg ?? '执行出错'}</p>
                        )}
                        {result && (
                          <p className="text-xs text-green-600 mt-1">
                            ✅ {result.columns.length} 列 / {result.rows.length.toLocaleString()} 行
                            {cfg.fileName && <span className="text-gray-400"> → {cfg.fileName}</span>}
                          </p>
                        )}
                        {!result && !isRunning && !isError && (
                          <p className="text-xs text-gray-400 mt-1">执行后可下载</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleDownload(node.id)}
                        disabled={!result}
                        className={[
                          'flex-shrink-0 px-4 py-2 text-xs font-medium rounded-lg transition-colors',
                          result
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                        ].join(' ')}
                      >
                        ↓ 下载
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 完成提示 */}
        {allOutputsOk && hasResults && (
          <div className="w-full bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-sm text-green-700 font-medium">✅ 执行完成！请下载结果文件。</p>
          </div>
        )}
      </div>
    </div>
  )
}
