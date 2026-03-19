import type { DataTable, ConstraintConfig } from '@/types'

export function executeConstraint(input: DataTable, config: ConstraintConfig): DataTable {
  const { column, min, max } = config

  const rows = input.rows.map((row) => {
    let val = Number(row[column]) || 0
    if (min !== undefined && val < min) val = min
    if (max !== undefined && val > max) val = max
    return { ...row, [column]: val }
  })

  return { columns: input.columns, rows }
}
