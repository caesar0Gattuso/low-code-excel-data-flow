import { saveAs } from 'file-saver'
import type { TemplateData } from '@/types'

export function exportTemplate(template: TemplateData) {
  const json = JSON.stringify(template, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const name = template.name
    ? `${template.name}.flow.json`
    : `template_${new Date().toISOString().slice(0, 10)}.flow.json`
  saveAs(blob, name)
}

export function importTemplate(file: File): Promise<TemplateData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as TemplateData
        if (!data.nodes || !data.edges) {
          throw new Error('无效的模板文件：缺少 nodes 或 edges 字段')
        }
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
