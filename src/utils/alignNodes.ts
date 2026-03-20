import type { Node } from '@xyflow/react'
import type { FlowNodeData } from '@/types'

const DEFAULT_WIDTH = 200
const DEFAULT_HEIGHT = 80

function dims(node: Node<FlowNodeData>) {
  const w = (node.measured?.width ?? (node as { width?: number }).width) ?? DEFAULT_WIDTH
  const h = (node.measured?.height ?? (node as { height?: number }).height) ?? DEFAULT_HEIGHT
  return { w, h }
}

export type AlignDirection =
  | 'left'       // 左对齐
  | 'centerH'    // 水平居中（中心 X 对齐）
  | 'right'      // 右对齐
  | 'top'        // 上对齐
  | 'centerV'    // 垂直居中（中心 Y 对齐）
  | 'bottom'     // 下对齐

/**
 * 对所有 selected 节点进行对齐，返回更新后的完整 nodes 数组。
 * 不影响未选中节点。
 */
export function alignNodes(
  nodes: Node<FlowNodeData>[],
  direction: AlignDirection,
): Node<FlowNodeData>[] {
  const sel = nodes.filter((n) => n.selected)
  if (sel.length < 2) return nodes

  const boxes = sel.map((n) => {
    const { w, h } = dims(n)
    return { id: n.id, x: n.position.x, y: n.position.y, w, h }
  })

  switch (direction) {
    case 'left': {
      const anchor = Math.min(...boxes.map((b) => b.x))
      return nodes.map((n) =>
        n.selected ? { ...n, position: { ...n.position, x: anchor } } : n,
      )
    }
    case 'right': {
      const anchor = Math.max(...boxes.map((b) => b.x + b.w))
      return nodes.map((n) => {
        if (!n.selected) return n
        return { ...n, position: { ...n.position, x: anchor - dims(n).w } }
      })
    }
    case 'top': {
      const anchor = Math.min(...boxes.map((b) => b.y))
      return nodes.map((n) =>
        n.selected ? { ...n, position: { ...n.position, y: anchor } } : n,
      )
    }
    case 'bottom': {
      const anchor = Math.max(...boxes.map((b) => b.y + b.h))
      return nodes.map((n) => {
        if (!n.selected) return n
        return { ...n, position: { ...n.position, y: anchor - dims(n).h } }
      })
    }
    case 'centerH': {
      // 所有选中节点的中心 X 统一到同一点（取最左和最右中点）
      const minX = Math.min(...boxes.map((b) => b.x))
      const maxX = Math.max(...boxes.map((b) => b.x + b.w))
      const cx = (minX + maxX) / 2
      return nodes.map((n) => {
        if (!n.selected) return n
        return { ...n, position: { ...n.position, x: cx - dims(n).w / 2 } }
      })
    }
    case 'centerV': {
      const minY = Math.min(...boxes.map((b) => b.y))
      const maxY = Math.max(...boxes.map((b) => b.y + b.h))
      const cy = (minY + maxY) / 2
      return nodes.map((n) => {
        if (!n.selected) return n
        return { ...n, position: { ...n.position, y: cy - dims(n).h / 2 } }
      })
    }
  }
}
