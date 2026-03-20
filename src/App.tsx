import { HashRouter, Routes, Route } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { Toolbar } from '@/components/Toolbar'
import { Sidebar } from '@/components/Sidebar'
import { FlowCanvas } from '@/components/FlowCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { SimpleModePanel } from '@/components/SimpleModePanel'
import { RunPage } from '@/pages/RunPage'
import { useFlowStore } from '@/store/useFlowStore'

function DesignApp() {
  const viewMode = useFlowStore((s) => s.viewMode)

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Toolbar />
      {viewMode === 'simple' ? (
        <SimpleModePanel />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <FlowCanvas />
          <PropertiesPanel />
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <HashRouter>
        <Routes>
          {/* 完整设计视图（含简洁模式切换） */}
          <Route path="/" element={<DesignApp />} />
          {/* 锁定简洁执行模式，无法切换回设计视图 */}
          <Route path="/run" element={<RunPage />} />
          {/* 未匹配路由 → 回到首页 */}
          <Route path="*" element={<DesignApp />} />
        </Routes>
      </HashRouter>
    </ReactFlowProvider>
  )
}
