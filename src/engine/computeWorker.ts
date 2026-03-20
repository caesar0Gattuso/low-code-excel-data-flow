import type { EngineRequest, EngineResponse } from '@/types'
import { executeDAG } from './dagExecutor'

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { nodes, edges, inputData } = event.data

  try {
    const { previews, inputPreviews, outputs, edgeRowCounts, previewTotals } = executeDAG(
      nodes, edges, inputData,
      (nodeId, status, errorMsg) => {
        const progress: EngineResponse = { type: 'progress', progress: { nodeId, status, errorMsg } }
        self.postMessage(progress)
      },
    )

    const result: EngineResponse = { type: 'result', previews, inputPreviews, outputs, edgeRowCounts, previewTotals }
    self.postMessage(result)
  } catch (err) {
    const errorMsg: EngineResponse = {
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(errorMsg)
  }
}
