import { useState, useRef, useCallback } from 'react'
import { operatorRegistry } from '@/utils/operatorRegistry'
import { NodeCategory, type OperatorMeta } from '@/types'
import { OperatorTooltip } from './OperatorTooltip'

const categoryOrder: NodeCategory[] = [
  NodeCategory.Input,
  NodeCategory.Transformer,
  NodeCategory.Restructure,
  NodeCategory.Aggregator,
  NodeCategory.Output,
]

const categoryLabels: Record<NodeCategory, string> = {
  input:       '数据输入',
  transformer: '行列加工',
  restructure: '结构整理',
  aggregator:  '聚合关联',
  output:      '数据输出',
}

const categoryColors: Record<NodeCategory, { dot: string; text: string }> = {
  input:       { dot: 'bg-blue-400',   text: 'text-blue-600' },
  transformer: { dot: 'bg-amber-400',  text: 'text-amber-600' },
  restructure: { dot: 'bg-cyan-500',   text: 'text-cyan-700' },
  aggregator:  { dot: 'bg-purple-400', text: 'text-purple-600' },
  output:      { dot: 'bg-green-400',  text: 'text-green-600' },
}

const STORAGE_KEY = 'sidebar-collapsed-categories'

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveCollapsed(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)

  // 悬浮卡片状态
  const [tooltip, setTooltip] = useState<{ op: OperatorMeta; rect: DOMRect } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback((op: OperatorMeta, e: React.MouseEvent<HTMLDivElement>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const rect = e.currentTarget.getBoundingClientRect()
    timerRef.current = setTimeout(() => {
      setTooltip({ op, rect })
    }, 300)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTooltip(null)
  }, [])

  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    label: categoryLabels[cat],
    operators: operatorRegistry.filter((o) => o.category === cat),
  }))

  const toggle = (cat: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [cat]: !prev[cat] }
      saveCollapsed(next)
      return next
    })
  }

  const onDragStart = (event: React.DragEvent, operatorType: string) => {
    event.dataTransfer.setData('application/reactflow-operator', operatorType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <>
    <aside className="w-56 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-700">算子库</h2>
      </div>

      {grouped.map((group) => {
        const isCollapsed = !!collapsed[group.category]
        const colors = categoryColors[group.category as NodeCategory]
        return (
          <div key={group.category} className="border-b border-gray-100 last:border-b-0">
            {/* 分组标题（可点击折叠） */}
            <button
              type="button"
              onClick={() => toggle(group.category)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                <span className={`text-xs font-semibold ${colors.text}`}>{group.label}</span>
                <span className="text-[10px] text-gray-400">({group.operators.length})</span>
              </div>
              <span className={`text-gray-400 text-[10px] transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>
                ▼
              </span>
            </button>

            {/* 算子列表 */}
            {!isCollapsed && (
              <div className="px-3 pb-2 space-y-1.5">
                {group.operators.map((op) => (
                  <div
                    key={op.type}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md cursor-grab hover:bg-gray-100 border border-gray-200 transition-colors active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => onDragStart(e, op.type)}
                    onMouseEnter={(e) => handleMouseEnter(op, e)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{op.label}</div>
                      <div className="text-[10px] text-gray-400 truncate">{op.description}</div>
                    </div>
                    <span className="text-gray-300 flex-shrink-0 select-none text-[10px]">⠿</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </aside>

    {/* 悬浮说明卡片（position:fixed，不受 sidebar overflow 裁剪） */}
    {tooltip && (
      <OperatorTooltip op={tooltip.op} anchorRect={tooltip.rect} />
    )}
    </>
  )
}
