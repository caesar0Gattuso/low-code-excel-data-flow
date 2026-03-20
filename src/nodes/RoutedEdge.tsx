import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react'

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
  labelX,
  labelY,
}: EdgeProps) {
  const waypoints = (data as Record<string, unknown> | undefined)?.waypoints as Waypoint[] | undefined

  let edgePath: string

  if (waypoints && waypoints.length > 0) {
    // 拼接 source → waypoints → target 的完整路径
    edgePath = waypointsToPath([{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }])
  } else {
    // 无 waypoints 时降级为默认贝塞尔
    const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    edgePath = path
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="absolute text-[10px] bg-white px-1 rounded pointer-events-none"
          >
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
