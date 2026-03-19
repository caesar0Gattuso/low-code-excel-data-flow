import { operatorRegistry } from '@/utils/operatorRegistry'
import { NodeCategory } from '@/types'

const categoryOrder: NodeCategory[] = [NodeCategory.Input, NodeCategory.Transformer, NodeCategory.Aggregator, NodeCategory.Output]
const categoryLabels: Record<NodeCategory, string> = {
  input: '数据输入',
  transformer: '数据转换',
  aggregator: '聚合关联',
  output: '数据输出',
}

export function Sidebar() {
  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    label: categoryLabels[cat],
    operators: operatorRegistry.filter((o) => o.category === cat),
  }))

  const onDragStart = (event: React.DragEvent, operatorType: string) => {
    event.dataTransfer.setData('application/reactflow-operator', operatorType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-700">算子库</h2>
      </div>
      {grouped.map((group) => (
        <div key={group.category} className="px-3 py-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {group.label}
          </h3>
          <div className="space-y-1.5">
            {group.operators.map((op) => (
              <div
                key={op.type}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md cursor-grab hover:bg-gray-100 border border-gray-200 transition-colors"
                draggable
                onDragStart={(e) => onDragStart(e, op.type)}
              >
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700">{op.label}</div>
                  <div className="text-[10px] text-gray-400">{op.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </aside>
  )
}
