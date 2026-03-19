/**
 * 修正浮点数精度误差。
 * 默认保留 10 位有效小数，足以消除 0.0000000000004 类的浮点噪声，
 * 同时不会丢失业务上有意义的精度。
 */
export function fixFloat(value: number, decimals = 10): number {
  if (!isFinite(value)) return value
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
