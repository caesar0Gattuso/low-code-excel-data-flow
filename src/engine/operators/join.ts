import type { DataTable, JoinConfig, DataRow } from '@/types'

/** 根据多列 key 生成复合匹配键 */
function makeKey(row: DataRow, cols: string[]): string {
  return cols.map((c) => String(row[c] ?? '')).join('\x00')
}

/**
 * 根据冲突策略合并左右行（关联键列由左表决定）
 */
function mergeRow(
  lRow: DataRow,
  rRow: DataRow,
  leftCols: Set<string>,
  rightCols: Set<string>,
  conflictStrategy: JoinConfig['conflictStrategy'],
): DataRow {
  const conflicts = new Set([...leftCols].filter((c) => rightCols.has(c)))

  switch (conflictStrategy) {
    case 'right_wins':
      return { ...lRow, ...rRow }

    case 'rename_right': {
      const out: DataRow = { ...lRow }
      for (const [k, v] of Object.entries(rRow)) {
        out[conflicts.has(k) ? `${k}_right` : k] = v
      }
      return out
    }

    case 'rename_both': {
      const out: DataRow = {}
      for (const [k, v] of Object.entries(lRow)) {
        out[conflicts.has(k) ? `${k}_left` : k] = v
      }
      for (const [k, v] of Object.entries(rRow)) {
        out[conflicts.has(k) ? `${k}_right` : k] = v
      }
      return out
    }

    // left_wins（默认）
    default:
      return { ...rRow, ...lRow }
  }
}

/** 构建合并后的列顺序 */
function buildColumns(
  leftCols: string[],
  rightCols: string[],
  conflictStrategy: JoinConfig['conflictStrategy'],
): string[] {
  const lSet = new Set(leftCols)
  const rSet = new Set(rightCols)
  const conflicts = new Set(leftCols.filter((c) => rSet.has(c)))

  if (conflictStrategy === 'rename_right') {
    const rRenamed = rightCols.map((c) => (conflicts.has(c) ? `${c}_right` : c))
    return Array.from(new Set([...leftCols, ...rRenamed]))
  }

  if (conflictStrategy === 'rename_both') {
    const lRenamed = leftCols.map((c) => (conflicts.has(c) ? `${c}_left` : c))
    const rRenamed = rightCols.map((c) => (conflicts.has(c) ? `${c}_right` : c))
    return Array.from(new Set([...lRenamed, ...rRenamed]))
  }

  // left_wins / right_wins：列名不变，顺序：左列优先，右侧补充不重叠列
  const extra = rightCols.filter((c) => !lSet.has(c))
  return [...leftCols, ...extra]
}

export function executeJoin(left: DataTable, right: DataTable, config: JoinConfig): DataTable {
  const { leftKeys, rightKeys, joinType, conflictStrategy } = config

  // 兼容旧格式（单列 key 存在 leftKey/rightKey 字段）
  const lKeys: string[] = leftKeys?.length
    ? leftKeys
    : [(config as unknown as { leftKey?: string }).leftKey ?? '']
  const rKeys: string[] = rightKeys?.length
    ? rightKeys
    : [(config as unknown as { rightKey?: string }).rightKey ?? '']

  const strategy = conflictStrategy ?? 'left_wins'

  // 构建右表索引
  const rightIndex = new Map<string, DataRow[]>()
  for (const row of right.rows) {
    const key = makeKey(row, rKeys)
    if (!rightIndex.has(key)) rightIndex.set(key, [])
    rightIndex.get(key)!.push(row)
  }

  const leftColSet = new Set(left.columns)
  const rightColSet = new Set(right.columns)
  const columns = buildColumns(left.columns, right.columns, strategy)
  const rows: DataRow[] = []

  // 左表遍历
  const matchedRightKeys = new Set<string>() // 用于 right/full outer

  for (const lRow of left.rows) {
    const key = makeKey(lRow, lKeys)
    const matches = rightIndex.get(key)

    if (matches && matches.length > 0) {
      for (const rRow of matches) {
        rows.push(mergeRow(lRow, rRow, leftColSet, rightColSet, strategy))
      }
      if (joinType === 'right' || joinType === 'full') {
        matchedRightKeys.add(key)
      }
    } else if (joinType === 'left' || joinType === 'full') {
      // 左行无右侧匹配：输出左行，右侧列填 undefined
      rows.push({ ...lRow })
    }
  }

  // right / full outer：补充右表中未匹配的行
  if (joinType === 'right' || joinType === 'full') {
    for (const rRow of right.rows) {
      const key = makeKey(rRow, rKeys)
      if (!matchedRightKeys.has(key)) {
        // 右行无左侧匹配：输出右行，左侧列填 undefined
        rows.push({ ...rRow })
        matchedRightKeys.add(key) // 防止重复（同一右 key 多行）
      }
    }
  }

  return { columns, rows }
}
