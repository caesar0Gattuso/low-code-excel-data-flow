import type { DataTable, FilterConfig } from '@/types'

export function executeFilter(input: DataTable, config: FilterConfig): DataTable {
  const { column, operator, value } = config

  const rows = input.rows.filter((row) => {
    const cellVal = row[column]
    const numCell = Number(cellVal)
    const numValue = Number(value)
    const useNumeric = !isNaN(numCell) && !isNaN(numValue)

    switch (operator) {
      case '>':
        return useNumeric ? numCell > numValue : String(cellVal) > String(value)
      case '>=':
        return useNumeric ? numCell >= numValue : String(cellVal) >= String(value)
      case '<':
        return useNumeric ? numCell < numValue : String(cellVal) < String(value)
      case '<=':
        return useNumeric ? numCell <= numValue : String(cellVal) <= String(value)
      case '==':
        return useNumeric ? numCell === numValue : String(cellVal) === String(value)
      case '!=':
        return useNumeric ? numCell !== numValue : String(cellVal) !== String(value)
      default:
        return true
    }
  })

  return { columns: input.columns, rows }
}
