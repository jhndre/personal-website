/**
 * Parse a CSV string into rows of record objects (first row = headers).
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length === 0) return []
  const headers = parseCsvRow(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i])
    const record: Record<string, string> = {}
    headers.forEach((h, j) => {
      record[h] = values[j] ?? ''
    })
    rows.push(record)
  }
  return rows
}

function parseCsvRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        current += c
      }
    } else if (c === ',') {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}
