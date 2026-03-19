import type {
  SerializedNode,
  SerializedEdge,
  DataTable,
  OperatorType,
  TierRuleConfig,
  FormulaConfig,
  FilterConfig,
  ConstraintConfig,
  ConditionalAssignConfig,
  TierRuleV2Config,
  JoinConfig,
  GroupByConfig,
  ExcelOutputConfig,
  DataRow,
} from '@/types'
import {
  executeTierRule,
  executeTierRuleV2,
  executeFormula,
  executeFilter,
  executeConstraint,
  executeConditionalAssign,
  executeJoin,
  executeGroupBy,
} from './operators'

interface ExecutionResult {
  previews: Record<string, DataTable>
  inputPreviews: Record<string, DataTable>
  outputs: Record<string, DataTable>
}

/**
 * 基于拓扑排序的 DAG 执行器。
 * 按顺序执行每个节点，将上游输出传递给下游输入。
 */
export function executeDAG(
  nodes: SerializedNode[],
  edges: SerializedEdge[],
  inputData: Record<string, DataTable>,
  onProgress?: (nodeId: string, status: 'running' | 'done') => void,
): ExecutionResult {
  const sorted = topologicalSort(nodes, edges)
  const nodeOutputs: Record<string, DataTable> = {}
  const previews: Record<string, DataTable> = {}
  const inputPreviews: Record<string, DataTable> = {}
  const finalOutputs: Record<string, DataTable> = {}

  for (const nodeId of sorted) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) continue

    onProgress?.(nodeId, 'running')

    const opType = node.data.operatorType as OperatorType
    const config = node.data.config

    const incomingEdges = edges.filter((e) => e.target === nodeId)

    if (opType === 'excelInput') {
      const data = inputData[nodeId]
      if (data) {
        nodeOutputs[nodeId] = data
      } else {
        nodeOutputs[nodeId] = { columns: [], rows: [] }
      }
    } else if (opType === 'join') {
      const leftEdge = incomingEdges.find((e) => e.targetHandle === 'left') ?? incomingEdges[0]
      const rightEdge = incomingEdges.find((e) => e.targetHandle === 'right') ?? incomingEdges[1]
      const leftData = leftEdge ? nodeOutputs[leftEdge.source] : undefined
      const rightData = rightEdge ? nodeOutputs[rightEdge.source] : undefined

      if (leftData) {
        inputPreviews[nodeId] = { columns: leftData.columns, rows: leftData.rows.slice(0, 100) }
      }

      if (leftData && rightData) {
        nodeOutputs[nodeId] = executeJoin(leftData, rightData, config as JoinConfig)
      } else {
        nodeOutputs[nodeId] = leftData ?? rightData ?? { columns: [], rows: [] }
      }
    } else {
      const inputEdge = incomingEdges[0]
      const inputTable = inputEdge ? nodeOutputs[inputEdge.source] : { columns: [], rows: [] }

      inputPreviews[nodeId] = { columns: inputTable.columns, rows: inputTable.rows.slice(0, 100) }

      switch (opType) {
        case 'tierRule':
          nodeOutputs[nodeId] = executeTierRule(inputTable, config as TierRuleConfig)
          break
        case 'tierRuleV2':
          nodeOutputs[nodeId] = executeTierRuleV2(inputTable, config as TierRuleV2Config)
          break
        case 'formula':
          nodeOutputs[nodeId] = executeFormula(inputTable, config as FormulaConfig)
          break
        case 'filter':
          nodeOutputs[nodeId] = executeFilter(inputTable, config as FilterConfig)
          break
        case 'constraint':
          nodeOutputs[nodeId] = executeConstraint(inputTable, config as ConstraintConfig)
          break
        case 'conditionalAssign':
          nodeOutputs[nodeId] = executeConditionalAssign(inputTable, config as ConditionalAssignConfig)
          break
        case 'groupBy':
          nodeOutputs[nodeId] = executeGroupBy(inputTable, config as GroupByConfig)
          break
        case 'excelOutput': {
          const outConfig = config as ExcelOutputConfig
          const selCols = outConfig.selectedColumns
          if (selCols && selCols.length > 0 && selCols.length < inputTable.columns.length) {
            const colSet = new Set(selCols)
            const filteredCols = inputTable.columns.filter((c) => colSet.has(c))
            const filteredRows: DataRow[] = inputTable.rows.map((row) => {
              const r: DataRow = {}
              for (const c of filteredCols) r[c] = row[c]
              return r
            })
            const filtered: DataTable = { columns: filteredCols, rows: filteredRows }
            nodeOutputs[nodeId] = filtered
            finalOutputs[nodeId] = filtered
          } else {
            nodeOutputs[nodeId] = inputTable
            finalOutputs[nodeId] = inputTable
          }
          break
        }
        default:
          nodeOutputs[nodeId] = inputTable
      }
    }

    const output = nodeOutputs[nodeId]
    if (output) {
      previews[nodeId] = {
        columns: output.columns,
        rows: output.rows.slice(0, 100),
      }
    }

    onProgress?.(nodeId, 'done')
  }

  return { previews, inputPreviews, outputs: finalOutputs }
}

/**
 * Kahn's algorithm: 对 DAG 进行拓扑排序。
 * 如果发现环形依赖则抛出异常。
 */
function topologicalSort(nodes: SerializedNode[], edges: SerializedEdge[]): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    sorted.push(nodeId)
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('检测到环形依赖！请检查节点连线。')
  }

  return sorted
}
