const TODO_COLUMNS = [
  { key: 'name', label: '工作名称' },
  { key: 'workType', label: '工作类型' },
  { key: 'content', label: '工作内容' },
  { key: 'role', label: '担任角色' },
  { key: 'reminderAt', label: '提醒时间' },
  { key: 'dueDate', label: '交付日期' },
  { key: 'source', label: '任务来源' },
  { key: 'urgency', label: '紧急程度' },
  { key: 'createdAt', label: '创建时间' }
]

const DONE_COLUMNS = [
  { key: 'name', label: '工作名称' },
  { key: 'workType', label: '工作类型' },
  { key: 'content', label: '工作内容' },
  { key: 'role', label: '担任角色' },
  { key: 'completedDate', label: '完成日期' },
  { key: 'source', label: '任务来源' },
  { key: 'originType', label: '来源类型' },
  { key: 'createdAt', label: '创建时间' }
]

function formatJSON(data) {
  return JSON.stringify(data, null, 2)
}

function formatTxt(data, columns) {
  const header = columns.map(c => c.label).join('\t')
  const rows = data.map(item => columns.map(c => item[c.key] || '').join('\t'))
  return [header, ...rows].join('\n')
}

async function formatExcel(data, columns, title) {
  const ExcelJS = require('exceljs')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(title || '数据')
  worksheet.columns = columns.map(c => ({ header: c.label, key: c.key, width: 18 }))
  data.forEach(item => {
    const row = {}
    columns.forEach(c => { row[c.key] = item[c.key] || '' })
    worksheet.addRow(row)
  })
  return await workbook.xlsx.writeBuffer()
}

async function formatWord(data, columns, title) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType } = require('docx')
  const headerCells = columns.map(c => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true })] })],
    width: { size: 20, type: WidthType.PERCENTAGE }
  }))
  const dataRows = data.map(item => new TableRow({
    children: columns.map(c => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: item[c.key] || '' })] })],
      width: { size: 20, type: WidthType.PERCENTAGE }
    }))
  }))
  const table = new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE }
  })
  const doc = new Document({
    sections: [{
      children: [new Paragraph({ children: [new TextRun({ text: title || '数据', bold: true, size: 28 })] }), table]
    }]
  })
  return await Packer.toBuffer(doc)
}

module.exports = { TODO_COLUMNS, DONE_COLUMNS, formatJSON, formatTxt, formatExcel, formatWord }
