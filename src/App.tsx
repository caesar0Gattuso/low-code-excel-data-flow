import { ReactFlowProvider } from '@xyflow/react'
import { Toolbar } from '@/components/Toolbar'
import { Sidebar } from '@/components/Sidebar'
import { FlowCanvas } from '@/components/FlowCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <FlowCanvas />
          <PropertiesPanel />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
