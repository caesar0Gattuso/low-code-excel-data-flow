import { useEffect, useRef } from 'react'

type MenuItem = {
  label: string
  icon: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击菜单外部关闭
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  // 按 Escape 关闭
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  // 防止菜单超出视口
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 9999,
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px] select-none"
    >
      {items.map((item, idx) =>
        item.label === '---' ? (
          <div key={idx} className="my-1 border-t border-gray-100" />
        ) : (
          <button
            key={idx}
            onClick={() => {
              if (!item.disabled) {
                item.onClick()
                onClose()
              }
            }}
            disabled={item.disabled}
            className={[
              'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
              item.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-100',
            ].join(' ')}
          >
            <span className="text-sm">{item.icon}</span>
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
