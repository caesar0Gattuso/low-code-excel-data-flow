import { useState } from 'react'
import { operatorRegistry } from '@/utils/operatorRegistry'
import { operatorHelpMap } from '@/utils/operatorHelp'
import { NodeCategory } from '@/types'

const categoryLabels: Record<NodeCategory, string> = {
  [NodeCategory.Input]: '数据输入',
  [NodeCategory.Transformer]: '数据转换（行级操作）',
  [NodeCategory.Aggregator]: '聚合关联（表级操作）',
  [NodeCategory.Output]: '数据输出',
}

const categoryColors: Record<NodeCategory, string> = {
  [NodeCategory.Input]: 'bg-blue-500',
  [NodeCategory.Transformer]: 'bg-amber-500',
  [NodeCategory.Aggregator]: 'bg-purple-500',
  [NodeCategory.Output]: 'bg-green-500',
}

const categoryOrder: NodeCategory[] = [
  NodeCategory.Input,
  NodeCategory.Transformer,
  NodeCategory.Aggregator,
  NodeCategory.Output,
]

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'operators' | 'workflow'>('operators')

  if (!open) return null

  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    label: categoryLabels[cat],
    operators: operatorRegistry.filter((o) => o.category === cat),
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-800">帮助文档</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          {([
            ['operators', '算子说明'],
            ['workflow', '使用流程'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                activeTab === key
                  ? 'bg-indigo-50 text-indigo-700 border border-b-0 border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'operators' ? (
            <OperatorsTab grouped={grouped} />
          ) : (
            <WorkflowTab />
          )}
        </div>
      </div>
    </div>
  )
}

function OperatorsTab({
  grouped,
}: {
  grouped: { category: NodeCategory; label: string; operators: typeof operatorRegistry }[]
}) {
  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.category}>
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${categoryColors[group.category]}`} />
            {group.label}
          </h3>

          <div className="space-y-4">
            {group.operators.map((op) => {
              const help = operatorHelpMap[op.type]
              if (!help) return null

              return (
                <div key={op.type} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] text-white px-1.5 py-0.5 rounded ${categoryColors[group.category]}`}>
                      {op.label}
                    </span>
                    <span className="text-xs text-gray-400">{op.description}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                    <div>
                      <span className="text-gray-400">输入：</span>
                      <span className="text-gray-700">{help.inputDesc}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">输出：</span>
                      <span className="text-gray-700">{help.outputDesc}</span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <p className="text-[11px] font-medium text-gray-500 mb-1">配置项</p>
                    <div className="space-y-1">
                      {help.configs.map((c) => (
                        <div key={c.name} className="flex gap-2 text-xs">
                          <code className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                            {c.name}
                          </code>
                          <span className="text-gray-600">{c.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {help.tips && help.tips.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-gray-500 mb-1">使用提示</p>
                      <ul className="space-y-0.5">
                        {help.tips.map((tip, i) => (
                          <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                            <span className="text-gray-300 select-none">·</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function WorkflowTab() {
  const steps = [
    {
      title: '1. 拖入节点',
      desc: '从左侧算子库中，将需要的节点拖拽到中央画布上。',
    },
    {
      title: '2. 连接节点',
      desc: '从节点底部的输出接口拖线到下一个节点顶部的输入接口，建立数据流方向。',
    },
    {
      title: '3. 配置规则',
      desc: '点击画布上的节点，在右侧属性面板中配置具体参数（如阶梯档位、关联键等）。',
    },
    {
      title: '4. 加载数据',
      desc: '选中 Excel 输入节点，在右侧面板上传 Excel 文件并选择目标 Sheet。',
    },
    {
      title: '5. 执行计算',
      desc: '点击顶部工具栏的「执行」按钮，系统会按拓扑顺序依次执行所有节点。每个节点执行后可在右侧面板查看数据预览。',
    },
    {
      title: '6. 下载结果',
      desc: '执行完成后，点击「下载结果」按钮导出所有 Excel 输出节点的数据。',
    },
    {
      title: '7. 保存模板',
      desc: '点击「导出模板」将当前流程图和规则配置保存为 .flow.json 文件，下次可通过「导入模板」恢复。',
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">基本使用流程</h3>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.title} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {step.title.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">快捷操作</h3>
        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">Backspace</kbd>
            <span>删除选中的节点或连线</span>
          </div>
          <div className="flex gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">点击连线</kbd>
            <span>选中连线（高亮为紫色），再按 Backspace 删除</span>
          </div>
          <div className="flex gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">点击空白</kbd>
            <span>取消选中，关闭右侧属性面板</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">典型结算流程示例</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 font-mono leading-relaxed">
          <p>Excel输入(工作数据) ──→ 数据关联(Join) ──→ 阶梯规则 ──→ 保底/封顶 ──→ Excel输出</p>
          <p>Excel输入(组织关系) ──↗ &nbsp;(按user_id) &nbsp;&nbsp;&nbsp;&nbsp;(加薪资列) &nbsp;&nbsp;(裁剪极值)</p>
          <p className="mt-2">                                 ↓</p>
          <p>                    分组聚合(GroupBy) ──→ 阶梯规则 ──→ Excel输出</p>
          <p>                    (按org_id汇总金币) &nbsp;&nbsp;(组织提成)</p>
        </div>
      </div>
    </div>
  )
}
