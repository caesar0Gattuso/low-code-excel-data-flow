import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

const NODE_WIDTH = 200
const NODE_HEIGHT = 80
const RANK_SEP = 80   // 层与层之间的水平间距
const NODE_SEP = 40   // 同层节点间的垂直间距

export type WaypointMap = Record<string, { x: number; y: number }[]>

/**
 * 用 Dagre 计算有向图的自动布局
 * @returns nodePositions  nodeId -> { x, y }（React Flow 左上角坐标）
 * @returns edgeWaypoints  edgeId -> waypoints[]（精确路由模式用）
 */
export function calcAutoLayout(
  nodes: Node[],
  edges: Edge[],
): {
  nodePositions: Record<string, { x: number; y: number }>
  edgeWaypoints: WaypointMap
} {
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'LR',
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40,
  })

  for (const node of nodes) {
    g.setNode(node.id, {
      width: node.measured?.width ?? NODE_WIDTH,
      height: node.measured?.height ?? NODE_HEIGHT,
    })
  }

  // 用边 id 作为 name，方便后续按 id 读取 waypoints
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target, {}, edge.id)
  }

  dagre.layout(g)

  // 节点位置（中心坐标 → 左上角）
  const nodePositions: Record<string, { x: number; y: number }> = {}
  for (const node of nodes) {
    const pos = g.node(node.id)
    if (pos) {
      const w = node.measured?.width ?? NODE_WIDTH
      const h = node.measured?.height ?? NODE_HEIGHT
      nodePositions[node.id] = { x: pos.x - w / 2, y: pos.y - h / 2 }
    } else {
      nodePositions[node.id] = { ...node.position }
    }
  }

  // 边 waypoints（Dagre 返回的是画布绝对坐标中间折点）
  const edgeWaypoints: WaypointMap = {}
  for (const edge of edges) {
    try {
      const dagreEdge = g.edge({ v: edge.source, w: edge.target, name: edge.id })
      if (dagreEdge?.points?.length) {
        edgeWaypoints[edge.id] = dagreEdge.points.map((p: { x: number; y: number }) => ({
          x: p.x,
          y: p.y,
        }))
      }
    } catch {
      // 边不存在于图中时忽略
    }
  }

  return { nodePositions, edgeWaypoints }
}

/** easeInOut 缓动函数 */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/**
 * 将节点从当前位置平滑动画到目标位置（仅处理节点，不涉及边）
 */
export function animateToLayout(
  nodes: Node[],
  nodePositions: Record<string, { x: number; y: number }>,
  setNodes: (nodes: Node[]) => void,
  duration = 400,
) {
  const startPositions: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) {
    startPositions[n.id] = { ...n.position }
  }

  const startTime = performance.now()

  function frame(now: number) {
    const elapsed = now - startTime
    const t = Math.min(elapsed / duration, 1)
    const ease = easeInOut(t)

    const updated = nodes.map((n) => {
      const from = startPositions[n.id]
      const to = nodePositions[n.id] ?? from
      return {
        ...n,
        position: {
          x: from.x + (to.x - from.x) * ease,
          y: from.y + (to.y - from.y) * ease,
        },
      }
    })

    setNodes(updated as Node[])
    if (t < 1) requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
