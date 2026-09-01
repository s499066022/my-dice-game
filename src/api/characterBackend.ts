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
