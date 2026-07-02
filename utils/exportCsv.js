function escapeCsvValue(value) {
  const text = value === undefined || value === null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function escapeXmlValue(value) {
  return (value === undefined || value === null ? '' : String(value))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function utf8Bytes(text = '') {
  const bytes = []
  const value = String(text)
  for (let index = 0; index < value.length; index += 1) {
    let code = value.charCodeAt(index)
    if (code >= 0xD800 && code <= 0xDBFF && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xDC00 && next <= 0xDFFF) {
        code = 0x10000 + ((code - 0xD800) << 10) + (next - 0xDC00)
        index += 1
      }
    }
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F))
    else if (code < 0x10000) bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
    else bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
  }
  return new Uint8Array(bytes)
}

const crcTable = (() => {
  const table = []
  for (let index = 0; index < 256; index += 1) {
    let crc = index
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1
    table[index] = crc >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (let index = 0; index < bytes.length; index += 1) crc = crcTable[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function writeUint16(target, offset, value) {
  target[offset] = value & 0xFF
  target[offset + 1] = (value >>> 8) & 0xFF
}

function writeUint32(target, offset, value) {
  target[offset] = value & 0xFF
  target[offset + 1] = (value >>> 8) & 0xFF
  target[offset + 2] = (value >>> 16) & 0xFF
  target[offset + 3] = (value >>> 24) & 0xFF
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  parts.forEach(part => {
    output.set(part, offset)
    offset += part.length
  })
  return output
}

function zipDate() {
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  return { dosTime, dosDate }
}

function createZip(files = []) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const { dosTime, dosDate } = zipDate()

  files.forEach(file => {
    const nameBytes = utf8Bytes(file.name)
    const dataBytes = file.bytes || utf8Bytes(file.content || '')
    const crc = crc32(dataBytes)

    const local = new Uint8Array(30 + nameBytes.length)
    writeUint32(local, 0, 0x04034B50)
    writeUint16(local, 4, 20)
    writeUint16(local, 6, 0x0800)
    writeUint16(local, 8, 0)
    writeUint16(local, 10, dosTime)
    writeUint16(local, 12, dosDate)
    writeUint32(local, 14, crc)
    writeUint32(local, 18, dataBytes.length)
    writeUint32(local, 22, dataBytes.length)
    writeUint16(local, 26, nameBytes.length)
    writeUint16(local, 28, 0)
    local.set(nameBytes, 30)
    localParts.push(local, dataBytes)

    const central = new Uint8Array(46 + nameBytes.length)
    writeUint32(central, 0, 0x02014B50)
    writeUint16(central, 4, 20)
    writeUint16(central, 6, 20)
    writeUint16(central, 8, 0x0800)
    writeUint16(central, 10, 0)
    writeUint16(central, 12, dosTime)
    writeUint16(central, 14, dosDate)
    writeUint32(central, 16, crc)
    writeUint32(central, 20, dataBytes.length)
    writeUint32(central, 24, dataBytes.length)
    writeUint16(central, 28, nameBytes.length)
    writeUint16(central, 30, 0)
    writeUint16(central, 32, 0)
    writeUint16(central, 34, 0)
    writeUint16(central, 36, 0)
    writeUint32(central, 38, 0)
    writeUint32(central, 42, offset)
    central.set(nameBytes, 46)
    centralParts.push(central)

    offset += local.length + dataBytes.length
  })

  const centralOffset = offset
  const centralBytes = concatBytes(centralParts)
  const end = new Uint8Array(22)
  writeUint32(end, 0, 0x06054B50)
  writeUint16(end, 4, 0)
  writeUint16(end, 6, 0)
  writeUint16(end, 8, files.length)
  writeUint16(end, 10, files.length)
  writeUint32(end, 12, centralBytes.length)
  writeUint32(end, 16, centralOffset)
  writeUint16(end, 20, 0)

  return concatBytes([...localParts, centralBytes, end]).buffer
}

function columnName(index) {
  let name = ''
  let value = index + 1
  while (value > 0) {
    const mod = (value - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

export function buildCsv(headers = [], rows = []) {
  const head = headers.map(item => escapeCsvValue(item.label || item.key || item)).join(',')
  const body = rows.map(row => headers.map(header => {
    const key = header.key || header
    const value = typeof header.format === 'function' ? header.format(row[key], row) : row[key]
    return escapeCsvValue(value)
  }).join(','))
  return ['\ufeff' + head, ...body].join('\n')
}

export function exportCsvFile({ fileName = `export_${Date.now()}.csv`, headers = [], rows = [] }) {
  const csv = buildCsv(headers, rows)
  if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
    const fs = wx.getFileSystemManager()
    const path = `${wx.env.USER_DATA_PATH}/${fileName}`
    fs.writeFileSync(path, csv, 'utf8')
    wx.openDocument({
      filePath: path,
      fileType: 'csv',
      showMenu: true
    })
    return { path, csv }
  }
  uni.setClipboardData({ data: csv })
  return { path: '', csv }
}

export function buildExcelXml({ sheetName = '快递单', headers = [], rows = [] } = {}) {
  const columns = headers.map(header => `<col min="${headers.indexOf(header) + 1}" max="${headers.indexOf(header) + 1}" width="${Number(header.width || 18)}" customWidth="1"/>`).join('')
  const headerRow = headers.map((header, columnIndex) => `<c r="${columnName(columnIndex)}1" t="inlineStr" s="1"><is><t>${escapeXmlValue(header.label || header.key || header)}</t></is></c>`).join('')
  const bodyRows = rows.map(row => {
    const rowIndex = rows.indexOf(row) + 2
    const cells = headers.map((header, columnIndex) => {
      const key = header.key || header
      const value = typeof header.format === 'function' ? header.format(row[key], row) : row[key]
      return `<c r="${columnName(columnIndex)}${rowIndex}" t="inlineStr" s="2"><is><t>${escapeXmlValue(value)}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex}">${cells}</row>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <cols>${columns}</cols>
 <sheetData><row r="1">${headerRow}</row>${bodyRows}</sheetData>
</worksheet>`
}

export function buildXlsxFile({ sheetName = '快递单', headers = [], rows = [] } = {}) {
  const safeSheetName = escapeXmlValue(String(sheetName || '快递单').slice(0, 31) || '快递单')
  const sheetXml = buildExcelXml({ sheetName, headers, rows })
  return createZip([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="xml" ContentType="application/xml"/>
 <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
 <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
 <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
 <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: 'xl/styles.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
 <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4F7"/><bgColor indexed="64"/></patternFill></fill></fills>
 <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
 <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
 <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>
</styleSheet>`
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml }
  ])
}

export function exportExcelFile({ fileName = `export_${Date.now()}.xlsx`, sheetName = '快递单', headers = [], rows = [] } = {}) {
  const excel = buildXlsxFile({ sheetName, headers, rows })
  if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
    const fs = wx.getFileSystemManager()
    const normalizedName = fileName.endsWith('.xlsx') ? fileName : `${fileName.replace(/\.\w+$/, '')}.xlsx`
    const path = `${wx.env.USER_DATA_PATH}/${normalizedName}`
    fs.writeFileSync(path, excel)
    return { path, excel, fileName: normalizedName }
  }
  uni.setClipboardData({ data: '当前环境不支持生成 Excel 文件，请在微信小程序中操作。' })
  return { path: '', excel, fileName }
}

export function shareExcelFile(options = {}) {
  const result = exportExcelFile(options)
  if (!result.path) return result
  if (typeof wx !== 'undefined' && typeof wx.shareFileMessage === 'function') {
    wx.shareFileMessage({
      filePath: result.path,
      fileName: result.fileName,
      success: () => {
        if (typeof options.onShared === 'function') options.onShared(result)
      },
      fail: error => {
        const message = String(error && error.errMsg ? error.errMsg : '')
        if (message.includes('cancel')) return
        wx.openDocument({
          filePath: result.path,
          fileType: 'xlsx',
          showMenu: true,
          success: () => {
            if (typeof options.onOpened === 'function') options.onOpened(result)
          }
        })
      }
    })
    return result
  }
  if (typeof wx !== 'undefined' && typeof wx.openDocument === 'function') {
    wx.openDocument({
      filePath: result.path,
      fileType: 'xlsx',
      showMenu: true,
      success: () => {
        if (typeof options.onOpened === 'function') options.onOpened(result)
      }
    })
  }
  return result
}

export function buildDeliveryCsvRows(orders = []) {
  return orders.map((order, index) => ({
    routeNo: order.routeNo || index + 1,
    orderNo: order.orderNo || order.id,
    receiver: order.receiver || order.customer,
    phone: order.fullPhone || order.phone,
    address: order.address,
    deliveryTime: order.deliveryTime || order.planTime,
    statusText: order.statusText,
    goods: (order.items || []).map(item => `${item.name}x${item.count}`).join('；'),
    note: order.note || ''
  }))
}

export const deliveryCsvHeaders = [
  { key: 'routeNo', label: '路线序号' },
  { key: 'orderNo', label: '订单号' },
  { key: 'receiver', label: '收货人' },
  { key: 'phone', label: '电话' },
  { key: 'address', label: '地址' },
  { key: 'deliveryTime', label: '配送时间' },
  { key: 'statusText', label: '状态' },
  { key: 'goods', label: '商品' },
  { key: 'note', label: '备注' }
]
