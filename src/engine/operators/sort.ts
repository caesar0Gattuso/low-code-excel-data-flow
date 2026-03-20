import type { DataTable, SortConfig } from '@/types'

export function executeSort(table: DataTable, config: SortConfig): DataTable {
  const { rules } = config
  if (!rules || rules.length === 0) return table

  const sorted = [...table.rows].sort((a, b) => {
    for (const rule of rules) {
      const va = a[rule.column]
      const vb = b[rule.column]
      if (va === vb) continue

      const bothNum = typeof va === 'number' && typeof vb === 'number'
      let cmp: number
      if (bothNum) {
        cmp = va - vb
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'zh-CN', { numeric: true })
      }
      return rule.order === 'desc' ? -cmp : cmp
    }
    return 0
  })

  return { columns: table.columns, rows: sorted }
}
