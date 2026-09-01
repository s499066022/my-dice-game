// src/data/partyModel.ts
// 团（Party）：把角色卡组成冒险小队。每个角色只能属于一个团。

import { uid } from './dndModel'

export interface Party {
  id: string
  name: string
  memberIds: string[]
  createdAt: string
  updatedAt: string
}

const PARTY_KEY = 'dnd-parties'

export function loadParties(): Party[] {
  try {
    const s = localStorage.getItem(PARTY_KEY)
    if (!s) return []
    const p = JSON.parse(s)
    return Array.isArray(p) ? p : []
  } catch (e) {
    console.error('读取团数据失败', e)
    return []
  }
}

export function saveParties(parties: Party[]) {
  localStorage.setItem(PARTY_KEY, JSON.stringify(parties))
}

export function createParty(name = ''): Party {
  const now = new Date().toISOString()
  return { id: uid(), name, memberIds: [], createdAt: now, updatedAt: now }
}

// 找到包含某角色的团（每个角色只能属于一个团）
export function findPartyByMember(parties: Party[], cardId: string): Party | null {
  return parties.find((p) => p.memberIds.includes(cardId)) || null
}

// 把角色加入团：先从其它团移出，再加入目标团（保证唯一归属）
export function addMemberToParty(parties: Party[], partyId: string, cardId: string): Party[] {
  const next = parties.map((p) => ({ ...p, memberIds: p.memberIds.filter((id) => id !== cardId) }))
  const target = next.find((p) => p.id === partyId)
  if (target && !target.memberIds.includes(cardId)) {
    target.memberIds.push(cardId)
    target.updatedAt = new Date().toISOString()
  }
  return next
}

export function removeMemberFromParty(parties: Party[], partyId: string, cardId: string): Party[] {
  return parties.map((p) =>
    p.id === partyId
      ? { ...p, memberIds: p.memberIds.filter((id) => id !== cardId), updatedAt: new Date().toISOString() }
      : p
  )
}

export function renameParty(parties: Party[], partyId: string, name: string): Party[] {
  return parties.map((p) => (p.id === partyId ? { ...p, name, updatedAt: new Date().toISOString() } : p))
}

export function deleteParty(parties: Party[], partyId: string): Party[] {
  return parties.filter((p) => p.id !== partyId)
}
