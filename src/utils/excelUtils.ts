import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import type { DataTable } from '@/types'

export function parseExcelFile(file: File): Promise<Record<string, DataTable>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const result: Record<string, DataTable> = {}

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
          const columns =
            jsonRows.length > 0 ? Object.keys(jsonRows[0]) : []
          result[sheetName] = { columns, rows: jsonRows }
        }

        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function exportToExcel(tables: Record<string, DataTable>, fileName: string) {
  const workbook = XLSX.utils.book_new()

  for (const [sheetName, table] of Object.entries(tables)) {
    const worksheet = XLSX.utils.json_to_sheet(table.rows, { header: table.columns })
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  saveAs(blob, fileName)
}

export function downloadTierTemplate() {
  const rows = [
    { min: 0, max: 300, value: 0 },
    { min: 300, max: 3000, value: 10 },
    { min: 3000, max: 5000, value: 20 },
    { min: 5000, max: '', value: 50 },
  ]
  exportToExcel(
    { '阶梯规则': { columns: ['min', 'max', 'value'], rows } },
    '阶梯规则模板.xlsx',
  )
}

export function getSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', bookSheets: true })
        resolve(workbook.SheetNames)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
