import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath, getSmoothStepPath } from '@xyflow/react'
import { useState } from 'react'
import { useFlowStore } from '@/store/useFlowStore'

type Waypoint = { x: number; y: number }

/** 将折点序列转成带圆角的 SVG path */
function waypointsToPath(points: Waypoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  const R = 6 // 圆角半径
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const next = points[i + 1]

    // 向前方向单位向量
    const dx1 = cur.x - prev.x
    const dy1 = cur.y - prev.y
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1
    // 向后方向单位向量
    const dx2 = next.x - cur.x
    const dy2 = next.y - cur.y
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1

    const r = Math.min(R, len1 / 2, len2 / 2)
    const bx = cur.x - (dx1 / len1) * r
    const by = cur.y - (dy1 / len1) * r
    const cx = cur.x + (dx2 / len2) * r
    const cy = cur.y + (dy2 / len2) * r

    parts.push(`L ${bx} ${by}`)
    parts.push(`Q ${cur.x} ${cur.y} ${cx} ${cy}`)
  }

  const last = points[points.length - 1]
  parts.push(`L ${last.x} ${last.y}`)
  return parts.join(' ')
}

export function RoutedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
  label,
  type,
  selected,
}: EdgeProps) {
  const rowCount = useFlowStore((s) => s.edgeRowCountMap[id])
  const [hovered, setHovered] = useState(false)
  const waypoints = (data as Record<string, unknown> | undefined)?.waypoints as Waypoint[] | undefined

  let edgePath: string
  let midX: number
  let midY: number

  if (type === 'routed' && waypoints && waypoints.length > 0) {
    edgePath = waypointsToPath([{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }])
    const mid = waypoints[Math.floor(waypoints.length / 2)]
    midX = mid.x
    midY = mid.y
  } else if (type === 'smoothstep') {
    const [path, mx, my] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    edgePath = path
    midX = mx
    midY = my
  } else {
    const [path, mx, my] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    edgePath = path
    midX = mx
    midY = my
  }

  const isActive = hovered || selected
  const edgeStyle = {
    ...style,
    strokeWidth: isActive ? 3 : (style?.strokeWidth ?? 2),
    stroke: isActive ? '#6366f1' : (style?.stroke ?? '#94a3b8'),
    transition: 'stroke 0.15s, stroke-width 0.15s',
  }

  return (
    <>
      {/* 透明加宽的可交互区域（便于鼠标 hover） */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        {/* 自定义 label：使用路径中点定位 */}
        {label && (
          <div
            style={{ transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)` }}
            className="absolute text-[10px] bg-white px-1 rounded pointer-events-none"
          >
            {label as string}
          </div>
        )}
        {/* 行数 badge */}
        {rowCount !== undefined && (
          <div
            style={{ transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)` }}
            className="absolute pointer-events-none"
          >
            <span className="bg-slate-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
              {rowCount.toLocaleString()} 行
            </span>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
