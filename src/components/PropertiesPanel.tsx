import { useFlowStore } from '@/store/useFlowStore'
import type {
  FlowNodeData,
  TierRuleConfig,
  FormulaConfig,
  FilterConfig,
  ConstraintConfig,
  ConditionalAssignConfig,
  ConditionalRule,
  CompareOperator,
  JoinConfig,
  GroupByConfig,
  ExcelInputConfig,
  ExcelOutputConfig,
  TierBracket,
  DataTable,
} from '@/types'
import { parseExcelFile, downloadTierTemplate } from '@/utils/excelUtils'
import { useCallback, useRef, useState } from 'react'

export function PropertiesPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId)
  const nodes = useFlowStore((s) => s.nodes)
  const previewMap = useFlowStore((s) => s.previewMap)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)

  const node = nodes.find((n) => n.id === selectedNodeId)
  const preview = selectedNodeId ? previewMap[selectedNodeId] : undefined

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

        <ConfigForm nodeId={node.id} data={data} updateNodeData={updateNodeData} />

        {preview && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">数据预览</h3>
            <DataPreview table={preview} />
          </div>
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
      return <ExcelOutputForm config={data.config as ExcelOutputConfig} onUpdate={update} />
    case 'tierRule':
      return <TierRuleForm config={data.config as TierRuleConfig} onUpdate={update} />
    case 'formula':
      return <FormulaForm config={data.config as FormulaConfig} onUpdate={update} />
    case 'filter':
      return <FilterForm config={data.config as FilterConfig} onUpdate={update} />
    case 'constraint':
      return <ConstraintForm config={data.config as ConstraintConfig} onUpdate={update} />
    case 'conditionalAssign':
      return <ConditionalAssignForm config={data.config as ConditionalAssignConfig} onUpdate={update} />
    case 'join':
      return <JoinForm config={data.config as JoinConfig} onUpdate={update} />
    case 'groupBy':
      return <GroupByForm config={data.config as GroupByConfig} onUpdate={update} />
    default:
      return <p className="text-xs text-gray-400">暂无配置项</p>
  }
}

// ---------------------------------------------------------------------------
// 表单子组件
// ---------------------------------------------------------------------------

const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none'

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
  const currentData = useFlowStore((s) => s.inputDataMap[nodeId])
  const fileRef = useRef<HTMLInputElement>(null)
  const [copiedCol, setCopiedCol] = useState<string | null>(null)

  const sheetNames = allSheets ? Object.keys(allSheets) : []
  const columns = currentData?.columns ?? []

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const sheets = await parseExcelFile(file)
    setExcelSheets(nodeId, sheets)

    const names = Object.keys(sheets)
    const targetSheet = config.sheetName && sheets[config.sheetName] ? config.sheetName : names[0]
    if (targetSheet && sheets[targetSheet]) {
      setInputData(nodeId, sheets[targetSheet])
      onUpdate({ ...config, sheetName: targetSheet, fileName: file.name })
    }
  }

  const handleSheetChange = (sheetName: string) => {
    if (allSheets && allSheets[sheetName]) {
      setInputData(nodeId, allSheets[sheetName])
      onUpdate({ ...config, sheetName })
    }
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

      {columns.length > 0 && (
        <div>
          <label className={labelClass}>
            表头列 <span className="font-normal text-gray-400">({columns.length} 列，点击复制)</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {columns.map((col) => (
              <button
                key={col}
                onClick={() => handleCopyColumn(col)}
                className={`px-2 py-1 text-[11px] rounded border transition-all cursor-pointer ${
                  copiedCol === col
                    ? 'bg-green-100 border-green-400 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600'
                }`}
                title={`点击复制: ${col}`}
              >
                {copiedCol === col ? '✓ 已复制' : col}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExcelOutputForm({
  config,
  onUpdate,
}: {
  config: ExcelOutputConfig
  onUpdate: (c: ExcelOutputConfig) => void
}) {
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
              <input type="number" className={`${inputClass} w-16`} value={b.min} onChange={(e) => updateBracket(i, 'min', Number(e.target.value))} placeholder="Min" />
              <span className="text-[10px] text-gray-400">~</span>
              <input
                type="number"
                className={`${inputClass} w-16 ${b.max === null ? '!bg-indigo-50 !border-indigo-200' : ''}`}
                value={b.max ?? ''}
                onChange={(e) => updateBracket(i, 'max', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="无上限"
              />
              <span className="text-[10px] text-gray-400">=</span>
              <input type="number" className={`${inputClass} w-14`} value={b.value} onChange={(e) => updateBracket(i, 'value', Number(e.target.value))} placeholder="值" />
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
        <input className={inputClass} value={String(config.value)} onChange={(e) => { const v = Number(e.target.value); onUpdate({ ...config, value: isNaN(v) ? e.target.value : v }) }} />
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
        <input type="number" className={inputClass} value={config.min ?? ''} onChange={(e) => onUpdate({ ...config, min: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="不设限" />
      </div>
      <div>
        <label className={labelClass}>封顶值 (Max)</label>
        <input type="number" className={inputClass} value={config.max ?? ''} onChange={(e) => onUpdate({ ...config, max: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="不设限" />
      </div>
    </div>
  )
}

function JoinForm({
  config,
  onUpdate,
}: {
  config: JoinConfig
  onUpdate: (c: JoinConfig) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>左表关联键</label>
        <input className={inputClass} value={config.leftKey} onChange={(e) => onUpdate({ ...config, leftKey: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>右表关联键</label>
        <input className={inputClass} value={config.rightKey} onChange={(e) => onUpdate({ ...config, rightKey: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>关联类型</label>
        <select className={inputClass} value={config.joinType} onChange={(e) => onUpdate({ ...config, joinType: e.target.value as 'inner' | 'left' })}>
          <option value="left">左连接 (Left Join)</option>
          <option value="inner">内连接 (Inner Join)</option>
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
        {config.aggregations.map((agg, i) => (
          <div key={i} className="flex gap-1 mb-1.5 items-center">
            <input className={`${inputClass} w-20`} value={agg.column} onChange={(e) => { const a = [...config.aggregations]; a[i] = { ...a[i], column: e.target.value }; onUpdate({ ...config, aggregations: a }) }} placeholder="列" />
            <select className={`${inputClass} w-16`} value={agg.func} onChange={(e) => { const a = [...config.aggregations]; a[i] = { ...a[i], func: e.target.value as 'sum' | 'count' | 'avg' | 'min' | 'max' }; onUpdate({ ...config, aggregations: a }) }}>
              <option value="sum">求和</option>
              <option value="count">计数</option>
              <option value="avg">平均</option>
              <option value="min">最小</option>
              <option value="max">最大</option>
            </select>
            <input className={`${inputClass} w-20`} value={agg.outputColumn} onChange={(e) => { const a = [...config.aggregations]; a[i] = { ...a[i], outputColumn: e.target.value }; onUpdate({ ...config, aggregations: a }) }} placeholder="输出列" />
            <button onClick={() => { const a = config.aggregations.filter((_, j) => j !== i); onUpdate({ ...config, aggregations: a }) }} className="text-red-400 hover:text-red-600 text-xs px-1">×</button>
          </div>
        ))}
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
  const updateRule = (idx: number, partial: Partial<ConditionalRule>) => {
    const rules = [...config.rules]
    rules[idx] = { ...rules[idx], ...partial }
    onUpdate({ ...config, rules })
  }

  const addRule = () => {
    const newRule: ConditionalRule = { column: '', operator: '>=', compareValue: 0, result: 0 }
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
        <div className="space-y-2">
          {config.rules.map((rule, i) => (
            <div key={i} className="border border-gray-200 rounded p-2 bg-gray-50/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium">规则 {i + 1}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveRule(i, -1)}
                    disabled={i === 0}
                    className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 px-0.5"
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveRule(i, 1)}
                    disabled={i === config.rules.length - 1}
                    className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 px-0.5"
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeRule(i)}
                    className="text-red-400 hover:text-red-600 text-xs px-0.5"
                  >
                    x
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 w-4">如</span>
                <input
                  className={`${inputClass} flex-1`}
                  value={rule.column}
                  onChange={(e) => updateRule(i, { column: e.target.value })}
                  placeholder="列名"
                />
                <select
                  className={`${inputClass} !w-14`}
                  value={rule.operator}
                  onChange={(e) => updateRule(i, { operator: e.target.value as CompareOperator })}
                >
                  <option value=">">{'>'}</option>
                  <option value=">=">{'>='}</option>
                  <option value="<">{'<'}</option>
                  <option value="<=">{'<='}</option>
                  <option value="==">{'=='}</option>
                  <option value="!=">{'!='}</option>
                </select>
                <input
                  className={`${inputClass} w-16`}
                  value={String(rule.compareValue)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    updateRule(i, { compareValue: isNaN(v) ? e.target.value : v })
                  }}
                  placeholder="比较值"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 w-4">→</span>
                <input
                  className={`${inputClass} flex-1`}
                  value={String(rule.result)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    updateRule(i, { result: isNaN(v) ? e.target.value : v })
                  }}
                  placeholder="结果值"
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
        <label className={labelClass}>默认值 <span className="font-normal text-gray-400">(所有条件都不满足时)</span></label>
        <input
          className={inputClass}
          value={String(config.defaultValue)}
          onChange={(e) => {
            const v = Number(e.target.value)
            onUpdate({ ...config, defaultValue: isNaN(v) ? e.target.value : v })
          }}
          placeholder="0"
        />
      </div>
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
