import type { DataTable, TierRuleV2Config, DataRow } from '@/types'

/**
 * 阶梯规则V2：按主列匹配阶梯档位后，将规则表中匹配行的所有列值追加到原始行。
 * 与 V1 的区别：V1 只输出一个 value 列，V2 输出规则表中除 min/max 外的全部列。
 */
export function executeTierRuleV2(input: DataTable, config: TierRuleV2Config): DataTable {
  const { inputColumn, minColumn, maxColumn, ruleTable } = config

  if (!ruleTable || ruleTable.rows.length === 0) {
    return input
  }

  const outputCols = ruleTable.columns.filter(
    (c) => c !== minColumn && c !== maxColumn,
  )

  const sortedRules = [...ruleTable.rows].sort(
    (a, b) => (Number(a[minColumn]) || 0) - (Number(b[minColumn]) || 0),
  )

  const rows: DataRow[] = input.rows.map((row) => {
    const val = Number(row[inputColumn]) || 0
    let matched: DataRow | null = null

    for (const rule of sortedRules) {
      const min = Number(rule[minColumn]) || 0
      const max = rule[maxColumn]
      const maxNum = (max === null || max === undefined || max === '' || isNaN(Number(max)))
        ? null
        : Number(max)

      if (val >= min && (maxNum === null || val < maxNum)) {
        matched = rule
        break
      }
    }

    const newRow: DataRow = { ...row }
    for (const col of outputCols) {
      newRow[col] = matched ? matched[col] ?? '' : ''
    }
    return newRow
  })

  const columns = [...input.columns]
  for (const col of outputCols) {
    if (!columns.includes(col)) {
      columns.push(col)
    }
  }

  return { columns, rows }
}
