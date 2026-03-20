import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { DataTable } from '@/types'

const PAGE_SIZE = 50
const MAX_UNIQUE = 200   // 每列最多展示的唯一值数量

type SortState = { col: string; asc: boolean } | null
type ColFilters = Record<string, Set<string>>

function numStats(values: number[]) {
  if (!values.length) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: parseFloat((sum / values.length).toFixed(4)),
  }
}

// ── 列级过滤下拉 ────────────────────────────────────────────────────────────

function ColFilterPopover({
  col,
  uniqueVals,
  selected,
  onApply,
  onClose,
  anchorRef,
}: {
  col: string
  uniqueVals: string[]
  selected: Set<string>
  onApply: (col: string, vals: Set<string>) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}) {
  const [local, setLocal] = useState<Set<string>>(new Set(selected))
  const [search, setSearch] = useState('')
  const popRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  // 定位到列头按钮下方
  useEffect(() => {
    const btn = anchorRef.current
    const pop = popRef.current
    if (!btn || !pop) return
    const rect = btn.getBoundingClientRect()
    const popH = pop.offsetHeight || 320
    const top = rect.bottom + 4 + popH > window.innerHeight
      ? rect.top - popH - 4
      : rect.bottom + 4
    const left = Math.min(rect.left, window.innerWidth - 240 - 8)
    setStyle({ position: 'fixed', top, left, width: 240, zIndex: 20000 })
  }, [anchorRef])

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const filtered = search
    ? uniqueVals.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : uniqueVals

  const allChecked = filtered.every((v) => local.has(v))

  const toggleVal = (v: string) => {
    setLocal((prev) => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  const toggleAll = () => {
    setLocal((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        filtered.forEach((v) => next.delete(v))
      } else {
        filtered.forEach((v) => next.add(v))
      }
      return next
    })
  }

  return createPortal(
    <div
      ref={popRef}
      style={style}
      className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 标题 */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 truncate max-w-[160px]">筛选：{col}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>

      {/* 搜索唯一值 */}
      <div className="px-3 py-2 border-b border-gray-100">
        <input
          autoFocus
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-indigo-400 focus:outline-none"
          placeholder="搜索值..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 全选行 */}
      <div className="px-3 py-1.5 border-b border-gray-100">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 hover:text-gray-800">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="accent-indigo-600"
          />
          全选 ({filtered.length})
        </label>
      </div>

      {/* 值列表 */}
      <div className="overflow-y-auto max-h-48 px-3 py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 text-center">无匹配</p>
        ) : (
          filtered.map((v) => (
            <label key={v} className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-gray-700 hover:text-gray-900">
              <input
                type="checkbox"
                checked={local.has(v)}
                onChange={() => toggleVal(v)}
                className="accent-indigo-600"
              />
              <span className="truncate" title={v}>{v === '' ? <em className="text-gray-400">（空）</em> : v}</span>
            </label>
          ))
        )}
      </div>

      {/* 操作按钮 */}
      <div className="px-3 py-2 border-t border-gray-100 flex justify-between items-center">
        <button
          onClick={() => { setLocal(new Set(uniqueVals)); onApply(col, new Set(uniqueVals)) }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          清除筛选
        </button>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">取消</button>
          <button
            onClick={() => { onApply(col, local); onClose() }}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            确定
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── 主弹窗 ─────────────────────────────────────────────────────────────────

interface Props {
  title: string
  outputTable?: DataTable       // 全量数据（输出节点用）
  inputTable?: DataTable        // 输入数据预览
  previewTable?: DataTable      // 中间节点预览（200 行）
  totalRows?: number            // 真实总行数
  onClose: () => void
}

export function DataPreviewModal({ title, outputTable, inputTable, previewTable, totalRows, onClose }: Props) {
  // 优先展示全量数据，否则用预览数据
  const hasOutput = !!(outputTable || previewTable)
  const [activeTab, setActiveTab] = useState<'output' | 'input'>(hasOutput ? 'output' : 'input')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>(null)
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null)
  const filterBtnRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({})

  // 当前展示的表（全量优先）
  const table = activeTab === 'output'
    ? (outputTable ?? previewTable)
    : inputTable

  // 是否为截断的预览数据
  const isTruncated = activeTab === 'output' && !outputTable && !!previewTable && !!totalRows && totalRows > (previewTable?.rows.length ?? 0)
  const displayTotal = activeTab === 'output' ? (totalRows ?? table?.rows.length ?? 0) : (table?.rows.length ?? 0)

  // 每列唯一值（基于原始表，不受筛选影响）
  const uniqueVals = useMemo(() => {
    if (!table) return {}
    const result: Record<string, string[]> = {}
    for (const col of table.columns) {
      const vals = new Set(table.rows.map((r) => String(r[col] ?? '')))
      result[col] = Array.from(vals).sort().slice(0, MAX_UNIQUE)
    }
    return result
  }, [table])

  // 列筛选
  const colFiltered = useMemo(() => {
    if (!table) return []
    const active = Object.entries(colFilters).filter(([, s]) => s.size > 0)
    if (!active.length) return table.rows
    return table.rows.filter((row) =>
      active.every(([col, vals]) => vals.has(String(row[col] ?? ''))),
    )
  }, [table, colFilters])

  // 全局搜索
  const searched = useMemo(() => {
    if (!search.trim()) return colFiltered
    const q = search.toLowerCase()
    return colFiltered.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [colFiltered, search])

  // 排序
  const sorted = useMemo(() => {
    if (!sort) return searched
    return [...searched].sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col]
      const an = Number(av), bn = Number(bv)
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''))
      return sort.asc ? cmp : -cmp
    })
  }, [searched, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = useCallback((col: string) => {
    setSort((p) => p?.col === col ? { col, asc: !p.asc } : { col, asc: true })
    setPage(0)
  }, [])

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(0) }, [])

  const handleTab = useCallback((t: 'output' | 'input') => {
    setActiveTab(t); setPage(0); setSearch(''); setSort(null); setColFilters({}); setOpenFilterCol(null)
  }, [])

  const applyColFilter = useCallback((col: string, vals: Set<string>) => {
    setColFilters((prev) => {
      const allVals = uniqueVals[col] ?? []
      const isAll = allVals.length === vals.size
      const next = { ...prev }
      if (isAll) delete next[col]
      else next[col] = vals
      return next
    })
    setPage(0)
  }, [uniqueVals])

  const activeFilterCount = Object.keys(colFilters).length
  const hasFilters = activeFilterCount > 0 || !!search

  // 数值统计（基于筛选后数据）
  const stats = useMemo(() => {
    if (!table) return {}
    const res: Record<string, ReturnType<typeof numStats>> = {}
    for (const col of table.columns) {
      const nums = searched.map((r) => Number(r[col])).filter((n) => !isNaN(n))
      res[col] = nums.length > searched.length * 0.5 ? numStats(nums) : null
    }
    return res
  }, [table, searched])

  if (!table) return null

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-[92vw] max-w-5xl h-[88vh]">

        {/* 头部 */}
        <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-gray-800">{title}</h2>
              {/* 输入/输出 Tab */}
              {hasOutput && inputTable && (
                <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                  {(['output', 'input'] as const).map((t) => (
                    <button key={t} onClick={() => handleTab(t)}
                      className={`px-3 py-1 transition-colors ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                      {t === 'output' ? '输出数据' : '输入数据'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none" title="关闭 (Esc)">✕</button>
          </div>

          {/* 搜索 + 统计 + 清除筛选 */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg w-60 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
              placeholder="🔍 全局搜索（所有列）..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <span className="text-xs text-gray-400">
              {hasFilters
                ? `筛选后 ${sorted.length} 行 / 共 ${displayTotal} 行`
                : `共 ${displayTotal} 行`}
              {' '}× {table.columns.length} 列
            </span>
            {isTruncated && (
              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                预览前 {previewTable?.rows.length} 行，完整数据请下载
              </span>
            )}
            {hasFilters && (
              <button
                onClick={() => { setColFilters({}); handleSearch('') }}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline"
              >
                清除全部筛选 {activeFilterCount > 0 && `(${activeFilterCount} 列)`}
              </button>
            )}
          </div>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-400 bg-gray-50 border-b border-gray-200 w-12 select-none">#</th>
                {table.columns.map((col) => {
                  if (!filterBtnRefs.current[col]) {
                    filterBtnRefs.current[col] = { current: null } as React.RefObject<HTMLButtonElement | null>
                  }
                  const isFiltered = !!colFilters[col]
                  const isSorted = sort?.col === col
                  return (
                    <th key={col} className="px-3 py-1.5 text-left bg-gray-50 border-b border-gray-200 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {/* 排序按钮（列名） */}
                        <button
                          className="flex items-center gap-0.5 font-medium text-gray-600 hover:text-gray-800 group"
                          onClick={() => handleSort(col)}
                          title="点击排序"
                        >
                          <span>{col}</span>
                          <span className={`text-[10px] ${isSorted ? 'text-indigo-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                            {isSorted ? (sort!.asc ? '↑' : '↓') : '↕'}
                          </span>
                        </button>
                        {/* 列过滤按钮 */}
                        <button
                          ref={filterBtnRefs.current[col] as React.RefObject<HTMLButtonElement>}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setOpenFilterCol(openFilterCol === col ? null : col) }}
                          title="列筛选"
                          className={`ml-0.5 px-1 py-0.5 rounded text-[10px] transition-colors ${
                            isFiltered ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {isFiltered ? '▼●' : '▼'}
                        </button>
                      </div>
                      {/* 数值列统计 */}
                      {stats[col] && (
                        <div className="text-[9px] font-normal text-gray-400 mt-0.5">
                          {stats[col]!.min} ~ {stats[col]!.max} avg {stats[col]!.avg}
                        </div>
                      )}
                      {/* 列过滤下拉 */}
                      {openFilterCol === col && (
                        <ColFilterPopover
                          col={col}
                          uniqueVals={uniqueVals[col] ?? []}
                          selected={colFilters[col] ?? new Set(uniqueVals[col] ?? [])}
                          onApply={applyColFilter}
                          onClose={() => setOpenFilterCol(null)}
                          anchorRef={filterBtnRefs.current[col]}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50 transition-colors`}>
                  <td className="px-3 py-1.5 text-gray-300 select-none border-b border-gray-100">{page * PAGE_SIZE + i + 1}</td>
                  {table.columns.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-gray-700 border-b border-gray-100 max-w-[200px] truncate" title={String(row[col] ?? '')}>
                      {row[col] === null || row[col] === undefined
                        ? <span className="text-gray-300 italic">null</span>
                        : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={table.columns.length + 1} className="px-4 py-10 text-center text-gray-400 italic">
                    {hasFilters ? '无匹配数据，尝试调整筛选条件' : '暂无数据'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200 flex-shrink-0">
            <span className="text-xs text-gray-400">第 {page + 1} / {totalPages} 页，每页 {PAGE_SIZE} 行</span>
            <div className="flex items-center gap-1.5">
              {[
                { label: '«', action: () => setPage(0), disabled: page === 0 },
                { label: '‹', action: () => setPage((p) => Math.max(0, p - 1)), disabled: page === 0 },
              ].map(({ label, action, disabled }) => (
                <button key={label} onClick={action} disabled={disabled}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">{label}</button>
              ))}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5))
                const p = start + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                    {p + 1}
                  </button>
                )
              })}
              {[
                { label: '›', action: () => setPage((p) => Math.min(totalPages - 1, p + 1)), disabled: page === totalPages - 1 },
                { label: '»', action: () => setPage(totalPages - 1), disabled: page === totalPages - 1 },
              ].map(({ label, action, disabled }) => (
                <button key={label} onClick={action} disabled={disabled}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
