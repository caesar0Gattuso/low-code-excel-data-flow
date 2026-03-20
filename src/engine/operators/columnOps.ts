import type { DataTable, ColumnOpsConfig } from '@/types'

export function executeColumnOps(table: DataTable, config: ColumnOpsConfig): DataTable {
  const { columns } = config
  if (!columns || columns.length === 0) return table

  const outputColumns = columns.map((c) => c.output)
  const rows = table.rows.map((row) => {
    const newRow: Record<string, unknown> = {}
    for (const col of columns) {
      newRow[col.output] = row[col.source]
    }
    return newRow
  })

  return { columns: outputColumns, rows }
}
