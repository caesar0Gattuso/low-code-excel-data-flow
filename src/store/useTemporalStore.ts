import { useStore } from 'zustand'
import { useFlowStore } from './useFlowStore'

/** 暴露 zundo 的撤销/重做 API */
export function useTemporalStore() {
  const temporalStore = useFlowStore.temporal
  const undo = useStore(temporalStore, (s) => s.undo)
  const redo = useStore(temporalStore, (s) => s.redo)
  const pastStates = useStore(temporalStore, (s) => s.pastStates)
  const futureStates = useStore(temporalStore, (s) => s.futureStates)
  return { undo, redo, pastStates, futureStates }
}
