import type { DataTable, FormulaV2Config, DataRow } from '@/types'
import { fixFloat } from '@/utils/precision'

// ---------------------------------------------------------------------------
// 表达式解析器（支持函数调用、字符串、比较/逻辑运算）
// 列引用格式：[列名]
// ---------------------------------------------------------------------------

type TValue = number | string | boolean | null

interface Ctx { src: string; pos: number }

function peek(ctx: Ctx): string { return ctx.src[ctx.pos] ?? '' }
function next(ctx: Ctx): string { return ctx.src[ctx.pos++] ?? '' }
function skipWs(ctx: Ctx) { while (/\s/.test(peek(ctx))) ctx.pos++ }

function parseString(ctx: Ctx): TValue {
  const q = next(ctx) // " or '
  let s = ''
  while (ctx.pos < ctx.src.length && peek(ctx) !== q) {
    s += next(ctx)
  }
  next(ctx) // closing quote
  return s
}

function parseColumnRef(ctx: Ctx, row: DataRow): TValue {
  next(ctx) // [
  let name = ''
  while (ctx.pos < ctx.src.length && peek(ctx) !== ']') name += next(ctx)
  next(ctx) // ]
  const v = row[name]
  if (v === undefined || v === null) return null
  const n = Number(v)
  return isNaN(n) ? String(v) : n
}

function parseIdent(ctx: Ctx): string {
  let s = ''
  while (/[\w]/.test(peek(ctx))) s += next(ctx)
  return s
}

function parseNumber(ctx: Ctx): TValue {
  let s = ''
  if (peek(ctx) === '-') s += next(ctx)
  while (/[\d.]/.test(peek(ctx))) s += next(ctx)
  return parseFloat(s)
}

// Forward declarations
function parseExpr(ctx: Ctx, row: DataRow): TValue { return parseOr(ctx, row) }

function parseOr(ctx: Ctx, row: DataRow): TValue {
  let left = parseAnd(ctx, row)
  skipWs(ctx)
  while (ctx.src.startsWith('||', ctx.pos) || ctx.src.startsWith('OR', ctx.pos)) {
    ctx.pos += 2; skipWs(ctx)
    const right = parseAnd(ctx, row)
    left = Boolean(left) || Boolean(right)
  }
  return left
}

function parseAnd(ctx: Ctx, row: DataRow): TValue {
  let left = parseCmp(ctx, row)
  skipWs(ctx)
  while (ctx.src.startsWith('&&', ctx.pos) || ctx.src.startsWith('AND', ctx.pos)) {
    ctx.pos += 2; skipWs(ctx)
    const right = parseCmp(ctx, row)
    left = Boolean(left) && Boolean(right)
  }
  return left
}

function parseCmp(ctx: Ctx, row: DataRow): TValue {
  let left = parseAdd(ctx, row)
  skipWs(ctx)
  const ops = ['<=', '>=', '!=', '<>', '==', '=', '<', '>']
  for (const op of ops) {
    if (ctx.src.startsWith(op, ctx.pos)) {
      ctx.pos += op.length; skipWs(ctx)
      const right = parseAdd(ctx, row)
      if (op === '==' || op === '=') return left == right  // eslint-disable-line eqeqeq
      if (op === '!=' || op === '<>') return left != right  // eslint-disable-line eqeqeq
      if (op === '<') return (left as number) < (right as number)
      if (op === '>') return (left as number) > (right as number)
      if (op === '<=') return (left as number) <= (right as number)
      if (op === '>=') return (left as number) >= (right as number)
    }
  }
  return left
}

function parseAdd(ctx: Ctx, row: DataRow): TValue {
  let left = parseMul(ctx, row)
  skipWs(ctx)
  while (peek(ctx) === '+' || peek(ctx) === '-') {
    const op = next(ctx); skipWs(ctx)
    const right = parseMul(ctx, row)
    if (op === '+') {
      // 字符串拼接 or 数字加法
      if (typeof left === 'string' || typeof right === 'string') {
        left = String(left ?? '') + String(right ?? '')
      } else {
        left = (left as number) + (right as number)
      }
    } else {
      left = (left as number) - (right as number)
    }
    skipWs(ctx)
  }
  return left
}

function parseMul(ctx: Ctx, row: DataRow): TValue {
  let left = parseUnary(ctx, row)
  skipWs(ctx)
  while (peek(ctx) === '*' || peek(ctx) === '/') {
    const op = next(ctx); skipWs(ctx)
    const right = parseUnary(ctx, row)
    left = op === '*' ? (left as number) * (right as number) : (left as number) / (right as number)
    skipWs(ctx)
  }
  return left
}

function parseUnary(ctx: Ctx, row: DataRow): TValue {
  skipWs(ctx)
  if (peek(ctx) === '!') { next(ctx); return !parseUnary(ctx, row) }
  if (peek(ctx) === '-' && /[\d\[]/.test(ctx.src[ctx.pos + 1] ?? '')) {
    next(ctx)
    return -(parseUnary(ctx, row) as number)
  }
  return parsePrimary(ctx, row)
}

function parsePrimary(ctx: Ctx, row: DataRow): TValue {
  skipWs(ctx)
  const ch = peek(ctx)

  // 括号
  if (ch === '(') { next(ctx); const v = parseExpr(ctx, row); skipWs(ctx); next(ctx); return v }

  // 字符串
  if (ch === '"' || ch === "'") return parseString(ctx)

  // 列引用
  if (ch === '[') return parseColumnRef(ctx, row)

  // 数字（正数）
  if (/\d/.test(ch)) return parseNumber(ctx)

  // 函数 / 常量标识符
  if (/[A-Za-z_]/.test(ch)) {
    const name = parseIdent(ctx).toUpperCase()
    skipWs(ctx)

    if (name === 'TRUE') return true
    if (name === 'FALSE') return false
    if (name === 'NULL') return null

    // 函数调用
    if (peek(ctx) === '(') {
      next(ctx) // (
      const args: TValue[] = []
      skipWs(ctx)
      if (peek(ctx) !== ')') {
        args.push(parseExpr(ctx, row))
        skipWs(ctx)
        while (peek(ctx) === ',') { next(ctx); skipWs(ctx); args.push(parseExpr(ctx, row)); skipWs(ctx) }
      }
      next(ctx) // )
      return callFn(name, args)
    }
  }

  return 0
}

function callFn(name: string, args: TValue[]): TValue {
  switch (name) {
    case 'IF':
      return args[0] ? args[1] ?? null : args[2] ?? null
    case 'ROUND': {
      const decimals = typeof args[1] === 'number' ? args[1] : 2
      return parseFloat((args[0] as number).toFixed(decimals))
    }
    case 'ABS':   return Math.abs(args[0] as number)
    case 'MAX':   return Math.max(...args.map((a) => Number(a)))
    case 'MIN':   return Math.min(...args.map((a) => Number(a)))
    case 'FLOOR': return Math.floor(args[0] as number)
    case 'CEIL':  return Math.ceil(args[0] as number)
    case 'CONCAT': return args.map((a) => String(a ?? '')).join('')
    case 'UPPER': return String(args[0] ?? '').toUpperCase()
    case 'LOWER': return String(args[0] ?? '').toLowerCase()
    case 'TRIM':  return String(args[0] ?? '').trim()
    case 'LEN':   return String(args[0] ?? '').length
    case 'SUBSTR':
    case 'SUBSTRING':
      return String(args[0] ?? '').substring(args[1] as number, (args[2] as number | undefined))
    case 'REPLACE':
      return String(args[0] ?? '').replaceAll(String(args[1] ?? ''), String(args[2] ?? ''))
    case 'ISNULL':
    case 'IFNULL':
      return (args[0] === null || args[0] === undefined || args[0] === '') ? (args[1] ?? null) : args[0]
    case 'NOT':
      return !args[0]
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// 算子入口
// ---------------------------------------------------------------------------

export function executeFormulaV2(input: DataTable, config: FormulaV2Config): DataTable {
  const { expression, outputColumn } = config

  const rows: DataRow[] = input.rows.map((row) => {
    let result: TValue
    try {
      const ctx: Ctx = { src: expression.trim(), pos: 0 }
      result = parseExpr(ctx, row)
      if (typeof result === 'number') result = fixFloat(result)
    } catch {
      result = null
    }
    return { ...row, [outputColumn]: result }
  })

  const columns = input.columns.includes(outputColumn)
    ? input.columns
    : [...input.columns, outputColumn]

  return { columns, rows }
}
