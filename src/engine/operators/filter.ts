import type { DataTable, FilterConfig } from '@/types'
import { smartCompare } from '@/utils/compare'

export function executeFilter(input: DataTable, config: FilterConfig): DataTable {
  const { column, operator, value } = config

  const rows = input.rows.filter((row) => {
    return smartCompare(row[column], operator, value, row)
  })

  return { columns: input.columns, rows }
}
