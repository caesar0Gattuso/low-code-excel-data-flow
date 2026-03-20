import { useEffect, useRef, useState } from 'react'
import type { OperatorMeta } from '@/types'
import { operatorHelpMap } from '@/utils/operatorHelp'

interface Props {
  op: OperatorMeta
  /** 触发元素的 DOMRect（用于定位） */
  anchorRect: DOMRect
}

const CARD_WIDTH = 260
const VIEWPORT_PADDING = 12

export function OperatorTooltip({ op, anchorRect }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const cardH = card.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    // 默认放在触发元素右侧
    let left = anchorRect.right + 8
    let top = anchorRect.top

    // 右侧放不下时，改为左侧
    if (left + CARD_WIDTH + VIEWPORT_PADDING > vw) {
      left = anchorRect.left - CARD_WIDTH - 8
    }

    // 下方超出视口时，向上偏移
    if (top + cardH + VIEWPORT_PADDING > vh) {
      top = Math.max(VIEWPORT_PADDING, vh - cardH - VIEWPORT_PADDING)
    }

    setPos({ top, left })
  }, [anchorRect])

  const help = operatorHelpMap[op.type]

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: CARD_WIDTH,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in"
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="text-sm font-bold text-gray-800">{op.label}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">{op.description}</div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* 输入 / 输出 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">输入</div>
            <div className="text-[11px] text-gray-600 leading-relaxed">
              {help?.inputDesc ?? `${op.inputs} 张表`}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">输出</div>
            <div className="text-[11px] text-gray-600 leading-relaxed">
              {help?.outputDesc ?? `${op.outputs} 张表`}
            </div>
          </div>
        </div>

        {/* 主要配置项 */}
        {help?.configs && help.configs.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">配置项</div>
            <ul className="space-y-1">
              {help.configs.slice(0, 4).map((c) => (
                <li key={c.name} className="flex gap-1.5 text-[11px]">
                  <span className="font-medium text-gray-700 whitespace-nowrap shrink-0">{c.name}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-gray-500 leading-relaxed">{c.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 使用提示 */}
        {help?.tips && help.tips.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <div className="text-[10px] font-semibold text-amber-600 mb-1">💡 使用提示</div>
            <ul className="space-y-0.5">
              {help.tips.slice(0, 2).map((tip, i) => (
                <li key={i} className="text-[11px] text-amber-700 leading-relaxed">
                  · {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 函数速查（仅展示前3条） */}
        {help?.functions && help.functions.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            <div className="text-[10px] font-semibold text-indigo-600 mb-1">🔧 支持函数（共 {help.functions.length} 个，详见帮助文档）</div>
            <ul className="space-y-0.5">
              {help.functions.slice(0, 3).map((fn) => (
                <li key={fn.name} className="text-[10px] text-indigo-700 font-mono leading-relaxed truncate" title={fn.desc}>
                  {fn.signature}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
