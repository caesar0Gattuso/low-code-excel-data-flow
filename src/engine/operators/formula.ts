import type { DataTable, FormulaConfig, DataRow } from '@/types'
import { fixFloat } from '@/utils/precision'

/**
 * 安全的公式求值器。
 * 支持列名引用（用 `[列名]` 表示），以及基础数学运算。
 * 例如: "[金币] * 0.5 + [时长] * 2"
 */
export function executeFormula(input: DataTable, config: FormulaConfig): DataTable {
  const { expression, outputColumn } = config

  const rows: DataRow[] = input.rows.map((row) => {
    const resolvedExpr = expression.replace(/\[([^\]]+)\]/g, (_, colName: string) => {
      const v = Number(row[colName])
      return isNaN(v) ? '0' : String(v)
    })

    let result: number
    try {
      result = evaluateMathExpression(resolvedExpr)
    } catch {
      result = 0
    }
    return { ...row, [outputColumn]: fixFloat(result) }
  })

  const columns = input.columns.includes(outputColumn)
    ? input.columns
    : [...input.columns, outputColumn]

  return { columns, rows }
}

/**
 * 简单且安全的数学表达式求值（仅支持 + - * / 和括号）。
 * 不使用 eval，避免安全风险。
 */
function evaluateMathExpression(expr: string): number {
  const tokens = tokenize(expr)
  const result = parseExpression(tokens, { pos: 0 })
  return result
}

type Token = { type: 'number'; value: number } | { type: 'op'; value: string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = expr.replace(/\s/g, '')

  while (i < s.length) {
    if ('+-*/()'.includes(s[i])) {
      tokens.push({ type: 'op', value: s[i] })
      i++
    } else if (/[0-9.]/.test(s[i])) {
      let num = ''
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i++]
      }
      tokens.push({ type: 'number', value: parseFloat(num) })
    } else {
      i++
    }
  }
  return tokens
}

function parseExpression(tokens: Token[], ctx: { pos: number }): number {
  let left = parseTerm(tokens, ctx)
  while (ctx.pos < tokens.length) {
    const t = tokens[ctx.pos]
    if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
      ctx.pos++
      const right = parseTerm(tokens, ctx)
      left = t.value === '+' ? left + right : left - right
    } else {
      break
    }
  }
  return left
}

function parseTerm(tokens: Token[], ctx: { pos: number }): number {
  let left = parseFactor(tokens, ctx)
  while (ctx.pos < tokens.length) {
    const t = tokens[ctx.pos]
    if (t.type === 'op' && (t.value === '*' || t.value === '/')) {
      ctx.pos++
      const right = parseFactor(tokens, ctx)
      left = t.value === '*' ? left * right : right !== 0 ? left / right : 0
    } else {
      break
    }
  }
  return left
}

function parseFactor(tokens: Token[], ctx: { pos: number }): number {
  const t = tokens[ctx.pos]
  if (!t) return 0

  if (t.type === 'number') {
    ctx.pos++
    return t.value
  }
  if (t.type === 'op' && t.value === '(') {
    ctx.pos++
    const val = parseExpression(tokens, ctx)
    if (tokens[ctx.pos]?.type === 'op' && tokens[ctx.pos]?.value === ')') {
      ctx.pos++
    }
    return val
  }
  if (t.type === 'op' && t.value === '-') {
    ctx.pos++
    return -parseFactor(tokens, ctx)
  }
  ctx.pos++
  return 0
}
