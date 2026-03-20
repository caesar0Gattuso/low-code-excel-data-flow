import type { DataTable, DeduplicateConfig } from '@/types'

export function executeDeduplicate(table: DataTable, config: DeduplicateConfig): DataTable {
  const { keyColumns, keep } = config

  const keys = keyColumns.length > 0 ? keyColumns : table.columns

  const makeKey = (row: Record<string, unknown>) =>
    keys.map((c) => String(row[c] ?? '')).join('\x00')

  const seen = new Map<string, number>() // key → row index

  if (keep === 'last') {
    // 反向遍历，保留最后一条
    for (let i = table.rows.length - 1; i >= 0; i--) {
      const k = makeKey(table.rows[i])
      if (!seen.has(k)) seen.set(k, i)
    }
  } else {
    // 正向遍历，保留第一条
    for (let i = 0; i < table.rows.length; i++) {
      const k = makeKey(table.rows[i])
      if (!seen.has(k)) seen.set(k, i)
    }
  }

  const keptIndices = new Set(seen.values())
  const rows = table.rows.filter((_, i) => keptIndices.has(i))

  return { columns: table.columns, rows }
}
