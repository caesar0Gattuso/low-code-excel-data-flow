import { useFlowStore } from '@/store/useFlowStore'
import type {
  FlowNodeData,
  TierRuleConfig,
  TierRuleV2Config,
  FormulaConfig,
  FormulaV2Config,
  FilterConfig,
  ConstraintConfig,
  ConditionalAssignConfig,
  ConditionalRule,
  Condition,
  CompareOperator,
  JoinConfig,
  GroupByConfig,
  ExcelInputConfig,
  ExcelOutputConfig,
  TierBracket,
  DataTable,
  SortConfig,
  DeduplicateConfig,
  ColumnOpsConfig,
} from '@/types'
import { parseExcelFile, downloadTierTemplate, exportToExcel, exportWithSplit } from '@/utils/excelUtils'
import { useCallback, useRef, useState } from 'react'

export function PropertiesPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId)
  const nodes = useFlowStore((s) => s.nodes)
  const previewMap = useFlowStore((s) => s.previewMap)
  const inputPreviewMap = useFlowStore((s) => s.inputPreviewMap)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)

  const node = nodes.find((n) => n.id === selectedNodeId)
  const preview = selectedNodeId ? previewMap[selectedNodeId] : undefined
  const inputPreview = selectedNodeId ? inputPreviewMap[selectedNodeId] : undefined

  if (!node) {
    return (
      <aside className="w-72 bg-white border-l border-gray-200 flex items-center justify-center flex-shrink-0">
        <p className="text-sm text-gray-400">选择一个节点以查看属性</p>
      </aside>
    )
  }

  const data = node.data as FlowNodeData

  return (
    <aside className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-700">{data.customName || data.label} 配置</h2>
        <p className="text-[10px] text-gray-400 mt-0.5">{node.id}</p>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">节点名称</label>
          <input
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none"
            value={data.customName ?? ''}
            onChange={(e) => updateNodeData(node.id, { customName: e.target.value || undefined })}
            placeholder={data.label}
          />
          <p className="text-[10px] text-gray-400 mt-0.5">自定义名称，方便在画布上识别</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">节点备注</label>
          <textarea
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none resize-none"
            rows={2}
            value={data.note ?? ''}
            onChange={(e) => updateNodeData(node.id, { note: e.target.value || undefined })}
            placeholder="可选，添加备注说明..."
          />
        </div>

        <ConfigForm nodeId={node.id} data={data} updateNodeData={updateNodeData} />

        {inputPreview && (
          <DataPreviewSection title="输入数据" table={inputPreview} defaultCollapsed />
        )}

        {preview && (
          <DataPreviewSection title="输出数据" table={preview} />
        )}
      </div>
    </aside>
  )
}

function ConfigForm({
  nodeId,
  data,
  updateNodeData,
}: {
  nodeId: string
  data: FlowNodeData
  updateNodeData: (id: string, d: Partial<FlowNodeData>) => void
}) {
  const update = useCallback(
    (config: FlowNodeData['config']) => {
      updateNodeData(nodeId, { config })
    },
    [nodeId, updateNodeData],
  )

  switch (data.operatorType) {
    case 'excelInput':
      return <ExcelInputForm nodeId={nodeId} config={data.config as ExcelInputConfig} onUpdate={update} />
    case 'excelOutput':
      return <ExcelOutputForm nodeId={nodeId} config={data.config as ExcelOutputConfig} onUpdate={update} />
    case 'tierRule':
      return <TierRuleForm config={data.config as TierRuleConfig} onUpdate={update} />
    case 'tierRuleV2':
      return <TierRuleV2Form config={data.config as TierRuleV2Config} onUpdate={update} />
    case 'formula':
      return <FormulaForm config={data.config as FormulaConfig} onUpdate={update} />
    case 'formulaV2':
      return <FormulaV2Form config={data.config as FormulaV2Config} onUpdate={update} />
    case 'filter':
      return <FilterForm config={data.config as FilterConfig} onUpdate={update} />
    case 'constraint':
      return <ConstraintForm config={data.config as ConstraintConfig} onUpdate={update} />
    case 'conditionalAssign':
      return <ConditionalAssignForm config={data.config as ConditionalAssignConfig} onUpdate={update} />
    case 'join':
      return <JoinForm nodeId={nodeId} config={data.config as JoinConfig} onUpdate={update} />
    case 'groupBy':
      return <GroupByForm config={data.config as GroupByConfig} onUpdate={update} />
    case 'sort':
      return <SortForm nodeId={nodeId} config={data.config as SortConfig} onUpdate={update} />
    case 'deduplicate':
      return <DeduplicateForm nodeId={nodeId} config={data.config as DeduplicateConfig} onUpdate={update} />
    case 'columnOps':
      return <ColumnOpsForm nodeId={nodeId} config={data.config as ColumnOpsConfig} onUpdate={update} />
    default:
      return <p className="text-xs text-gray-400">暂无配置项</p>
  }
}

// ---------------------------------------------------------------------------
// 表单子组件
// ---------------------------------------------------------------------------

const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none'

/**
 * 安全解析数值输入：保留用户正在输入的中间状态（空值、负号、小数点、尾零）。
 * 支持 [列名] 引用语法。
 */
function safeParseNum(raw: string): number | string {
  if (raw === '' || raw === '-' || raw === '-.' || raw === '.') return raw
  if (raw.startsWith('[') && raw.endsWith(']')) return raw
  if (/\.$/.test(raw) || /\.\d*0$/.test(raw)) return raw
  const v = Number(raw)
  return isNaN(v) ? raw : v
}

function ExcelInputForm({
  nodeId,
  config,
  onUpdate,
}: {
  nodeId: string
  config: ExcelInputConfig
  onUpdate: (c: ExcelInputConfig) => void
}) {
  const setInputData = useFlowStore((s) => s.setInputData)
  const setExcelSheets = useFlowStore((s) => s.setExcelSheets)
  const allSheets = useFlowStore((s) => s.excelSheetsMap[nodeId])
  const fileRef = useRef<HTMLInputElement>(null)
  const [copiedCol, setCopiedCol] = useState<string | null>(null)

  const sheetNames = allSheets ? Object.keys(allSheets) : []
  const rawData = allSheets?.[config.sheetName]
  const allColumns = rawData?.columns ?? []

  const selected = config.selectedColumns
  const isAllSelected = !selected || selected.length === allColumns.length

  const applyColumnFilter = useCallback(
    (fullData: DataTable, cols: string[] | undefined) => {
      if (!cols || cols.length === fullData.columns.length) {
        setInputData(nodeId, fullData)
        return
      }
      if (cols.length === 0) {
        setInputData(nodeId, { columns: [], rows: [] })
        return
      }
      const colSet = new Set(cols)
      setInputData(nodeId, {
        columns: fullData.columns.filter((c) => colSet.has(c)),
        rows: fullData.rows.map((row) => {
          const filtered: Record<string, unknown> = {}
          for (const c of cols) if (c in row) filtered[c] = row[c]
          return filtered
        }),
      })
    },
    [nodeId, setInputData],
  )

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const sheets = await parseExcelFile(file)
    setExcelSheets(nodeId, sheets)

    const names = Object.keys(sheets)
    const targetSheet = config.sheetName && sheets[config.sheetName] ? config.sheetName : names[0]
    if (targetSheet && sheets[targetSheet]) {
      const newConfig: ExcelInputConfig = { ...config, sheetName: targetSheet, fileName: file.name, selectedColumns: undefined }
      onUpdate(newConfig)
      setInputData(nodeId, sheets[targetSheet])
    }
  }

  const handleSheetChange = (sheetName: string) => {
    if (allSheets && allSheets[sheetName]) {
      const newConfig: ExcelInputConfig = { ...config, sheetName, selectedColumns: undefined }
      onUpdate(newConfig)
      setInputData(nodeId, allSheets[sheetName])
    }
  }

  const toggleColumn = (col: string) => {
    if (!rawData) return
    let next: string[] | undefined
    if (isAllSelected) {
      next = allColumns.filter((c) => c !== col)
    } else {
      const cur = selected ?? []
      if (cur.includes(col)) {
        next = cur.filter((c) => c !== col)
      } else {
        next = [...cur, col]
      }
      if (next.length === allColumns.length) next = undefined
    }
    onUpdate({ ...config, selectedColumns: next })
    applyColumnFilter(rawData, next)
  }

  const toggleAll = () => {
    if (!rawData) return
    const next = isAllSelected ? ([] as string[]) : undefined
    onUpdate({ ...config, selectedColumns: next })
    applyColumnFilter(rawData, next)
  }

  const handleCopyColumn = (col: string) => {
    navigator.clipboard.writeText(col).then(() => {
      setCopiedCol(col)
      setTimeout(() => setCopiedCol(null), 1200)
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Excel 文件</label>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
        />
        {config.fileName && (
          <p className="mt-1 text-[10px] text-green-600">已加载: {config.fileName}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>选择 Sheet</label>
        {sheetNames.length > 0 ? (
          <select
            className={inputClass}
            value={config.sheetName}
            onChange={(e) => handleSheetChange(e.target.value)}
          >
            {sheetNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <p className="text-[10px] text-gray-400 italic">请先加载 Excel 文件</p>
        )}
      </div>

      {allColumns.length > 0 && (
        <div>
          <label className={labelClass}>
            选择列 <span className="font-normal text-gray-400">
              ({isAllSelected ? `全部 ${allColumns.length}` : `${selected?.length ?? 0}/${allColumns.length}`} 列参与流程)
            </span>
          </label>
          <div className="mb-1.5 flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="text-[10px] text-indigo-500 hover:text-indigo-700"
            >
              {isAllSelected ? '取消全选' : '全选'}
            </button>
            <span className="text-[10px] text-gray-300">|</span>
            <span className="text-[10px] text-gray-400">点击列名复制，勾选框选择参与流程的列</span>
          </div>
          <div className="space-y-0.5 max-h-56 overflow-y-auto border border-gray-200 rounded p-1.5">
            {allColumns.map((col) => {
              const checked = isAllSelected || (selected?.includes(col) ?? false)
              return (
                <div key={col} className="flex items-center gap-1.5 group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleColumn(col)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-400 flex-shrink-0 cursor-pointer"
                  />
                  <button
                    onClick={() => handleCopyColumn(col)}
                    className={`text-[11px] truncate text-left flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer ${
                      copiedCol === col
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                    title={`点击复制: ${col}`}
                  >
                    {copiedCol === col ? '✓ 已复制' : col}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ExcelOutputForm({
  nodeId,
  config,
  onUpdate,
}: {
  nodeId: string
  config: ExcelOutputConfig
  onUpdate: (c: ExcelOutputConfig) => void
}) {
  const inputPreview = useFlowStore((s) => s.inputPreviewMap[nodeId])
  const outputPreview = useFlowStore((s) => s.previewMap[nodeId])
  const outputData = useFlowStore((s) => s.outputMap[nodeId])
  const availableColumns = inputPreview?.columns ?? outputPreview?.columns ?? []

  const handleDownload = useCallback(() => {
    if (!outputData) {
      alert('请先执行流程')
      return
    }
    const fileName = config.fileName || 'final_result.xlsx'
    const sheetName = config.sheetName || 'Result'
    const splitCols = config.splitByColumns?.length ? config.splitByColumns : null
    if (splitCols) {
      exportWithSplit(outputData, splitCols, config.splitMode ?? 'sheets', sheetName, fileName)
    } else {
      exportToExcel({ [sheetName]: outputData }, fileName)
    }
  }, [outputData, config.fileName, config.sheetName, config.splitByColumns, config.splitMode])

  const selected = config.selectedColumns
  const isAllSelected = !selected || selected.length === availableColumns.length
  // 实际导出的列 = 拆分列的候选来源
  const exportColumns = (!selected || selected.length === 0) ? availableColumns : selected

  const toggleColumn = (col: string) => {
    let next: string[] | undefined
    if (isAllSelected) {
      next = availableColumns.filter((c) => c !== col)
    } else {
      const cur = selected ?? []
      if (cur.includes(col)) {
        next = cur.filter((c) => c !== col)
        if (next.length === 0) next = undefined
      } else {
        next = [...cur, col]
      }
      if (next && next.length === availableColumns.length) next = undefined
    }
    onUpdate({ ...config, selectedColumns: next })
  }

  const toggleAll = () => {
    onUpdate({ ...config, selectedColumns: isAllSelected ? [] : undefined })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Sheet 名称</label>
        <input className={inputClass} value={config.sheetName} onChange={(e) => onUpdate({ ...config, sheetName: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>文件名</label>
        <input className={inputClass} value={config.fileName} onChange={(e) => onUpdate({ ...config, fileName: e.target.value })} />
      </div>

      {availableColumns.length > 0 && (
        <div>
          <label className={labelClass}>
            导出列 <span className="font-normal text-gray-400">
              ({isAllSelected ? `全部 ${availableColumns.length}` : `${selected?.length ?? 0}/${availableColumns.length}`} 列)
            </span>
          </label>
          <div className="mb-1.5">
            <button
              onClick={toggleAll}
              className="text-[10px] text-indigo-500 hover:text-indigo-700"
            >
              {isAllSelected ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="space-y-0.5 max-h-56 overflow-y-auto border border-gray-200 rounded p-1.5">
            {availableColumns.map((col) => {
              const checked = isAllSelected || (selected?.includes(col) ?? false)
              return (
                <label key={col} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleColumn(col)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-400 flex-shrink-0"
                  />
                  <span className={`text-[11px] truncate ${checked ? 'text-gray-700' : 'text-gray-400'}`}>
                    {col}
                  </span>
                </label>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">执行后显示可用列，勾选要导出的列</p>
        </div>
      )}

      {availableColumns.length === 0 && (
        <p className="text-[10px] text-gray-400 italic">请先执行流程以查看可用列</p>
      )}

      {/* 拆分配置 */}
      <div className="border-t border-gray-200 pt-3 space-y-2">
        <label className={labelClass}>
          按列拆分导出
          {(config.splitByColumns?.length ?? 0) > 0 && (
            <span className="ml-1 font-normal text-indigo-500">
              （已选 {config.splitByColumns!.length} 列）
            </span>
          )}
        </label>

        {exportColumns.length === 0 ? (
          <p className="text-[10px] text-gray-400 italic">请先执行流程以查看可用列</p>
        ) : (
          <>
            <div className="space-y-0.5 max-h-36 overflow-y-auto border border-gray-200 rounded p-1.5">
              {exportColumns.map((col) => {
                const checked = config.splitByColumns?.includes(col) ?? false
                return (
                  <label key={col} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const cur = config.splitByColumns ?? []
                        const next = checked ? cur.filter((c) => c !== col) : [...cur, col]
                        onUpdate({ ...config, splitByColumns: next.length > 0 ? next : undefined })
                      }}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-400 flex-shrink-0"
                    />
                    <span className={`text-[11px] truncate ${checked ? 'text-gray-700' : 'text-gray-400'}`}>
                      {col}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400">勾选列作为拆分依据，多列将组合为复合 Key</p>
          </>
        )}

        {(config.splitByColumns?.length ?? 0) > 0 && (
          <div>
            <label className={labelClass}>拆分模式</label>
            <select
              className={inputClass}
              value={config.splitMode ?? 'sheets'}
              onChange={(e) => onUpdate({ ...config, splitMode: e.target.value as 'sheets' | 'files' })}
            >
              <option value="sheets">多 Sheet（单文件）</option>
              <option value="files">多文件（每值一个文件）</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {(config.splitMode ?? 'sheets') === 'sheets'
                ? `按 [${config.splitByColumns!.join(' + ')}] 生成多个 Sheet，合并为一个文件`
                : `按 [${config.splitByColumns!.join(' + ')}] 各自导出一个 Excel 文件`}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-3">
        <button
          onClick={handleDownload}
          disabled={!outputData}
          className="w-full px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
        >
          {outputData ? '下载此节点结果' : '执行后可下载'}
        </button>
      </div>
    </div>
  )
}

function TierRuleForm({
  config,
  onUpdate,
}: {
  config: TierRuleConfig
  onUpdate: (c: TierRuleConfig) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importState, setImportState] = useState<{
    columns: string[]
    rows: Record<string, unknown>[]
    mapping: { min: string; max: string; value: string }
  } | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const updateBracket = (idx: number, field: keyof TierBracket, value: number | null) => {
    const brackets = [...config.brackets]
    brackets[idx] = { ...brackets[idx], [field]: value }
    onUpdate({ ...config, brackets })
  }

  const addBracket = () => {
    const last = config.brackets[config.brackets.length - 1]
    const lastMax = last?.max ?? 0
    onUpdate({
      ...config,
      brackets: [...config.brackets, { min: lastMax ?? 0, max: null, value: 0 }],
    })
  }

  const removeBracket = (idx: number) => {
    onUpdate({ ...config, brackets: config.brackets.filter((_, i) => i !== idx) })
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const sheets = await parseExcelFile(file)
      const firstSheetName = Object.keys(sheets)[0]
      const sheet = sheets[firstSheetName]
      if (!sheet || sheet.rows.length === 0) {
        setImportMsg('Excel 为空，无法导入')
        return
      }

      const cols = sheet.columns
      const guessMin = cols.find((c) => /min|下限|最小/i.test(c)) ?? cols[0] ?? ''
      const guessMax = cols.find((c) => /max|上限|最大/i.test(c)) ?? cols[1] ?? ''
      const guessVal = cols.find((c) => /val|value|结果|薪资|金额/i.test(c)) ?? cols[2] ?? ''

      setImportState({
        columns: cols,
        rows: sheet.rows,
        mapping: { min: guessMin, max: guessMax, value: guessVal },
      })
      setImportMsg(null)
    } catch {
      setImportMsg('文件解析失败')
    }
    e.target.value = ''
  }

  const confirmImport = () => {
    if (!importState) return
    const { rows, mapping } = importState
    const brackets: TierBracket[] = rows
      .map((row) => {
        const rawMax = row[mapping.max]
        const parsedMax = (rawMax === null || rawMax === undefined || rawMax === '' || isNaN(Number(rawMax)))
          ? null
          : Number(rawMax)
        return {
          min: Number(row[mapping.min]) || 0,
          max: parsedMax,
          value: Number(row[mapping.value]) || 0,
        }
      })
      .filter((b) => b.max === null || b.max > b.min)
      .sort((a, b) => a.min - b.min)

    if (brackets.length === 0) {
      setImportMsg('未能解析出有效档位，请检查列映射')
      return
    }
    onUpdate({ ...config, brackets })
    setImportState(null)
    setImportMsg(`成功导入 ${brackets.length} 个档位`)
    setTimeout(() => setImportMsg(null), 2500)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>输入列</label>
        <input className={inputClass} value={config.inputColumn} onChange={(e) => onUpdate({ ...config, inputColumn: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>输出列</label>
        <input className={inputClass} value={config.outputColumn} onChange={(e) => onUpdate({ ...config, outputColumn: e.target.value })} />
      </div>

      {/* Excel 导入档位 */}
      <div className="border border-dashed border-gray-300 rounded p-2.5 bg-gray-50/50">
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass + ' !mb-0'}>从 Excel 导入档位</label>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[11px] px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
          >
            选择文件
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
        </div>
        <p className="text-[10px] text-gray-400 mb-1">
          Excel 需包含三列：下限(min)、上限(max)、结果值(value)。上限留空表示无上限。
          <button
            onClick={downloadTierTemplate}
            className="text-indigo-500 hover:text-indigo-700 underline ml-0.5"
          >
            下载模板
          </button>
        </p>

        {importMsg && (
          <p className={`text-[10px] mt-1 ${importMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
            {importMsg}
          </p>
        )}

        {importState && (
          <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
            <p className="text-[10px] text-gray-500">
              识别到 {importState.rows.length} 行数据，请确认列映射：
            </p>
            {(['min', 'max', 'value'] as const).map((field) => (
              <div key={field} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-10 text-right">
                  {field === 'min' ? '下限' : field === 'max' ? '上限' : '结果值'}
                </span>
                <select
                  className={inputClass + ' !w-auto flex-1'}
                  value={importState.mapping[field]}
                  onChange={(e) =>
                    setImportState({
                      ...importState,
                      mapping: { ...importState.mapping, [field]: e.target.value },
                    })
                  }
                >
                  {importState.columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={confirmImport}
                className="flex-1 text-[11px] py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                确认导入
              </button>
              <button
                onClick={() => setImportState(null)}
                className="text-[11px] py-1.5 px-3 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 手工编辑档位 */}
      <div>
        <label className={labelClass}>
          阶梯档位 <span className="font-normal text-gray-400">({config.brackets.length} 个)</span>
        </label>
        <div className="space-y-1.5">
          {config.brackets.map((b, i) => (
            <div key={i} className="flex items-center gap-1">
              <input inputMode="decimal" className={`${inputClass} w-16`} value={b.min} onChange={(e) => updateBracket(i, 'min', safeParseNum(e.target.value) as number)} placeholder="Min" />
              <span className="text-[10px] text-gray-400">~</span>
              <input
                inputMode="decimal"
                className={`${inputClass} w-16 ${b.max === null ? '!bg-indigo-50 !border-indigo-200' : ''}`}
                value={b.max ?? ''}
                onChange={(e) => updateBracket(i, 'max', e.target.value === '' ? null : safeParseNum(e.target.value) as number)}
                placeholder="无上限"
              />
              <span className="text-[10px] text-gray-400">=</span>
              <input inputMode="decimal" className={`${inputClass} w-14`} value={b.value} onChange={(e) => updateBracket(i, 'value', safeParseNum(e.target.value) as number)} placeholder="值" />
              <button onClick={() => removeBracket(i)} className="text-red-400 hover:text-red-600 text-xs px-1">x</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-1.5">
          <button onClick={addBracket} className="text-[11px] text-indigo-500 hover:text-indigo-700">+ 添加档位</button>
          {config.brackets.length > 0 && (
            <button
              onClick={() => onUpdate({ ...config, brackets: [] })}
              className="text-[11px] text-red-400 hover:text-red-600"
            >
              清空全部
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TierRuleV2Form({
  config,
  onUpdate,
}: {
  config: TierRuleV2Config
  onUpdate: (c: TierRuleV2Config) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const sheets = await parseExcelFile(file)
      const firstSheet = Object.keys(sheets)[0]
      const table = sheets[firstSheet]
      if (!table || table.rows.length === 0) {
        setImportMsg('Excel 为空')
        return
      }

      const cols = table.columns
      const guessMin = cols.find((c) => /min|下限|最小/i.test(c)) ?? cols[0] ?? ''
      const guessMax = cols.find((c) => /max|上限|最大/i.test(c)) ?? cols[1] ?? ''

      onUpdate({
        ...config,
        minColumn: guessMin,
        maxColumn: guessMax,
        ruleTable: table,
      })
      setImportMsg(`导入成功: ${table.rows.length} 行 × ${cols.length} 列`)
      setTimeout(() => setImportMsg(null), 3000)
    } catch {
      setImportMsg('文件解析失败')
    }
    e.target.value = ''
  }

  const outputCols = config.ruleTable.columns.filter(
    (c) => c !== config.minColumn && c !== config.maxColumn,
  )

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>匹配列 <span className="font-normal text-gray-400">(原始数据中用于阶梯匹配的列)</span></label>
        <input
          className={inputClass}
          value={config.inputColumn}
          onChange={(e) => onUpdate({ ...config, inputColumn: e.target.value })}
          placeholder="如：钻石数"
        />
      </div>

      <div className="border border-dashed border-gray-300 rounded p-2.5 bg-gray-50/50">
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass + ' !mb-0'}>导入规则表</label>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[11px] px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
          >
            选择 Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        </div>
        <p className="text-[10px] text-gray-400">
          规则表需包含 min、max 列（阶梯区间）及其他输出列（如 value-X、A-min 等）
        </p>
        {importMsg && (
          <p className={`text-[10px] mt-1 ${importMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
            {importMsg}
          </p>
        )}
      </div>

      {config.ruleTable.columns.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>下限列名</label>
              <select
                className={inputClass}
                value={config.minColumn}
                onChange={(e) => onUpdate({ ...config, minColumn: e.target.value })}
              >
                {config.ruleTable.columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>上限列名</label>
              <select
                className={inputClass}
                value={config.maxColumn}
                onChange={(e) => onUpdate({ ...config, maxColumn: e.target.value })}
              >
                {config.ruleTable.columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              输出列 <span className="font-normal text-gray-400">({outputCols.length} 列，匹配后追加到原始表)</span>
            </label>
            <div className="flex flex-wrap gap-1">
              {outputCols.map((col) => (
                <span key={col} className="px-2 py-0.5 text-[10px] bg-indigo-50 text-indigo-600 rounded border border-indigo-200">
                  {col}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>规则预览</label>
            <div className="overflow-auto max-h-36 border border-gray-200 rounded text-[10px]">
              <table className="min-w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {config.ruleTable.columns.map((col) => (
                      <th key={col} className="px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">
                        {col === config.minColumn ? `${col} (下限)` : col === config.maxColumn ? `${col} (上限)` : col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.ruleTable.rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {config.ruleTable.columns.map((col) => (
                        <td key={col} className="px-2 py-0.5 whitespace-nowrap text-gray-700">
                          {row[col] != null ? String(row[col]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FormulaForm({
  config,
  onUpdate,
}: {
  config: FormulaConfig
  onUpdate: (c: FormulaConfig) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>公式表达式</label>
        <input className={inputClass} value={config.expression} onChange={(e) => onUpdate({ ...config, expression: e.target.value })} placeholder="[金币] * 0.5 + [时长]" />
        <p className="text-[10px] text-gray-400 mt-1">用 [列名] 引用列值</p>
      </div>
      <div>
        <label className={labelClass}>输出列名</label>
        <input className={inputClass} value={config.outputColumn} onChange={(e) => onUpdate({ ...config, outputColumn: e.target.value })} />
      </div>
    </div>
  )
}

function FormulaV2Form({
  config,
  onUpdate,
}: {
  config: FormulaV2Config
  onUpdate: (c: FormulaV2Config) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>公式表达式（V2）</label>
        <textarea
          className={`${inputClass} font-mono resize-y min-h-[72px]`}
          value={config.expression}
          onChange={(e) => onUpdate({ ...config, expression: e.target.value })}
          placeholder={'IF([绩效] >= 0.9, [基础工资] * 0.2, [基础工资] * 0.1)'}
          spellCheck={false}
        />
        <div className="mt-1.5 text-[10px] text-gray-400 space-y-0.5 leading-relaxed">
          <p>用 <code className="bg-gray-100 px-1 rounded">[列名]</code> 引用列值</p>
          <p>支持函数：<code className="bg-gray-100 px-1 rounded">IF</code> <code className="bg-gray-100 px-1 rounded">ROUND</code> <code className="bg-gray-100 px-1 rounded">ABS</code> <code className="bg-gray-100 px-1 rounded">MAX</code> <code className="bg-gray-100 px-1 rounded">MIN</code> <code className="bg-gray-100 px-1 rounded">CONCAT</code> <code className="bg-gray-100 px-1 rounded">UPPER</code> <code className="bg-gray-100 px-1 rounded">LOWER</code> <code className="bg-gray-100 px-1 rounded">TRIM</code> <code className="bg-gray-100 px-1 rounded">LEN</code> <code className="bg-gray-100 px-1 rounded">ISNULL</code></p>
          <p>比较运算符：<code className="bg-gray-100 px-1 rounded">{'> >= < <= == !='}</code>　逻辑：<code className="bg-gray-100 px-1 rounded">{'&& ||'}</code></p>
        </div>
      </div>
      <div>
        <label className={labelClass}>输出列名</label>
        <input className={inputClass} value={config.outputColumn} onChange={(e) => onUpdate({ ...config, outputColumn: e.target.value })} />
      </div>
    </div>
  )
}

function FilterForm({
  config,
  onUpdate,
}: {
  config: FilterConfig
  onUpdate: (c: FilterConfig) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>列名</label>
        <input className={inputClass} value={config.column} onChange={(e) => onUpdate({ ...config, column: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>运算符</label>
        <select className={inputClass} value={config.operator} onChange={(e) => onUpdate({ ...config, operator: e.target.value as FilterConfig['operator'] })}>
          <option value=">">大于 (&gt;)</option>
          <option value=">=">大于等于 (&gt;=)</option>
          <option value="<">小于 (&lt;)</option>
          <option value="<=">小于等于 (&lt;=)</option>
          <option value="==">等于 (==)</option>
          <option value="!=">不等于 (!=)</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>比较值</label>
        <input className={inputClass} value={String(config.value)} onChange={(e) => onUpdate({ ...config, value: safeParseNum(e.target.value) })} placeholder="固定值 或 [列名]" />
      </div>
    </div>
  )
}

function ConstraintForm({
  config,
  onUpdate,
}: {
  config: ConstraintConfig
  onUpdate: (c: ConstraintConfig) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>目标列</label>
        <input className={inputClass} value={config.column} onChange={(e) => onUpdate({ ...config, column: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>保底值 (Min)</label>
        <input inputMode="decimal" className={inputClass} value={config.min ?? ''} onChange={(e) => { const raw = e.target.value; onUpdate({ ...config, min: raw === '' ? undefined : safeParseNum(raw) as number }) }} placeholder="不设限" />
      </div>
      <div>
        <label className={labelClass}>封顶值 (Max)</label>
        <input inputMode="decimal" className={inputClass} value={config.max ?? ''} onChange={(e) => { const raw = e.target.value; onUpdate({ ...config, max: raw === '' ? undefined : safeParseNum(raw) as number }) }} placeholder="不设限" />
      </div>
    </div>
  )
}

function JoinForm({
  nodeId,
  config,
  onUpdate,
}: {
  nodeId: string
  config: JoinConfig
  onUpdate: (c: JoinConfig) => void
}) {
  const edges = useFlowStore((s) => s.edges)
  const previewMap = useFlowStore((s) => s.previewMap)

  // 找到 left / right 上游节点 id
  const leftEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'left')
    ?? edges.find((e) => e.target === nodeId)
  const rightEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'right')

  const leftCols = leftEdge ? (previewMap[leftEdge.source]?.columns ?? []) : []
  const rightCols = rightEdge ? (previewMap[rightEdge.source]?.columns ?? []) : []

  // 兼容旧格式 (leftKey / rightKey) → 迁移到数组
  const leftKeys: string[] = config.leftKeys?.length
    ? config.leftKeys
    : (config as unknown as { leftKey?: string }).leftKey
      ? [(config as unknown as { leftKey: string }).leftKey]
      : []
  const rightKeys: string[] = config.rightKeys?.length
    ? config.rightKeys
    : (config as unknown as { rightKey?: string }).rightKey
      ? [(config as unknown as { rightKey: string }).rightKey]
      : []

  const conflictStrategy = config.conflictStrategy ?? 'left_wins'

  const pairCount = Math.max(leftKeys.length, rightKeys.length, 1)
  const pairs = Array.from({ length: pairCount }, (_, i) => ({
    left: leftKeys[i] ?? '',
    right: rightKeys[i] ?? '',
  }))

  const updatePair = (idx: number, side: 'left' | 'right', val: string) => {
    const newLeft = [...leftKeys]
    const newRight = [...rightKeys]
    while (newLeft.length < pairCount) newLeft.push('')
    while (newRight.length < pairCount) newRight.push('')
    if (side === 'left') newLeft[idx] = val
    else newRight[idx] = val
    onUpdate({ ...config, leftKeys: newLeft, rightKeys: newRight })
  }

  const addPair = () => {
    onUpdate({ ...config, leftKeys: [...leftKeys, ''], rightKeys: [...rightKeys, ''] })
  }

  const removePair = (idx: number) => {
    const newLeft = leftKeys.filter((_, i) => i !== idx)
    const newRight = rightKeys.filter((_, i) => i !== idx)
    onUpdate({ ...config, leftKeys: newLeft.length ? newLeft : [''], rightKeys: newRight.length ? newRight : [''] })
  }

  const joinTypeOptions: { value: JoinConfig['joinType']; label: string; desc: string }[] = [
    { value: 'inner', label: '内连接', desc: '仅保留两边都匹配的行' },
    { value: 'left', label: '左连接', desc: '保留左表全部行，右表无匹配填空' },
    { value: 'right', label: '右连接', desc: '保留右表全部行，左表无匹配填空' },
    { value: 'full', label: '全连接', desc: '两边都全量保留' },
  ]

  const conflictOptions: { value: JoinConfig['conflictStrategy']; label: string }[] = [
    { value: 'left_wins', label: '左表优先（同名列取左值）' },
    { value: 'right_wins', label: '右表优先（同名列取右值）' },
    { value: 'rename_right', label: '右表重命名（冲突列加 _right 后缀）' },
    { value: 'rename_both', label: '两边重命名（冲突列各加 _left / _right）' },
  ]

  const colSelect = (cols: string[], val: string, onChange: (v: string) => void) => (
    cols.length > 0 ? (
      <select className={inputClass} value={val} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- 选择列 --</option>
        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    ) : (
      <input
        className={inputClass}
        value={val}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入列名"
      />
    )
  )

  return (
    <div className="space-y-4">
      {/* 关联类型 */}
      <div>
        <label className={labelClass}>关联类型</label>
        <div className="grid grid-cols-2 gap-1">
          {joinTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ ...config, leftKeys, rightKeys, joinType: opt.value, conflictStrategy })}
              title={opt.desc}
              className={[
                'px-2 py-1.5 text-xs rounded border text-left transition-colors',
                config.joinType === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-gray-400 italic">
          {joinTypeOptions.find((o) => o.value === config.joinType)?.desc}
        </p>
      </div>

      {/* 关联键对 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass + ' mb-0'}>关联键</label>
          <button
            type="button"
            onClick={addPair}
            className="text-[10px] text-indigo-600 hover:underline"
          >
            + 添加联合键
          </button>
        </div>
        <div className="space-y-2">
          {pairs.map((pair, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div className="flex-1">
                <div className="text-[9px] text-gray-400 mb-0.5">左表</div>
                {colSelect(leftCols, pair.left, (v) => updatePair(idx, 'left', v))}
              </div>
              <div className="text-gray-400 text-xs pt-4">=</div>
              <div className="flex-1">
                <div className="text-[9px] text-gray-400 mb-0.5">右表</div>
                {colSelect(rightCols, pair.right, (v) => updatePair(idx, 'right', v))}
              </div>
              {pairs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePair(idx)}
                  className="text-red-400 hover:text-red-600 text-xs pt-4"
                  title="移除此键"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {leftCols.length === 0 && (
          <p className="mt-1 text-[10px] text-gray-400 italic">执行一次流程后可从下拉选择列名</p>
        )}
      </div>

      {/* 同名列冲突策略 */}
      <div>
        <label className={labelClass}>同名列冲突策略</label>
        <select
          className={inputClass}
          value={conflictStrategy}
          onChange={(e) =>
            onUpdate({ ...config, leftKeys, rightKeys, conflictStrategy: e.target.value as JoinConfig['conflictStrategy'] })
          }
        >
          {conflictOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function GroupByForm({
  config,
  onUpdate,
}: {
  config: GroupByConfig
  onUpdate: (c: GroupByConfig) => void
}) {
  const [newCol, setNewCol] = useState('')

  const addGroupCol = () => {
    const col = newCol.trim()
    if (!col || config.groupByColumns.includes(col)) return
    onUpdate({ ...config, groupByColumns: [...config.groupByColumns, col] })
    setNewCol('')
  }

  const removeGroupCol = (idx: number) => {
    onUpdate({ ...config, groupByColumns: config.groupByColumns.filter((_, i) => i !== idx) })
  }

  const moveGroupCol = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= config.groupByColumns.length) return
    const cols = [...config.groupByColumns]
    ;[cols[idx], cols[target]] = [cols[target], cols[idx]]
    onUpdate({ ...config, groupByColumns: cols })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>
          分组列 <span className="font-normal text-gray-400">({config.groupByColumns.length} 列)</span>
        </label>
        {config.groupByColumns.length > 0 && (
          <div className="space-y-1 mb-2">
            {config.groupByColumns.map((col, i) => (
              <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                <span className="text-xs text-gray-700 flex-1 truncate">{col}</span>
                <button onClick={() => moveGroupCol(i, -1)} disabled={i === 0} className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
                <button onClick={() => moveGroupCol(i, 1)} disabled={i === config.groupByColumns.length - 1} className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
                <button onClick={() => removeGroupCol(i)} className="text-red-400 hover:text-red-600 text-xs px-0.5">x</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <input
            className={`${inputClass} flex-1`}
            value={newCol}
            onChange={(e) => setNewCol(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroupCol() } }}
            placeholder="输入列名后回车添加"
          />
          <button onClick={addGroupCol} className="text-[11px] px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 whitespace-nowrap">添加</button>
        </div>
      </div>
      <div>
        <label className={labelClass}>聚合规则</label>
        {config.aggregations.map((agg, i) => {
          const updateAgg = (partial: Partial<typeof agg>) => {
            const a = [...config.aggregations]
            a[i] = { ...a[i], ...partial }
            onUpdate({ ...config, aggregations: a })
          }
          const removeAgg = () => {
            onUpdate({ ...config, aggregations: config.aggregations.filter((_, j) => j !== i) })
          }
          return (
            <div key={i} className="mb-2 border border-gray-200 rounded p-1.5 bg-gray-50/50 space-y-1">
              <div className="flex gap-1 items-center">
                <input className={`${inputClass} flex-1`} value={agg.column} onChange={(e) => updateAgg({ column: e.target.value })} placeholder="列名" />
                <select
                  className={`${inputClass} !w-20`}
                  value={agg.func}
                  onChange={(e) => updateAgg({ func: e.target.value as typeof agg.func })}
                >
                  <option value="sum">求和</option>
                  <option value="count">计数</option>
                  <option value="avg">平均</option>
                  <option value="min">最小</option>
                  <option value="max">最大</option>
                  <option value="countif">条件计数</option>
                </select>
                <button onClick={removeAgg} className="text-red-400 hover:text-red-600 text-xs px-1 flex-shrink-0">×</button>
              </div>
              {agg.func === 'countif' && (
                <div className="flex gap-1 items-center pl-1">
                  <span className="text-[10px] text-gray-400 flex-shrink-0">条件:</span>
                  <select
                    className={`${inputClass} !w-12`}
                    value={agg.operator ?? '=='}
                    onChange={(e) => updateAgg({ operator: e.target.value as CompareOperator })}
                  >
                    <option value="==">==</option>
                    <option value="!=">!=</option>
                    <option value=">">&gt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<">&lt;</option>
                    <option value="<=">&lt;=</option>
                  </select>
                  <input
                    className={`${inputClass} flex-1`}
                    value={String(agg.compareValue ?? '')}
                    onChange={(e) => updateAgg({ compareValue: safeParseNum(e.target.value) })}
                    placeholder="比较值"
                  />
                </div>
              )}
              <div className="flex gap-1 items-center pl-1">
                <span className="text-[10px] text-gray-400 flex-shrink-0">输出:</span>
                <input className={`${inputClass} flex-1`} value={agg.outputColumn} onChange={(e) => updateAgg({ outputColumn: e.target.value })} placeholder="输出列名" />
              </div>
            </div>
          )
        })}
        <button onClick={() => onUpdate({ ...config, aggregations: [...config.aggregations, { column: '', func: 'sum', outputColumn: '' }] })} className="text-[11px] text-indigo-500 hover:text-indigo-700">+ 添加聚合</button>
      </div>
    </div>
  )
}

function ConditionalAssignForm({
  config,
  onUpdate,
}: {
  config: ConditionalAssignConfig
  onUpdate: (c: ConditionalAssignConfig) => void
}) {
  const parseValue = safeParseNum

  const updateRule = (idx: number, partial: Partial<ConditionalRule>) => {
    const rules = [...config.rules]
    rules[idx] = { ...rules[idx], ...partial }
    onUpdate({ ...config, rules })
  }

  const updateCondition = (ruleIdx: number, condIdx: number, partial: Partial<Condition>) => {
    const rules = [...config.rules]
    const conditions = [...rules[ruleIdx].conditions]
    conditions[condIdx] = { ...conditions[condIdx], ...partial }
    rules[ruleIdx] = { ...rules[ruleIdx], conditions }
    onUpdate({ ...config, rules })
  }

  const addCondition = (ruleIdx: number) => {
    const rules = [...config.rules]
    rules[ruleIdx] = {
      ...rules[ruleIdx],
      conditions: [...rules[ruleIdx].conditions, { column: '', operator: '>=', compareValue: '' }],
    }
    onUpdate({ ...config, rules })
  }

  const removeCondition = (ruleIdx: number, condIdx: number) => {
    const rules = [...config.rules]
    rules[ruleIdx] = {
      ...rules[ruleIdx],
      conditions: rules[ruleIdx].conditions.filter((_, i) => i !== condIdx),
    }
    onUpdate({ ...config, rules })
  }

  const addRule = () => {
    const newRule: ConditionalRule = {
      conditions: [{ column: '', operator: '>=', compareValue: '' }],
      logic: 'and',
      result: '',
    }
    onUpdate({ ...config, rules: [...config.rules, newRule] })
  }

  const removeRule = (idx: number) => {
    onUpdate({ ...config, rules: config.rules.filter((_, i) => i !== idx) })
  }

  const moveRule = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= config.rules.length) return
    const rules = [...config.rules]
    ;[rules[idx], rules[target]] = [rules[target], rules[idx]]
    onUpdate({ ...config, rules })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>输出列名</label>
        <input
          className={inputClass}
          value={config.outputColumn}
          onChange={(e) => onUpdate({ ...config, outputColumn: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass}>
          条件规则 <span className="font-normal text-gray-400">({config.rules.length} 条，从上到下依次匹配)</span>
        </label>
        <p className="text-[10px] text-gray-400 mb-1.5">所有值字段均支持 <code className="bg-gray-100 px-1 rounded">[列名]</code> 引用同行数据</p>
        <div className="space-y-2">
          {config.rules.map((rule, ruleIdx) => (
            <div key={ruleIdx} className="border border-gray-200 rounded p-2 bg-gray-50/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-indigo-500 font-medium">{ruleIdx === 0 ? '如果' : '否则如果'}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveRule(ruleIdx, -1)} disabled={ruleIdx === 0} className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 px-0.5" title="上移">↑</button>
                  <button onClick={() => moveRule(ruleIdx, 1)} disabled={ruleIdx === config.rules.length - 1} className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 px-0.5" title="下移">↓</button>
                  <button onClick={() => removeRule(ruleIdx)} className="text-red-400 hover:text-red-600 text-xs px-0.5">x</button>
                </div>
              </div>

              {rule.conditions.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">条件组合:</span>
                  <select
                    className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded bg-white"
                    value={rule.logic}
                    onChange={(e) => updateRule(ruleIdx, { logic: e.target.value as 'and' | 'or' })}
                  >
                    <option value="and">全部满足（并且）</option>
                    <option value="or">任一满足（或者）</option>
                  </select>
                </div>
              )}

              {rule.conditions.map((cond, condIdx) => (
                <div key={condIdx}>
                  {condIdx > 0 && (
                    <div className="text-center text-[10px] text-gray-300 -my-0.5">
                      {rule.logic === 'and' ? '并且' : '或者'}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <input
                      className={`${inputClass} flex-1`}
                      value={cond.column}
                      onChange={(e) => updateCondition(ruleIdx, condIdx, { column: e.target.value })}
                      placeholder="列名"
                    />
                    <select
                      className={`${inputClass} !w-14`}
                      value={cond.operator}
                      onChange={(e) => updateCondition(ruleIdx, condIdx, { operator: e.target.value as CompareOperator })}
                    >
                      <option value=">">{'>'}</option>
                      <option value=">=">{'>='}</option>
                      <option value="<">{'<'}</option>
                      <option value="<=">{'<='}</option>
                      <option value="==">{'=='}</option>
                      <option value="!=">{'!='}</option>
                    </select>
                    <input
                      className={`${inputClass} flex-1`}
                      value={String(cond.compareValue)}
                      onChange={(e) => updateCondition(ruleIdx, condIdx, { compareValue: parseValue(e.target.value) })}
                      placeholder="固定值 或 [列名]"
                    />
                    {rule.conditions.length > 1 && (
                      <button onClick={() => removeCondition(ruleIdx, condIdx)} className="text-red-400 hover:text-red-600 text-[10px] px-0.5 flex-shrink-0">x</button>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={() => addCondition(ruleIdx)}
                className="text-[10px] text-gray-400 hover:text-indigo-500"
              >
                + 添加条件
              </button>

              <div className="flex items-center gap-1 border-t border-gray-100 pt-1.5">
                <span className="text-[10px] text-amber-500 font-medium flex-shrink-0">则 →</span>
                <input
                  className={`${inputClass} flex-1`}
                  value={String(rule.result)}
                  onChange={(e) => updateRule(ruleIdx, { result: parseValue(e.target.value) })}
                  placeholder="固定值 或 [列名]"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">否则 →</span>
                <input
                  className={`${inputClass} flex-1`}
                  value={String(rule.elseResult ?? '')}
                  onChange={(e) => {
                    const raw = e.target.value
                    updateRule(ruleIdx, { elseResult: raw === '' ? undefined : parseValue(raw) })
                  }}
                  placeholder="留空继续匹配 或 [列名]"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addRule}
          className="mt-1.5 text-[11px] text-indigo-500 hover:text-indigo-700"
        >
          + 添加规则
        </button>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <label className={labelClass}>兜底值 <span className="font-normal text-gray-400">(所有规则及其否则都未命中)</span></label>
        <input
          className={inputClass}
          value={String(config.defaultValue)}
          onChange={(e) => onUpdate({ ...config, defaultValue: parseValue(e.target.value) })}
          placeholder="固定值 或 [列名]"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 可折叠数据预览区域
// ---------------------------------------------------------------------------

function DataPreviewSection({
  title,
  table,
  defaultCollapsed = false,
}: {
  title: string
  table: DataTable
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className="mt-4">
      <button
        className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 mb-2 w-full text-left"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="text-[10px]">{collapsed ? '▶' : '▼'}</span>
        {title}
        <span className="font-normal text-gray-400 ml-1">
          ({table.rows.length} 行 × {table.columns.length} 列)
        </span>
      </button>
      {!collapsed && <DataPreview table={table} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 数据预览表格
// ---------------------------------------------------------------------------

function DataPreview({ table }: { table: DataTable }) {
  if (table.rows.length === 0) {
    return <p className="text-[10px] text-gray-400 italic">无数据</p>
  }

  return (
    <div className="overflow-auto max-h-48 border border-gray-200 rounded text-[10px]">
      <table className="min-w-full">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {table.columns.map((col) => (
              <th key={col} className="px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 20).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {table.columns.map((col) => (
                <td key={col} className="px-2 py-0.5 whitespace-nowrap text-gray-700">
                  {row[col] != null ? String(row[col]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 20 && (
        <div className="text-center py-1 text-gray-400">... 共 {table.rows.length} 行</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortForm
// ---------------------------------------------------------------------------
function SortForm({ nodeId, config, onUpdate }: { nodeId: string; config: SortConfig; onUpdate: (c: SortConfig) => void }) {
  const inputPreview = useFlowStore((s) => s.inputPreviewMap[nodeId])
  const preview = useFlowStore((s) => s.previewMap[nodeId])
  const cols = inputPreview?.columns ?? preview?.columns ?? []

  const rules = config.rules?.length ? config.rules : [{ column: '', order: 'asc' as const }]

  const updateRule = (idx: number, field: 'column' | 'order', val: string) => {
    const next = rules.map((r, i) => i === idx ? { ...r, [field]: val } : r)
    onUpdate({ ...config, rules: next })
  }
  const addRule = () => onUpdate({ ...config, rules: [...rules, { column: '', order: 'asc' as const }] })
  const removeRule = (idx: number) => {
    const next = rules.filter((_, i) => i !== idx)
    onUpdate({ ...config, rules: next.length ? next : [{ column: '', order: 'asc' as const }] })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={labelClass + ' mb-0'}>排序规则（优先级从上到下）</label>
        <button type="button" onClick={addRule} className="text-[10px] text-indigo-600 hover:underline">+ 添加</button>
      </div>
      {rules.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex-1">
            {cols.length > 0 ? (
              <select className={inputClass} value={rule.column} onChange={(e) => updateRule(idx, 'column', e.target.value)}>
                <option value="">-- 选择列 --</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input className={inputClass} value={rule.column} onChange={(e) => updateRule(idx, 'column', e.target.value)} placeholder="列名" />
            )}
          </div>
          <select className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none" value={rule.order} onChange={(e) => updateRule(idx, 'order', e.target.value as 'asc' | 'desc')}>
            <option value="asc">↑ 升序</option>
            <option value="desc">↓ 降序</option>
          </select>
          {rules.length > 1 && (
            <button type="button" onClick={() => removeRule(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          )}
        </div>
      ))}
      {cols.length === 0 && <p className="text-[10px] text-gray-400 italic">执行一次流程后可从下拉选择列名</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeduplicateForm
// ---------------------------------------------------------------------------
function DeduplicateForm({ nodeId, config, onUpdate }: { nodeId: string; config: DeduplicateConfig; onUpdate: (c: DeduplicateConfig) => void }) {
  const inputPreview = useFlowStore((s) => s.inputPreviewMap[nodeId])
  const preview = useFlowStore((s) => s.previewMap[nodeId])
  const cols = inputPreview?.columns ?? preview?.columns ?? []

  const keyColumns = config.keyColumns ?? []
  const toggleCol = (col: string) => {
    const next = keyColumns.includes(col) ? keyColumns.filter((c) => c !== col) : [...keyColumns, col]
    onUpdate({ ...config, keyColumns: next })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>唯一键列（留空 = 全列去重）</label>
        {cols.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {cols.map((c) => (
              <label key={c} className="flex items-center gap-1 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={keyColumns.includes(c)} onChange={() => toggleCol(c)} className="accent-indigo-600" />
                <span className={keyColumns.includes(c) ? 'text-indigo-700 font-medium' : 'text-gray-600'}>{c}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-400 italic mt-1">执行一次流程后可从列表勾选</p>
        )}
      </div>
      <div>
        <label className={labelClass}>保留哪条</label>
        <div className="flex gap-2">
          {(['first', 'last'] as const).map((v) => (
            <button key={v} type="button"
              onClick={() => onUpdate({ ...config, keep: v })}
              className={`flex-1 py-1.5 text-xs rounded border transition-colors ${config.keep === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
            >
              {v === 'first' ? '保留第一条' : '保留最后一条'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ColumnOpsForm
// ---------------------------------------------------------------------------
function ColumnOpsForm({ nodeId, config, onUpdate }: { nodeId: string; config: ColumnOpsConfig; onUpdate: (c: ColumnOpsConfig) => void }) {
  const inputPreview = useFlowStore((s) => s.inputPreviewMap[nodeId])
  const preview = useFlowStore((s) => s.previewMap[nodeId])
  const sourceCols = inputPreview?.columns ?? preview?.columns ?? []

  const columns = config.columns ?? []

  // 初始化：当上游列可用但 columns 为空时，自动填入所有列
  const initFromSource = () => {
    if (sourceCols.length > 0 && columns.length === 0) {
      onUpdate({ ...config, columns: sourceCols.map((c) => ({ source: c, output: c })) })
    }
  }

  const toggleCol = (col: string) => {
    const exists = columns.find((c) => c.source === col)
    if (exists) {
      onUpdate({ ...config, columns: columns.filter((c) => c.source !== col) })
    } else {
      onUpdate({ ...config, columns: [...columns, { source: col, output: col }] })
    }
  }

  const renameCol = (source: string, newOutput: string) => {
    onUpdate({ ...config, columns: columns.map((c) => c.source === source ? { ...c, output: newOutput } : c) })
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...columns]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onUpdate({ ...config, columns: next })
  }
  const moveDown = (idx: number) => {
    if (idx === columns.length - 1) return
    const next = [...columns]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onUpdate({ ...config, columns: next })
  }

  const activeSet = new Set(columns.map((c) => c.source))

  return (
    <div className="space-y-3">
      {/* 列选择 */}
      {sourceCols.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass + ' mb-0'}>选择输出列</label>
            <button type="button" onClick={initFromSource} className="text-[10px] text-indigo-600 hover:underline">全选</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sourceCols.map((c) => (
              <label key={c} className="flex items-center gap-1 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={activeSet.has(c)} onChange={() => toggleCol(c)} className="accent-indigo-600" />
                <span className={activeSet.has(c) ? 'text-indigo-700 font-medium' : 'text-gray-400'}>{c}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 italic">执行一次流程后可选择列</p>
      )}

      {/* 重命名 + 排序 */}
      {columns.length > 0 && (
        <div>
          <label className={labelClass}>输出列 & 重命名（可拖排序）</label>
          <div className="space-y-1">
            {columns.map((col, idx) => (
              <div key={col.source} className="flex items-center gap-1">
                <div className="flex flex-col">
                  <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-[10px]">▲</button>
                  <button type="button" onClick={() => moveDown(idx)} disabled={idx === columns.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-[10px]">▼</button>
                </div>
                <span className="text-[10px] text-gray-400 w-20 truncate flex-shrink-0">{col.source}</span>
                <span className="text-gray-300 text-[10px]">→</span>
                <input
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                  value={col.output}
                  onChange={(e) => renameCol(col.source, e.target.value)}
                  placeholder={col.source}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
