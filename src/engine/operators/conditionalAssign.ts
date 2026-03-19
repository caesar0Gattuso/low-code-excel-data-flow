import type { DataTable, ConditionalAssignConfig, DataRow, CompareOperator } from '@/types'

export function executeConditionalAssign(input: DataTable, config: ConditionalAssignConfig): DataTable {
  const { rules, defaultValue, outputColumn } = config

  const rows: DataRow[] = input.rows.map((row) => {
    let result: number | string = defaultValue

    for (const rule of rules) {
      const cellVal = row[rule.column]
      if (compare(cellVal, rule.operator, rule.compareValue)) {
        result = rule.result
        break
      }
    }

    return { ...row, [outputColumn]: result }
  })

  const columns = input.columns.includes(outputColumn)
    ? input.columns
    : [...input.columns, outputColumn]

  return { columns, rows }
}

function compare(cellVal: unknown, operator: CompareOperator, compareValue: number | string): boolean {
  const numCell = Number(cellVal)
  const numCompare = Number(compareValue)
  const useNumeric = !isNaN(numCell) && !isNaN(numCompare)

  switch (operator) {
    case '>':
      return useNumeric ? numCell > numCompare : String(cellVal) > String(compareValue)
    case '>=':
      return useNumeric ? numCell >= numCompare : String(cellVal) >= String(compareValue)
    case '<':
      return useNumeric ? numCell < numCompare : String(cellVal) < String(compareValue)
    case '<=':
      return useNumeric ? numCell <= numCompare : String(cellVal) <= String(compareValue)
    case '==':
      return useNumeric ? numCell === numCompare : String(cellVal) === String(compareValue)
    case '!=':
      return useNumeric ? numCell !== numCompare : String(cellVal) !== String(compareValue)
    default:
      return false
  }
}
