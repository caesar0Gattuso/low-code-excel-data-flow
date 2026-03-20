import { ReactFlowProvider } from '@xyflow/react'
import { Toolbar } from '@/components/Toolbar'
import { Sidebar } from '@/components/Sidebar'
import { FlowCanvas } from '@/components/FlowCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { SimpleModePanel } from '@/components/SimpleModePanel'
import { useFlowStore } from '@/store/useFlowStore'

function AppInner() {
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
      <AppInner />
    </ReactFlowProvider>
  )
}
