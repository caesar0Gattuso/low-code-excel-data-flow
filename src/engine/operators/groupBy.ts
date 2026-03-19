import type { DataTable, GroupByConfig, DataRow } from '@/types'
import { fixFloat } from '@/utils/precision'
import { smartCompare } from '@/utils/compare'

export function executeGroupBy(input: DataTable, config: GroupByConfig): DataTable {
  const { groupByColumns, aggregations } = config

  const groups = new Map<string, DataRow[]>()

  for (const row of input.rows) {
    const key = groupByColumns.map((c) => String(row[c] ?? '')).join('||')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  const outputColumns = [
    ...groupByColumns,
    ...aggregations.map((a) => a.outputColumn),
  ]

  const rows: DataRow[] = []
  for (const [, groupRows] of groups) {
    const resultRow: DataRow = {}

    for (const col of groupByColumns) {
      resultRow[col] = groupRows[0][col]
    }

    for (const agg of aggregations) {
      if (agg.func === 'countif') {
        const op = agg.operator ?? '=='
        const cmpVal = agg.compareValue ?? ''
        resultRow[agg.outputColumn] = groupRows.filter(
          (r) => smartCompare(r[agg.column], op, cmpVal, r),
        ).length
        continue
      }

      const values = groupRows.map((r) => Number(r[agg.column]) || 0)
      switch (agg.func) {
        case 'sum':
          resultRow[agg.outputColumn] = fixFloat(values.reduce((a, b) => a + b, 0))
          break
        case 'count':
          resultRow[agg.outputColumn] = groupRows.length
          break
        case 'avg':
          resultRow[agg.outputColumn] =
            values.length > 0 ? fixFloat(values.reduce((a, b) => a + b, 0) / values.length) : 0
          break
        case 'min':
          resultRow[agg.outputColumn] = Math.min(...values)
          break
        case 'max':
          resultRow[agg.outputColumn] = Math.max(...values)
          break
      }
    }

    rows.push(resultRow)
  }

  return { columns: outputColumns, rows }
}
