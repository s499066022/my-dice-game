// src/api/characterBackend.ts
// 前端与 Laravel 后端的通信客户端。
// 后端契约（后端可把角色卡/先攻结果看成不透明 JSON 对象存取）：
//   GET  {base}/ping            -> { ok: true }                                   （连通检测）
//   GET  {base}/characters      -> { ok: true, data: <CharacterCard[]> }          （角色卡列表）
//   POST {base}/characters/sync body:{ data: <CharacterCard[]> } -> { ok: true, count } （整体覆盖）
//   GET  {base}/initiative      -> { ok: true, data: [...], updatedAt }           （最新先攻结果）
//   POST {base}/initiative      body:{ data: [...] }              -> { ok: true } （发布最新结果）
// base 默认 /api；可用 VITE_API_BASE 或运行时输入框覆盖（如 http://localhost:12226/api）。
// 跨域开发时由 Laravel 返回 CORS 头（或经 Vite proxy）。

import { ref } from 'vue'
import type { CharacterCard } from '../data/dndModel'

const BASE_KEY = 'dnd-backend-base'
const DEFAULT_BASE = (import.meta.env.VITE_API_BASE as string) || '/api'

export type BackendStatus = 'offline' | 'online'

export function getBackendBase(): string {
  const saved = localStorage.getItem(BASE_KEY)
  return saved || DEFAULT_BASE
}

export function setBackendBase(v: string) {
  if (v) localStorage.setItem(BASE_KEY, v.replace(/\/+$/, ''))
  else localStorage.removeItem(BASE_KEY)
}

function baseUrl(): string {
  return (getBackendBase() || DEFAULT_BASE).replace(/\/+$/, '')
}

const healthUrl = () => `${baseUrl()}/ping`
const charactersUrl = (path = '') => `${baseUrl()}/characters${path ? `/${path}` : ''}`
const initiativeUrl = (path = '') => `${baseUrl()}/initiative${path ? `/${path}` : ''}`

export async function backendPing(): Promise<boolean> {
  try {
    const res = await fetch(healthUrl(), { headers: { Accept: 'application/json' } })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data && data.ok)
  } catch (e) {
    return false
  }
}

export async function backendFetchAll(): Promise<CharacterCard[] | null> {
  try {
    const res = await fetch(charactersUrl(), { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    if (data && data.ok === true && Array.isArray(data.data)) return data.data
    if (Array.isArray(data)) return data
    return null
  } catch (e) {
    console.error('读取后端失败', e)
    return null
  }
}

export async function backendPatchCard(id: string, data: any): Promise<any | null> {
  return apiJson('PATCH', `/characters/${encodeURIComponent(id)}`, { data })
}

// ---------- 角色卡 v2：轻量列表 / 分块懒加载 / 法术独立分页 ----------
export async function backendFetchLightCharacters(): Promise<any[] | null> {
  const r = await apiJson('GET', '/characters/light')
  if (r && r.ok === true && Array.isArray(r.data)) return r.data
  return null
}

export async function backendFetchCardBlock(id: string, block: string): Promise<any | null> {
  const r = await apiJson('GET', `/characters/${encodeURIComponent(id)}/blocks/${encodeURIComponent(block)}`)
  return r && r.ok === true && r.data ? r.data : null
}

export async function backendPatchCardBlock(id: string, block: string, data: any): Promise<any | null> {
  return apiJson('PATCH', `/characters/${encodeURIComponent(id)}/blocks/${encodeURIComponent(block)}`, { data })
}

export async function backendFetchSpells(cardId: string, page = 1, perPage = 20, q = ''): Promise<any | null> {
  const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  if (q) qs.set('q', q)
  const r = await apiJson('GET', `/characters/${encodeURIComponent(cardId)}/spells?${qs.toString()}`)
  return r && r.ok === true && r.data ? r.data : null
}

export async function backendCreateSpell(cardId: string, spell: any): Promise<any | null> {
  const r = await apiJson('POST', `/characters/${encodeURIComponent(cardId)}/spells`, spell)
  return r && r.ok === true && r.data ? r.data : null
}

export async function backendPatchSpell(id: string, data: any): Promise<any | null> {
  return apiJson('PATCH', `/spells/${encodeURIComponent(id)}`, data)
}

export async function backendDeleteSpell(id: string): Promise<any | null> {
  return apiJson('DELETE', `/spells/${encodeURIComponent(id)}`)
}

export async function backendReplaceAll(cards: CharacterCard[]): Promise<boolean> {
  try {
    const res = await fetch(charactersUrl('sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cards }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data && data.ok)
  } catch (e) {
    console.error('写入后端失败', e)
    return false
  }
}

// ========== 先攻结果共享（所有人查看） ==========
export async function backendPingInitiative(): Promise<boolean> {
  try {
    const res = await fetch(healthUrl(), { headers: { Accept: 'application/json' } })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data && data.ok)
  } catch (e) {
    return false
  }
}

export async function backendFetchInitiative(): Promise<{ data: any[]; updatedAt: string } | null> {
  try {
    const res = await fetch(initiativeUrl(), { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    if (data && data.ok === true && Array.isArray(data.data)) {
      return { data: data.data, updatedAt: data.updatedAt || '' }
    }
    return null
  } catch (e) {
    console.error('读取后端先攻结果失败', e)
    return null
  }
}

export async function backendPublishInitiative(results: any[]): Promise<boolean> {
  try {
    const res = await fetch(initiativeUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: results }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data && data.ok)
  } catch (e) {
    console.error('写入后端先攻结果失败', e)
    return false
  }
}

// ========== 团（Party）同步 ==========
function partiesUrl(path = ''): string {
  const base = (getBackendBase() || DEFAULT_BASE).replace(/\/+$/, '')
  return `${base}/parties${path ? `/${path}` : ''}`
}

export async function backendFetchParties(): Promise<any[] | null> {
  try {
    const res = await fetch(partiesUrl(), { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    if (data && data.ok === true && Array.isArray(data.data)) return data.data
    return null
  } catch (e) {
    console.error('读取后端团失败', e)
    return null
  }
}

export async function backendPublishParties(parties: any[]): Promise<boolean> {
  try {
    const res = await fetch(partiesUrl('sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: parties }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data && data.ok)
  } catch (e) {
    console.error('写入后端团失败', e)
    return false
  }
}

// ========== 通用请求（战斗会话用；带 X-Dnd-User 区分 presence 成员） ==========
export function userId(): string {
  const KEY = 'dnd-user-id'
  try {
    let u = localStorage.getItem(KEY)
    if (!u) {
      u = 'u-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
      localStorage.setItem(KEY, u)
    }
    return u
  } catch (e) {
    return 'u-anon'
  }
}

// 统一请求：返回 {ok:...} JSON；网络失败返回 null
export async function apiJson(method: string, path: string, body?: any): Promise<any | null> {
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Dnd-User': userId() },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    try {
      const j = text ? JSON.parse(text) : { ok: res.ok }
      if (j && typeof j === 'object') j.httpStatus = res.status
      return j
    } catch (e) {
      return { ok: false, error: 'HTTP ' + res.status + ': ' + text.slice(0, 200), httpStatus: res.status }
    }
  } catch (e) {
    console.error(`api ${method} ${path} 失败`, e)
    return null
  }
}

// ========== 战斗会话（API.md §6，团 id = 会话 id） ==========
export async function backendCombatSessionShow(id: string): Promise<any | null> {
  const r = await apiJson('GET', `/combat-sessions/${encodeURIComponent(id)}`)
  return r && r.ok === true && r.data ? r.data : null
}

export async function backendCombatSessionCreate(partyId: string): Promise<any | null> {
  const r = await apiJson('POST', '/combat-sessions', { party_id: partyId, dm_user_id: userId() })
  return r && r.ok === true && r.data ? r.data : null
}

export async function backendCombatantsSync(sessionId: string, combatants: any[]): Promise<any | null> {
  return apiJson('POST', `/combat-sessions/${encodeURIComponent(sessionId)}/combatants/sync`, { combatants })
}

export async function backendCombatantAdd(sessionId: string, combatant: any): Promise<any | null> {
  return apiJson('POST', `/combat-sessions/${encodeURIComponent(sessionId)}/combatants`, combatant)
}

export async function backendCombatantPatch(id: string, fields: any): Promise<any | null> {
  return apiJson('PATCH', `/combatants/${encodeURIComponent(id)}`, fields)
}

export async function backendCombatantDelete(id: string): Promise<any | null> {
  return apiJson('DELETE', `/combatants/${encodeURIComponent(id)}`)
}

export async function backendCombatantSwap(id: string, otherId: string): Promise<any | null> {
  return apiJson('POST', `/combatants/${encodeURIComponent(id)}/swap`, { other_id: otherId })
}

export async function backendRollInitiative(sessionId: string): Promise<any | null> {
  return apiJson('POST', `/combat-sessions/${encodeURIComponent(sessionId)}/roll-initiative`)
}

export async function backendSetLock(sessionId: string, locked: boolean): Promise<any | null> {
  return apiJson('POST', `/combat-sessions/${encodeURIComponent(sessionId)}/lock`, { locked })
}

export async function backendTurn(sessionId: string): Promise<any | null> {
  return apiJson('POST', `/combat-sessions/${encodeURIComponent(sessionId)}/turn`)
}

export async function backendSpellAreaAdd(sessionId: string, area: any): Promise<any | null> {
  return apiJson('POST', `/combat-sessions/${encodeURIComponent(sessionId)}/spell-areas`, area)
}

export async function backendSpellAreaUpdate(id: string, area: any): Promise<any | null> {
  return apiJson('PATCH', `/spell-areas/${encodeURIComponent(id)}`, area)
}

export async function backendSpellAreaDelete(id: string): Promise<any | null> {
  return apiJson('DELETE', `/spell-areas/${encodeURIComponent(id)}`)
}

// ========== 团（Party）==========
export async function backendFetchPartyList(): Promise<any[] | null> {
  const r = await apiJson('GET', '/parties')
  if (r && r.ok === true && Array.isArray(r.data)) return r.data
  return null
}

// 响应式的后端连接状态（供页面展示）
export interface BackendStatusState {
  status: BackendStatus
  checking: boolean
  error: string | null
  lastSync: string | null
}

const statusState = ref<BackendStatusState>({
  status: 'offline',
  checking: false,
  error: null,
  lastSync: null,
})

export function useBackendStatus() {
  return statusState
}
