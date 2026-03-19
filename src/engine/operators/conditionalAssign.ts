import type { DataTable, ConditionalAssignConfig, ConditionalRule, Condition, DataRow } from '@/types'
import { smartCompare, resolveColumnRef } from '@/utils/compare'

export function executeConditionalAssign(input: DataTable, config: ConditionalAssignConfig): DataTable {
  const { rules, defaultValue, outputColumn } = config
  const debugCol = `_debug_${outputColumn}`

  const rows: DataRow[] = input.rows.map((row) => {
    let result: number | string = resolveColumnRef(defaultValue, row)
    let debugInfo = '兜底'

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]
      const { matched, detail } = matchRuleDebug(row, rule)
      if (matched) {
        result = resolveColumnRef(rule.result, row)
        debugInfo = `规则${i + 1}:命中 (${detail})`
        break
      }
      if (rule.elseResult !== undefined && rule.elseResult !== '') {
        result = resolveColumnRef(rule.elseResult, row)
        debugInfo = `规则${i + 1}:否则 (${detail})`
      }
    }

    return { ...row, [outputColumn]: result, [debugCol]: debugInfo }
  })

  const columns = input.columns.includes(outputColumn)
    ? input.columns
    : [...input.columns, outputColumn]

  const allColumns = columns.includes(debugCol) ? columns : [...columns, debugCol]

  return { columns: allColumns, rows }
}

function describeCondition(row: DataRow, c: Condition): string {
  const left = row[c.column]
  const right = resolveColumnRef(c.compareValue, row)
  const result = smartCompare(left, c.operator, c.compareValue, row)
  return `${c.column}(${left ?? 'undefined'})${c.operator}${right}→${result ? 'T' : 'F'}`
}

function matchRuleDebug(row: DataRow, rule: ConditionalRule): { matched: boolean; detail: string } {
  const { conditions, logic } = rule
  if (conditions.length === 0) return { matched: false, detail: '无条件' }

  const details = conditions.map((c) => describeCondition(row, c))
  const detail = details.join(logic === 'and' ? ' & ' : ' | ')

  const matched = logic === 'and'
    ? conditions.every((c) => smartCompare(row[c.column], c.operator, c.compareValue, row))
    : conditions.some((c) => smartCompare(row[c.column], c.operator, c.compareValue, row))

  return { matched, detail }
}
