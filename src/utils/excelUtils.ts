import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { DataTable } from '@/types'

export function parseExcelFile(file: File): Promise<Record<string, DataTable>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const result: Record<string, DataTable> = {}

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
          const rows = jsonRows.map((row) => {
            const out: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(row)) {
              if (v instanceof Date) {
                out[k] = formatDate(v)
              } else if (typeof v === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(:\d{2})?/.test(v)) {
                out[k] = v.slice(0, 10)
              } else {
                out[k] = v
              }
            }
            return out
          })
          const columns = rows.length > 0 ? Object.keys(rows[0]) : []
          result[sheetName] = { columns, rows }
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

/**
 * 按指定列（支持多列组合）的不同值拆分表，按 splitMode 导出：
 * - 'sheets'：所有子表合并到一个 Excel 文件，Sheet 名直接用复合 Key
 * - 'files'：所有拆分文件打包为一个 ZIP 下载，每个文件名为 `Key.xlsx`，ZIP 名取 fileName
 */
export function exportWithSplit(
  table: DataTable,
  splitByColumns: string[],
  splitMode: 'sheets' | 'files',
  baseSheetName: string,
  fileBaseName: string,
) {
  // 过滤掉不在表中的列（防止导出列变更后残留无效拆分列）
  const validCols = splitByColumns.filter((c) => table.columns.includes(c))
  if (validCols.length === 0) return

  const zipName = fileBaseName.replace(/\.xlsx$/i, '') + '.zip'

  // 按复合 Key 分组，保持原始出现顺序
  const groups = new Map<string, typeof table.rows>()
  for (const row of table.rows) {
    const key = validCols.map((c) => String(row[c] ?? '')).join('_')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  if (groups.size === 0) return

  if (splitMode === 'sheets') {
    // Sheet 名直接用复合 Key（最长 31 字符，Excel 限制）
    const tables: Record<string, DataTable> = {}
    for (const [key, rows] of groups) {
      tables[key.slice(0, 31)] = { columns: table.columns, rows }
    }
    exportToExcel(tables, fileBaseName)
  } else {
    // 多文件：打包为 ZIP，文件名直接用 Key.xlsx
    const zip = new JSZip()
    for (const [key, rows] of groups) {
      const safeKey = key.replace(/[\\/:*?"<>|]/g, '_')
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows, { header: table.columns })
      XLSX.utils.book_append_sheet(wb, ws, baseSheetName)
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      zip.file(`${safeKey}.xlsx`, buffer)
    }
    zip.generateAsync({ type: 'blob' }).then((blob) => saveAs(blob, zipName))
  }
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

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
