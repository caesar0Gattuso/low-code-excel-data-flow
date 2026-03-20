import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FlowNodeData, NodeCategory } from '@/types'
import { useFlowStore } from '@/store/useFlowStore'

const categoryColors: Record<NodeCategory, { bg: string; border: string; badge: string }> = {
  input:       { bg: 'bg-blue-50',    border: 'border-blue-400',   badge: 'bg-blue-500' },
  transformer: { bg: 'bg-amber-50',   border: 'border-amber-400',  badge: 'bg-amber-500' },
  restructure: { bg: 'bg-cyan-50',    border: 'border-cyan-400',   badge: 'bg-cyan-500' },
  aggregator:  { bg: 'bg-purple-50',  border: 'border-purple-400', badge: 'bg-purple-500' },
  output:      { bg: 'bg-green-50',   border: 'border-green-400',  badge: 'bg-green-500' },
}

const categoryLabels: Record<NodeCategory, string> = {
  input:       '输入',
  transformer: '加工',
  restructure: '整理',
  aggregator:  '聚合',
  output:      '输出',
}

/** 执行状态 → 边框覆盖样式 */
const statusBorder: Record<string, string> = {
  running: 'border-blue-400 animate-pulse',
  success: 'border-green-500',
  error: 'border-red-500',
}

/** 执行状态 → 右上角角标 */
const statusBadge: Record<string, { cls: string; icon: string }> = {
  running: { cls: 'bg-blue-500', icon: '…' },
  success: { cls: 'bg-green-500', icon: '✓' },
  error: { cls: 'bg-red-500', icon: '✕' },
}

const handleBase = '!w-3 !h-3 transition-opacity'
const handleDisabled = '!bg-gray-300 !border-gray-300 opacity-30 !cursor-not-allowed'

export function BaseNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const previewMap = useFlowStore((s) => s.previewMap)
  const inputPreviewMap = useFlowStore((s) => s.inputPreviewMap)
  const outputMap = useFlowStore((s) => s.outputMap)
  const previewTotals = useFlowStore((s) => s.previewTotals)
  const setPreviewNodeId = useFlowStore((s) => s.setPreviewNodeId)
  const edges = useFlowStore((s) => s.edges)
  const nodeStatusMap = useFlowStore((s) => s.nodeStatusMap)
  const preview = previewMap[id]
  const inputPreview = inputPreviewMap[id]
  // 输出节点优先用全量数据，中间节点用预览数据
  const fullOutput = outputMap[id]
  const totalRows = previewTotals[id]
  const statusEntry = nodeStatusMap[id]
  const status = statusEntry?.status
  const errorMsg = statusEntry?.errorMsg
  const colors = categoryColors[data.category] ?? categoryColors.transformer
  const hasInput = data.category !== 'input'
  const hasOutput = data.category !== 'output'
  const isJoin = data.operatorType === 'join'

  const inputEdges = hasInput && !isJoin ? edges.filter((e) => e.target === id) : []
  const connectedViaTop = inputEdges.some((e) => e.targetHandle == null)
  const connectedViaLeft = inputEdges.some((e) => e.targetHandle === 'input-left')
  const topDisabled = connectedViaLeft
  const leftDisabled = connectedViaTop

  const borderCls = status ? statusBorder[status] : colors.border

  return (
    <div
      className={`relative rounded-lg border-2 ${borderCls} ${colors.bg} shadow-md min-w-[180px] ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
      }`}
    >
      {/* 执行状态角标 */}
      {status && statusBadge[status] && (
        <span
          title={status === 'error' && errorMsg ? `错误：${errorMsg}` : undefined}
          className={`absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold z-10 ${statusBadge[status].cls} ${status === 'error' ? 'cursor-help' : ''}`}
        >
          {statusBadge[status].icon}
        </span>
      )}

      {/* 输入 handles：上 + 左（互斥） */}
      {hasInput && !isJoin && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            className={`${handleBase} ${topDisabled ? handleDisabled : ''}`}
            isConnectable={!topDisabled}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="input-left"
            className={`${handleBase} ${leftDisabled ? handleDisabled : ''}`}
            isConnectable={!leftDisabled}
            style={{ top: '50%' }}
          />
        </>
      )}

      {/* Join 保持原有双输入 */}
      {isJoin && (
        <>
          <Handle type="target" position={Position.Top} id="left" className={handleBase} style={{ left: '30%' }} />
          <Handle type="target" position={Position.Top} id="right" className={handleBase} style={{ left: '70%' }} />
        </>
      )}

      {/* 节点头部 */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] text-white px-1.5 py-0.5 rounded flex-shrink-0 ${colors.badge}`}>
            {categoryLabels[data.category]}
          </span>
          <span className="text-[10px] text-gray-400 truncate">{data.label}</span>
        </div>
        {data.customName && (
          <div className="mt-1 text-sm font-semibold text-gray-800 truncate" title={data.customName}>
            {data.customName}
          </div>
        )}
      </div>

      {/* 预览信息（可点击全屏预览） */}
      <div
        className={`px-3 py-1.5 text-[11px] ${(preview || fullOutput) ? 'cursor-pointer hover:bg-black/5 transition-colors' : ''}`}
        onClick={() => (preview || fullOutput) && setPreviewNodeId(id)}
        title={(preview || fullOutput) ? '点击查看完整数据' : undefined}
      >
        {(preview || fullOutput) ? (
          <span className="text-gray-500">
            {totalRows !== undefined
              ? (totalRows > (preview?.rows.length ?? 0) && !fullOutput
                  ? `${totalRows.toLocaleString()} 行（预览前 ${preview?.rows.length}）`
                  : `${(fullOutput ?? preview)!.rows.length.toLocaleString()} 行`)
              : `${(fullOutput ?? preview)!.rows.length.toLocaleString()} 行`}
            {' '}× {(fullOutput ?? preview)!.columns.length} 列
            <span className="ml-1 text-indigo-400 text-[10px]">↗</span>
          </span>
        ) : (
          <span className="italic text-gray-400">未执行</span>
        )}
      </div>

      {/* 节点备注 */}
      {data.note && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-gray-500 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 leading-snug whitespace-pre-wrap line-clamp-3" title={data.note}>
            📝 {data.note}
          </p>
        </div>
      )}

      {/* 错误信息 */}
      {status === 'error' && errorMsg && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-red-500 bg-red-50 rounded px-2 py-1 leading-snug line-clamp-2" title={errorMsg}>
            {errorMsg}
          </p>
        </div>
      )}

      {/* 输出 handles：下 + 右 */}
      {hasOutput && (
        <>
          <Handle type="source" position={Position.Bottom} className={handleBase} />
          <Handle type="source" position={Position.Right} id="output-right" className={handleBase} style={{ top: '50%' }} />
        </>
      )}
    </div>
  )
}
