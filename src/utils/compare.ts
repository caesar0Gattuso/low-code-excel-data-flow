import type { CompareOperator, DataRow } from '@/types'

/**
 * 解析值中的 [列名] 引用：如果是 [列名] 格式，从 row 中取值；否则原样返回。
 * 可用于 compareValue、result、elseResult、defaultValue 等字段。
 */
export function resolveColumnRef(compareValue: number | string, row?: DataRow): number | string {
  if (typeof compareValue === 'string' && row) {
    const colRef = compareValue.match(/^\[([^\]]+)\]$/)
    if (colRef) {
      const v = row[colRef[1]]
      if (v === undefined || v === null) return ''
      const n = Number(v)
      return isNaN(n) ? String(v) : n
    }
  }
  return compareValue
}

/**
 * 智能比较：自动检测数字、日期、字符串，选择合适的比较方式。
 * compareValue 支持 [列名] 语法引用同行数据（需传入 row）。
 *
 * 优先级：
 *  1. 如果 compareValue 形似日期 → 按日期比较
 *  2. 如果两侧都能转数字 → 按数字比较
 *  3. 兜底 → 按字符串比较
 */
export function smartCompare(
  cellVal: unknown,
  operator: CompareOperator,
  compareValue: number | string,
  row?: DataRow,
): boolean {
  const resolved = resolveColumnRef(compareValue, row)
  const compareDateTs = tryParseDate(resolved)
  if (compareDateTs !== null) {
    let cellDateTs = tryParseDate(cellVal)
    if (cellDateTs === null) {
      const n = Number(cellVal)
      if (!isNaN(n) && n > 0 && n < 2958466) {
        cellDateTs = excelSerialToTimestamp(n)
      }
    }
    if (cellDateTs !== null) {
      return cmpNumbers(cellDateTs, operator, compareDateTs)
    }
  }

  const numCell = Number(cellVal)
  const numCompare = Number(resolved)
  if (!isNaN(numCell) && !isNaN(numCompare)) {
    return cmpNumbers(numCell, operator, numCompare)
  }

  return cmpStrings(String(cellVal ?? ''), operator, String(resolved))
}

/**
 * 尝试将值解析为日期时间戳（毫秒），失败返回 null。
 * 支持格式：2025-01-01、2025/01/01、2025年1月1日
 */
function tryParseDate(value: unknown): number | null {
  if (value instanceof Date) {
    const ts = value.getTime()
    return isNaN(ts) ? null : ts
  }

  const str = String(value ?? '').trim()

  // 2025-01-01 或 2025/01/01，可带可不带时间部分
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/)
  if (isoMatch) {
    const d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3])
    return isNaN(d.getTime()) ? null : d.getTime()
  }

  // 2025年1月1日
  const cnMatch = str.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/)
  if (cnMatch) {
    const d = new Date(+cnMatch[1], +cnMatch[2] - 1, +cnMatch[3])
    return isNaN(d.getTime()) ? null : d.getTime()
  }

  return null
}

/** Excel 序列号 → 毫秒时间戳（兼容 Lotus 1-2-3 闰年 bug） */
function excelSerialToTimestamp(serial: number): number {
  return (serial - 25569) * 86400_000
}

function cmpNumbers(a: number, op: CompareOperator, b: number): boolean {
  switch (op) {
    case '>':  return a > b
    case '>=': return a >= b
    case '<':  return a < b
    case '<=': return a <= b
    case '==': return a === b
    case '!=': return a !== b
    default:   return false
  }
}

function cmpStrings(a: string, op: CompareOperator, b: string): boolean {
  switch (op) {
    case '>':  return a > b
    case '>=': return a >= b
    case '<':  return a < b
    case '<=': return a <= b
    case '==': return a === b
    case '!=': return a !== b
    default:   return false
  }
}
