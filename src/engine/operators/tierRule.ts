import type { DataTable, TierRuleConfig, DataRow } from '@/types'

export function executeTierRule(input: DataTable, config: TierRuleConfig): DataTable {
  const { inputColumn, outputColumn, brackets } = config
  const sorted = [...brackets].sort((a, b) => a.min - b.min)

  const rows: DataRow[] = input.rows.map((row) => {
    const val = Number(row[inputColumn]) || 0
    let result: number = 0
    for (const b of sorted) {
      const aboveMin = val >= b.min
      const belowMax = b.max === null || val < b.max
      if (aboveMin && belowMax) {
        result = b.value
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
