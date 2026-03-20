import { useState } from 'react'
import type { ReactNode } from 'react'
import { operatorRegistry } from '@/utils/operatorRegistry'
import { operatorHelpMap } from '@/utils/operatorHelp'
import { NodeCategory } from '@/types'

/** 检测是否是 Mac，用于显示 ⌘ 还是 Ctrl */
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

/** 键帽样式 */
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 border border-gray-300 border-b-2 rounded text-[10px] font-mono text-gray-700 whitespace-nowrap">
      {children}
    </kbd>
  )
}

/** 键间连接符（+） */
function Sep() {
  return <span className="text-gray-400 text-[10px] mx-1 select-none font-normal">+</span>
}

const categoryLabels: Record<NodeCategory, string> = {
  [NodeCategory.Input]:       '数据输入',
  [NodeCategory.Transformer]: '行列加工',
  [NodeCategory.Restructure]: '结构整理',
  [NodeCategory.Aggregator]:  '聚合关联',
  [NodeCategory.Output]:      '数据输出',
}

const categoryColors: Record<NodeCategory, string> = {
  [NodeCategory.Input]:       'bg-blue-500',
  [NodeCategory.Transformer]: 'bg-amber-500',
  [NodeCategory.Restructure]: 'bg-cyan-500',
  [NodeCategory.Aggregator]:  'bg-purple-500',
  [NodeCategory.Output]:      'bg-green-500',
}

const categoryTabActive: Record<NodeCategory, string> = {
  [NodeCategory.Input]:       'bg-blue-50 text-blue-700',
  [NodeCategory.Transformer]: 'bg-amber-50 text-amber-700',
  [NodeCategory.Restructure]: 'bg-cyan-50 text-cyan-700',
  [NodeCategory.Aggregator]:  'bg-purple-50 text-purple-700',
  [NodeCategory.Output]:      'bg-green-50 text-green-700',
}

const categoryOrder: NodeCategory[] = [
  NodeCategory.Input,
  NodeCategory.Transformer,
  NodeCategory.Restructure,
  NodeCategory.Aggregator,
  NodeCategory.Output,
]

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'operators' | 'toolbar' | 'workflow'>('operators')

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
            ['toolbar', '工具栏 & 快捷键'],
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
          ) : activeTab === 'toolbar' ? (
            <ToolbarTab />
          ) : (
            <WorkflowTab />
          )}
        </div>
      </div>
    </div>
  )
}

function ToolbarTab() {
  const sections: {
    title: string
    rows: { label: string | ReactNode; desc: string }[]
  }[] = [
    {
      title: '历史操作',
      rows: [
        { label: '↩ 撤销', desc: '撤销最近一次节点/连线的增删移动操作（最多 50 步）' },
        { label: '↪ 重做', desc: '恢复刚才撤销的操作' },
      ],
    },
    {
      title: '流程执行',
      rows: [
        { label: '▶ 执行', desc: '按拓扑顺序依次执行所有节点。执行中节点边框蓝色闪烁，成功后变绿，出错变红。连线上会显示流过的数据行数' },
      ],
    },
    {
      title: '画布布局',
      rows: [
        { label: '⊞ 整理布局', desc: '使用 Dagre 自动计算节点位置并以动画过渡，避免节点堆叠' },
        { label: '曲线 / 折线 / 精确路由', desc: '切换连线渲染模式：曲线为贝塞尔曲线；折线为直角折线，减少穿越；精确路由需先点击「整理布局」后生效，Dagre 计算的最优路径' },
      ],
    },
    {
      title: '结果下载',
      rows: [
        { label: '合并下载', desc: '将所有 Excel 输出节点的数据合并到一个 Excel 文件中，每个节点对应一个 Sheet（Sheet 名取自节点配置）' },
        { label: '全部单独下载', desc: '批量点击每个 Excel 输出节点的独立下载逻辑，每个节点各自输出一个文件（支持拆分导出配置）' },
      ],
    },
    {
      title: '模板管理',
      rows: [
        { label: '导出模板', desc: '将当前全部节点、连线、规则配置保存为 .flow.json 文件，方便复用和分享' },
        { label: '导入模板', desc: '从 .flow.json 文件恢复完整流程图（会覆盖当前画布，操作前建议先导出备份）' },
      ],
    },
  ]

  type ShortcutGroup = {
    group: string
    rows: { keys: ReactNode; desc: string }[]
  }

  const shortcutGroups: ShortcutGroup[] = [
    {
      group: '历史操作',
      rows: [
        { keys: <><Kbd>{MOD}</Kbd><Sep/><Kbd>Z</Kbd></>, desc: '撤销（最多 50 步）' },
        {
          keys: (
            <>
              <Kbd>{MOD}</Kbd><Sep/><Kbd>Y</Kbd>
              <span className="text-gray-400 mx-1.5 text-[10px]">或</span>
              <Kbd>{MOD}</Kbd><Sep/><Kbd>⇧ Shift</Kbd><Sep/><Kbd>Z</Kbd>
            </>
          ),
          desc: '重做',
        },
      ],
    },
    {
      group: '流程执行',
      rows: [
        { keys: <><Kbd>{MOD}</Kbd><Sep/><Kbd>↵ Enter</Kbd></>, desc: '触发执行（等同于点击工具栏「▶ 执行」按钮，执行中再次按下无效）' },
      ],
    },
    {
      group: '节点操作',
      rows: [
        { keys: <><Kbd>{MOD}</Kbd><Sep/><Kbd>C</Kbd></>, desc: '复制选中节点（不含连线）' },
        { keys: <><Kbd>{MOD}</Kbd><Sep/><Kbd>V</Kbd></>, desc: '在鼠标当前位置粘贴节点' },
        { keys: <Kbd>Backspace</Kbd>, desc: '删除选中的节点或连线' },
        { keys: <Kbd>右键 节点</Kbd>, desc: '弹出上下文菜单（复制 / 粘贴 / 删除）' },
        { keys: <Kbd>右键 空白处</Kbd>, desc: '在鼠标位置粘贴剪贴板中的节点' },
      ],
    },
    {
      group: '画布操作',
      rows: [
        { keys: <Kbd>点击 连线</Kbd>, desc: '选中连线（高亮为紫色），再按 Backspace 删除' },
        { keys: <Kbd>点击 空白</Kbd>, desc: '取消选中，关闭右侧属性面板' },
        { keys: <Kbd>滚轮 Scroll</Kbd>, desc: '放大 / 缩小画布' },
        { keys: <><Kbd>Space</Kbd><span className="text-gray-400 mx-1 text-[10px]">+</span>拖拽</>, desc: '平移画布' },
        {
          keys: <><Kbd>⇧ Shift</Kbd><span className="text-gray-400 mx-1 text-[10px]">+</span>拖拽</>,
          desc: '框选多个节点（任何模式下均可用，无需切换工具栏）',
        },
        {
          keys: <><Kbd>{MOD}</Kbd><Sep/><Kbd>点击 节点</Kbd></>,
          desc: '追加选中单个节点（可与框选组合使用）',
        },
      ],
    },
    {
      group: '多节点对齐',
      rows: [
        {
          keys: <><Kbd>⇧ Shift</Kbd><span className="text-gray-400 mx-1 text-[10px]">+</span>拖拽框选<span className="mx-1 text-gray-400">→</span>工具栏对齐按钮</>,
          desc: '先框选 2 个以上节点，工具栏会自动出现「对齐」工具条，支持左 / 水平居中 / 右 / 上 / 垂直居中 / 下 共 6 种对齐',
        },
        {
          keys: <Kbd>工具栏 ✋/⬚ 按钮</Kbd>,
          desc: '切换拖拽模式与框选模式；框选模式下直接拖动即可框选，无需按 Shift',
        },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      {sections.map((sec) => (
        <div key={sec.title}>
          <h3 className="text-sm font-bold text-gray-700 mb-2">{sec.title}</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {sec.rows.map((row, i) => (
              <div
                key={i}
                className={`flex gap-3 px-4 py-2.5 text-xs ${i < sec.rows.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded whitespace-nowrap self-start">
                  {row.label}
                </span>
                <span className="text-gray-600">{row.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-700">键盘快捷键</h3>
          <span className="text-[10px] text-gray-400">
            当前系统：{isMac ? 'macOS（⌘ = Command）' : 'Windows / Linux（Ctrl）'}
          </span>
        </div>
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3">
          ⚠ 当焦点在输入框、下拉框等表单元素内时，快捷键不会触发，避免干扰正常输入。
        </p>
        <div className="space-y-4">
          {shortcutGroups.map((sg) => (
            <div key={sg.group}>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{sg.group}</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {sg.rows.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-2 text-xs ${i < sg.rows.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="flex items-center gap-0.5 min-w-[200px] flex-shrink-0">{s.keys}</div>
                    <span className="text-gray-600">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
  const [activeCategory, setActiveCategory] = useState<NodeCategory>(grouped[0]?.category ?? NodeCategory.Input)

  const current = grouped.find((g) => g.category === activeCategory) ?? grouped[0]

  return (
    <div>
      {/* 分类子 Tab */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {grouped.map((group) => (
          <button
            key={group.category}
            onClick={() => setActiveCategory(group.category)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
              activeCategory === group.category
                ? `${categoryTabActive[group.category]} border-transparent`
                : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <span className={`w-2 h-2 rounded-full ${categoryColors[group.category]}`} />
            {group.label}
            <span className="opacity-60">({group.operators.length})</span>
          </button>
        ))}
      </div>

      {/* 当前分类的算子列表 */}
      {current && (
        <div className="space-y-4">
          {current.operators.map((op) => {
            const help = operatorHelpMap[op.type]
            if (!help) return null

            return (
              <div key={op.type} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] text-white px-1.5 py-0.5 rounded ${categoryColors[current.category]}`}>
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

                {help.functions && help.functions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-medium text-gray-500 mb-2">支持的函数</p>
                    <div className="border border-gray-100 rounded-lg overflow-hidden">
                      {help.functions.map((fn, i) => (
                        <div
                          key={fn.name}
                          className={`px-3 py-2 text-xs ${i < help.functions!.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <code className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
                              {fn.signature}
                            </code>
                            <span className="text-gray-600">{fn.desc}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400">示例：</span>
                            <code className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              {fn.example}
                            </code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
      desc: '从节点底部的输出接口拖线到下一个节点顶部的输入接口，建立数据流方向。Join 节点顶部有两个输入口（左 30% = 左表，右 70% = 右表）。',
    },
    {
      title: '3. 配置规则',
      desc: '点击画布上的节点，在右侧属性面板中配置具体参数（如阶梯档位、关联键等）。',
    },
    {
      title: '4. 加载数据',
      desc: '选中 Excel 输入节点，在右侧面板上传 Excel 文件并选择目标 Sheet，可勾选需要参与流程的列。',
    },
    {
      title: '5. 执行计算',
      desc: '点击顶部工具栏的「▶ 执行」按钮，系统会按拓扑顺序依次执行所有节点。执行中节点边框蓝色闪烁，成功后变绿，出错变红。连线上会显示流过的数据行数。',
    },
    {
      title: '6. 下载结果',
      desc: '执行完成后，点击节点右上角的下载按钮单独导出，或使用工具栏「合并下载」（所有输出节点合并到一个 Excel 多 Sheet）、「全部单独下载」（每个节点各自一个文件）。',
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
