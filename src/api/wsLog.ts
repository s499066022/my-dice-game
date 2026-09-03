// src/api/wsLog.ts
// 长连接/同步收发日志总线：供地图等页面实时展示「收到的广播事件 / 发出的 REST / WS 状态」。
// 独立模块避免 reverb <-> characterBackend 循环引用。

import { ref } from 'vue'

export type WsLogDir = 'in' | 'out' | 'sys' | 'err'

export interface WsLogEntry {
  ts: number
  dir: WsLogDir
  chan: string // 频道/端点，如 presence-combat.x / REST / echo
  label: string // 事件名/方法，如 CombatantUpdated / PATCH / WS连接
  detail?: string // 载荷摘要（截断）
}

const MAX = 300
const entries = ref<WsLogEntry[]>([])
let cap = MAX

export function setWsLogCap(n: number) {
  cap = Math.max(50, n)
}

export function logWs(dir: WsLogDir, chan: string, label: string, detail?: string) {
  const e: WsLogEntry = { ts: Date.now(), dir, chan, label, detail: detail ? String(detail).slice(0, 260) : undefined }
  entries.value.push(e)
  if (entries.value.length > cap) entries.value.splice(0, entries.value.length - cap)
}

export function clearWsLog() {
  entries.value.splice(0)
}

export function useWsLog() {
  return { entries }
}

// 载荷摘要工具：对象转单行 JSON（去超长字段）
export function summarize(v: any, max = 200): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v.length > max ? v.slice(0, max) + '…' : v
  try {
    const s = JSON.stringify(v)
    return s && s.length > max ? s.slice(0, max) + '…' : s || ''
  } catch {
    return String(v)
  }
}
