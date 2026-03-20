import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlowStore } from '@/store/useFlowStore'
import { importTemplate } from '@/utils/templateIO'
import { SimpleModePanel } from '@/components/SimpleModePanel'
import { HelpDialog } from '@/components/HelpDialog'
import type { FlowNodeData } from '@/types'
import type { Node } from '@xyflow/react'

/**
 * /run 路由：锁定简洁执行模式
 * - 无法切换回设计视图
 * - 工具栏仅保留：标题、导入模板、帮助
 * - 导航栏有「前往设计视图」入口（可选）
 */
export function RunPage() {
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const setNodes = useFlowStore((s) => s.setNodes)
  const setEdges = useFlowStore((s) => s.setEdges)
  const setViewMode = useFlowStore((s) => s.setViewMode)
  const nodes = useFlowStore((s) => s.nodes)

  // 进入此路由时强制 simple 模式，离开时不重置（设计视图自己管自己）
  useEffect(() => {
    setViewMode('simple')
  }, [setViewMode])

  const hasFlow = nodes.length > 0

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
      {/* 精简顶栏 */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
        <h1 className="text-sm font-bold text-gray-800 whitespace-nowrap">
          Excel 数据流结算引擎
        </h1>
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full whitespace-nowrap">
          ⚡ 运行模式
        </span>

        <div className="flex-1" />

        {/* 导入模板 */}
        <button
          onClick={() => importRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors whitespace-nowrap"
        >
          导入模板
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />

        {/* 分隔线 */}
        <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

        {/* 跳转到设计视图（开发者入口，可选保留） */}
        <button
          onClick={() => navigate('/')}
          title="切换到完整设计视图（需要了解流程图）"
          className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors whitespace-nowrap"
        >
          🎨 设计视图
        </button>

        <button
          onClick={() => setHelpOpen(true)}
          className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors whitespace-nowrap"
        >
          ? 帮助
        </button>

        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </header>

      {/* 主体：空状态 or 执行面板 */}
      {hasFlow ? (
        <SimpleModePanel hideHeader />
      ) : (
        <EmptyState onImport={() => importRef.current?.click()} />
      )}
    </div>
  )
}

// ── 空状态引导 ───────────────────────────────────────────────
function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-3xl">
        ⚡
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800">欢迎使用运行模式</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          请导入一个流程模板，然后上传数据文件，一键执行并下载结果
        </p>
      </div>
      <button
        onClick={onImport}
        className="px-6 py-3 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all"
      >
        📂 导入模板开始
      </button>
      <p className="text-xs text-gray-400">
        支持 .flow.json 格式的模板文件
      </p>
    </div>
  )
}
