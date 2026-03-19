import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FlowNodeData, NodeCategory } from '@/types'
import { useFlowStore } from '@/store/useFlowStore'

const categoryColors: Record<NodeCategory, { bg: string; border: string; badge: string }> = {
  input: { bg: 'bg-blue-50', border: 'border-blue-400', badge: 'bg-blue-500' },
  transformer: { bg: 'bg-amber-50', border: 'border-amber-400', badge: 'bg-amber-500' },
  aggregator: { bg: 'bg-purple-50', border: 'border-purple-400', badge: 'bg-purple-500' },
  output: { bg: 'bg-green-50', border: 'border-green-400', badge: 'bg-green-500' },
}

const categoryLabels: Record<NodeCategory, string> = {
  input: '输入',
  transformer: '转换',
  aggregator: '聚合',
  output: '输出',
}

const handleBase = '!w-3 !h-3 transition-opacity'
const handleDisabled = '!bg-gray-300 !border-gray-300 opacity-30 !cursor-not-allowed'

export function BaseNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const previewMap = useFlowStore((s) => s.previewMap)
  const edges = useFlowStore((s) => s.edges)
  const preview = previewMap[id]
  const colors = categoryColors[data.category] ?? categoryColors.transformer
  const hasInput = data.category !== 'input'
  const hasOutput = data.category !== 'output'
  const isJoin = data.operatorType === 'join'

  const inputEdges = hasInput && !isJoin ? edges.filter((e) => e.target === id) : []
  const connectedViaTop = inputEdges.some((e) => e.targetHandle == null)
  const connectedViaLeft = inputEdges.some((e) => e.targetHandle === 'input-left')
  const topDisabled = connectedViaLeft
  const leftDisabled = connectedViaTop

  return (
    <div
      className={`rounded-lg border-2 ${colors.border} ${colors.bg} shadow-md min-w-[180px] ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
      }`}
    >
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
          <Handle
            type="target"
            position={Position.Top}
            id="left"
            className={handleBase}
            style={{ left: '30%' }}
          />
          <Handle
            type="target"
            position={Position.Top}
            id="right"
            className={handleBase}
            style={{ left: '70%' }}
          />
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

      {/* 预览信息 */}
      <div className="px-3 py-1.5 text-[11px] text-gray-500">
        {preview ? (
          <span>{preview.rows.length} 行 × {preview.columns.length} 列</span>
        ) : (
          <span className="italic">未执行</span>
        )}
      </div>

      {/* 输出 handles：下 + 右（均可用，支持扇出） */}
      {hasOutput && (
        <>
          <Handle type="source" position={Position.Bottom} className={handleBase} />
          <Handle
            type="source"
            position={Position.Right}
            id="output-right"
            className={handleBase}
            style={{ top: '50%' }}
          />
        </>
      )}
    </div>
  )
}
