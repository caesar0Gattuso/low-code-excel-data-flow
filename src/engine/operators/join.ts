import type { DataTable, JoinConfig, DataRow } from '@/types'

export function executeJoin(left: DataTable, right: DataTable, config: JoinConfig): DataTable {
  const { leftKey, rightKey, joinType } = config

  const rightIndex = new Map<string, DataRow[]>()
  for (const row of right.rows) {
    const key = String(row[rightKey] ?? '')
    if (!rightIndex.has(key)) rightIndex.set(key, [])
    rightIndex.get(key)!.push(row)
  }

  const allColumns = Array.from(new Set([...left.columns, ...right.columns]))
  const rows: DataRow[] = []

  for (const lRow of left.rows) {
    const key = String(lRow[leftKey] ?? '')
    const matches = rightIndex.get(key)

    if (matches && matches.length > 0) {
      for (const rRow of matches) {
        rows.push({ ...rRow, ...lRow })
      }
    } else if (joinType === 'left') {
      rows.push({ ...lRow })
    }
  }

  return { columns: allColumns, rows }
}
