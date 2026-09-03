// 把 m.xlsx 转换成 src/data/spellLibrary.json（法术库内置标准清单）
// 依赖：npm i xlsx（仅转换时用，勿提交依赖）
import XLSX from 'xlsx'
import { writeFileSync, existsSync } from 'node:fs'

const SRC = process.argv[2] || 'm.xlsx'
if (!existsSync(SRC)) { console.error('找不到', SRC); process.exit(1) }
const wb = XLSX.readFile(SRC)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1) // 去掉表头

const no = (v) => v === '×' || v === '-' || v === '' || v === '否' || v === '无'
const hashId = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'lib-' + h.toString(36) }

const spells = rows
  .filter((r) => r[0])
  .map((r) => {
    const name = String(r[0]).trim()
    const level = Number(r[1]) >= 0 ? Number(r[1]) : 0
    return {
      id: hashId(name + '|' + level + '|' + String(r[2] || '')),
      status: '已准备',
      level,
      school: String(r[2] || '').trim(),
      ritual: !no(String(r[3])),
      name,
      castingTime: String(r[4] || '').trim(),
      range: String(r[5] || '').trim(),
      duration: String(r[10] || '').trim(),
      v: !no(String(r[6])),
      s: !no(String(r[7])),
      m: !no(String(r[8])),
      material: String(r[9] || '').trim() === '×' ? '' : String(r[9] || '').trim(),
      effect: String(r[11] || '').trim(),
      description: '',
      source: 'xlsx',
    }
  })

writeFileSync('src/data/spellLibrary.json', JSON.stringify(spells, null, 0))
console.log('生成', spells.length, '条 -> src/data/spellLibrary.json')
const byLevel = {}
spells.forEach((s) => { byLevel[s.level] = (byLevel[s.level] || 0) + 1 })
console.log('环位分布:', JSON.stringify(byLevel))
