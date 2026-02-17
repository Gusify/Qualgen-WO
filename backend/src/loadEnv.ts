import fs from 'fs'
import path from 'path'

const envLineRegex = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/

const parseValue = (rawValue: string) => {
  const value = rawValue.trim()
  if (!value) return ''

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, '\n')
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }

  const commentIndex = value.indexOf(' #')
  return commentIndex >= 0 ? value.slice(0, commentIndex).trim() : value
}

const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
]

for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue

  const contents = fs.readFileSync(envPath, 'utf8')
  const lines = contents.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = line.match(envLineRegex)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = parseValue(rawValue)
  }

  break
}

