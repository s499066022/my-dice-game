// src/composables/useCombatSession.ts
// 战斗会话 store：一份"当前战斗"的权威态（先攻/站位/HP/法术区域/回合）。
// 默认 localStorage 持久化；接入 Reverb 后写入后端并实时广播，全员同步。
// 第一版"全员可改"。

import { reactive, ref, computed } from 'vue'
import type { CharacterCard } from '../data/dndModel'
import { getInitiativeTotal, getTotalAC } from '../data/dndModel'
import { uid } from '../data/dndModel'
import { connectReverb } from '../api/reverb'

export type CombatantAdvantage = 'normal' | 'advantage' | 'disadvantage'

export interface Combatant {
  id: string
  type: 'character' | 'monster'
  refId?: string
  name: string
  color: string
  size: number // 占格（1格=5尺）
  q: number
  r: number
  order: number
  initiativeRoll: number // d20 掷出的值
  initiativeBonus: number
  initiativeTotal: number
  advantage: CombatantAdvantage
  ac: number
  hp: { current: number; max: number }
  payload?: any // 角色卡/怪物卡完整信息（记录用）
}

export interface SpellArea {
  id: string
  type: 'cone' | 'circle'
  q: number
  r: number
  angle: number
  ft: number
  boundTo: string | null
}

const STORAGE_KEY = 'dnd-combat-session'
const ADVANTAGE_NUM: Record<CombatantAdvantage, number> = { normal: 0, advantage: 5, disadvantage: -5 }

// 模块级单例状态（地图 / 面板共享）
const sessionId = ref('')
const state = ref<'setup' | 'initiative' | 'combat' | 'ended'>('setup')
const combatants = reactive<Combatant[]>([])
const spellAreas = reactive<SpellArea[]>([])
const round = ref(1)
const currentCombatantId = ref<string | null>(null)
const locked = ref(false) // 锁定后禁止增删/移动
const online = ref(false)
const lastSync = ref('')

const orderedCombatants = computed(() => [...combatants].sort((a, b) => a.order - b.order))
const currentCombatant = computed(() => combatants.find((c) => c.id === currentCombatantId.value) || null)

function sessionKey(): string {
  return sessionId.value ? `${STORAGE_KEY}-${sessionId.value}` : STORAGE_KEY
}

function saveLocal() {
  try {
    localStorage.setItem(
      sessionKey(),
      JSON.stringify({ sessionId: sessionId.value, state: state.value, combatants, spellAreas, round: round.value, currentCombatantId: currentCombatantId.value })
    )
  } catch (e) {
    console.error(e)
  }
}

function loadLocal() {
  try {
    const s = localStorage.getItem(sessionKey())
    if (!s) return
    const d = JSON.parse(s)
    sessionId.value = d.sessionId || sessionId.value
    state.value = d.state || 'setup'
    round.value = d.round || 1
    currentCombatantId.value = d.currentCombatantId || null
    locked.value = !!d.locked
    combatants.length = 0
    combatants.push(...(d.combatants || []))
    spellAreas.length = 0
    spellAreas.push(...(d.spellAreas || []))
  } catch (e) {
    console.error(e)
  }
}

let echo: any = null

function hookReverb() {
  if (!sessionId.value) return
  echo = connectReverb('combat-' + sessionId.value, {
    onSnapshot: (data: any) => {
      if (data) {
        state.value = data.state || state.value
        round.value = data.round || round.value
        currentCombatantId.value = data.current_combatant_id || data.currentCombatantId || null
        if (Array.isArray(data.combatants)) {
          combatants.splice(0, ...data.combatants)
        }
        if (Array.isArray(data.spell_areas) || Array.isArray(data.spellAreas)) {
          spellAreas.splice(0, ...(data.spell_areas || data.spellAreas || []))
        }
        online.value = true
        drawNotifier.value++
        saveLocal()
      }
    },
    onUpdate: () => {
      drawNotifier.value++
    },
    onOnline: (v: boolean) => (online.value = v),
  })
}

function disconnectReverb() {
  if (echo) {
    echo = null
  }
}

// 用于通知渲染层重绘
const drawNotifier = ref(0)

// ========== 会话生命周期 ==========
export function createSession(sessionName = '战斗') {
  sessionId.value = uid() + '-' + Date.now().toString(36)
  state.value = 'setup'
  round.value = 1
  currentCombatantId.value = null
  locked.value = false
  combatants.splice(0)
  spellAreas.splice(0)
  saveLocal()
  hookReverb()
  return sessionId.value
}

// 团的 id = 会话 id：选择团即加入/创建该会话。
// 首次创建 -> 空会话（后续由面板带入全团）；已存在 -> 读取上次数据。
export function createOrJoinParty(partyId: string): { existed: boolean } {
  sessionId.value = partyId
  const existed = !!localStorage.getItem(sessionKey())
  if (existed) {
    loadLocal()
  } else {
    state.value = 'setup'
    round.value = 1
    currentCombatantId.value = null
    locked.value = false
    combatants.splice(0)
    spellAreas.splice(0)
    saveLocal()
  }
  hookReverb()
  return { existed }
}

export function joinSession(id: string) {
  sessionId.value = id
  loadLocal()
  hookReverb()
}

export function resetSession() {
  const key = sessionKey()
  sessionId.value = ''
  state.value = 'setup'
  round.value = 1
  currentCombatantId.value = null
  locked.value = false
  combatants.splice(0)
  spellAreas.splice(0)
  localStorage.removeItem(key)
  saveLocal()
  disconnectReverb()
}

export function toggleLock() {
  locked.value = !locked.value
  saveLocal()
  drawNotifier.value++
}

// ========== 参战者 ==========
export function addCharacter(card: CharacterCard) {
  // 同一张角色卡（refId）只能加入一次，直接返回已有参战者
  const existing = combatants.find((x) => x.type === 'character' && x.refId === card.id)
  if (existing) return existing
  const order = combatants.length ? Math.max(...combatants.map((c) => c.order)) + 1 : 1
  const pos = nextFreePos()
  const c: Combatant = {
    id: uid(),
    type: 'character',
    refId: card.id,
    name: card.name || '角色',
    color: hashColor(card.id),
    size: sizeFromCard(card.size),
    q: pos.q,
    r: pos.r,
    order,
    initiativeRoll: 0,
    initiativeBonus: getInitiativeTotal(card),
    initiativeTotal: 0,
    advantage: (card.initiativeAdvantage as CombatantAdvantage) || 'normal',
    ac: getTotalAC(card),
    hp: { current: card.hp.current, max: card.hp.max },
    payload: card,
  }
  combatants.push(c)
  saveLocal()
  drawNotifier.value++
  return c
}

export function addMonster(data: Partial<Combatant>) {
  const order = combatants.length ? Math.max(...combatants.map((c) => c.order)) + 1 : 1
  const pos = data.q != null && data.r != null ? { q: data.q, r: data.r } : nextFreePos()
  const c: Combatant = {
    id: uid(),
    type: 'monster',
    name: data.name || '怪物',
    color: data.color || '#ef4444',
    size: data.size || 1,
    q: pos.q,
    r: pos.r,
    order,
    initiativeRoll: 0,
    initiativeBonus: Number(data.initiativeBonus) || 0,
    initiativeTotal: 0,
    advantage: data.advantage || 'normal',
    ac: Number(data.ac) || 10,
    hp: { current: Number(data.hp?.max) || 20, max: Number(data.hp?.max) || 20 },
    payload: data.payload,
  }
  combatants.push(c)
  saveLocal()
  drawNotifier.value++
  return c
}

// 自动加入：从原点向 +q 方向"一字排开"，避免叠放
function nextFreePos(): { q: number; r: number } {
  const i = combatants.length
  return { q: i - Math.floor(combatants.length / 2), r: 0 }
}

export function removeCombatant(id: string) {
  if (locked.value) return
  const i = combatants.findIndex((c) => c.id === id)
  if (i !== -1) combatants.splice(i, 1)
  spellAreas.forEach((a) => {
    if (a.boundTo === id) a.boundTo = null
  })
  saveLocal()
  drawNotifier.value++
}

// 位置
export function moveCombatant(id: string, q: number, r: number) {
  if (locked.value) return
  const c = combatants.find((x) => x.id === id)
  if (!c) return
  c.q = q
  c.r = r
  saveLocal()
  drawNotifier.value++
}

// HP（玩家扣自己角色血/怪物 DM 扣血，第一版都可改）
export function hpCombatant(id: string, delta: number) {
  const c = combatants.find((x) => x.id === id)
  if (!c) return
  c.hp.current = Math.max(0, Math.min(c.hp.max, c.hp.current + delta))
  saveLocal()
  drawNotifier.value++
}

// 先攻掷骰 / 重排
export function rollInitiative() {
  combatants.forEach((c) => {
    const roll = Math.floor(Math.random() * 20) + 1
    c.initiativeRoll = roll
    c.initiativeTotal = roll + c.initiativeBonus + ADVANTAGE_NUM[c.advantage] + equipmentInitBonus(c)
  })
  combatants.sort((a, b) => b.initiativeTotal - a.initiativeTotal)
  combatants.forEach((c, idx) => (c.order = idx + 1))
  state.value = 'initiative'
  saveLocal()
  drawNotifier.value++
}

// 装备/特性给的一定修正值（示例：可由前端识别，先按 0 或可编辑）
function equipmentInitBonus(c: Combatant): number {
  // 第一版：怪物/角色在创建时可填"装备先攻修正"，先用 payload 内字段
  const b = (c.payload && c.payload.equipmentInitiativeBonus) || 0
  return Number(b) || 0
}

// 换位（技能允许互换行动顺序）
export function swapCombatants(aId: string, bId: string) {
  if (locked.value) return
  const a = combatants.find((c) => c.id === aId)
  const b = combatants.find((c) => c.id === bId)
  if (!a || !b) return
  const to = a.order
  a.order = b.order
  b.order = to
  saveLocal()
  drawNotifier.value++
}

// 回合
export function nextRound() {
  if (!currentCombatantId.value && combatants.length) {
    currentCombatantId.value = orderedCombatants.value[0]?.id || null
  } else {
    const idx = orderedCombatants.value.findIndex((c) => c.id === currentCombatantId.value)
    const next = orderedCombatants.value[(idx + 1) % orderedCombatants.value.length]
    currentCombatantId.value = next?.id || null
    if (idx === orderedCombatants.value.length - 1) round.value++
  }
  state.value = 'combat'
  saveLocal()
  drawNotifier.value++
}

// ========== 法术区域 ==========
export function addSpellArea(area: Partial<SpellArea>) {
  const a: SpellArea = {
    id: uid(),
    type: area.type || 'circle',
    q: area.q || 0,
    r: area.r || 0,
    angle: area.angle || 0,
    ft: area.ft || 30,
    boundTo: area.boundTo ?? null,
  }
  spellAreas.push(a)
  saveLocal()
  drawNotifier.value++
  return a
}
export function removeSpellArea(id: string) {
  const i = spellAreas.findIndex((a) => a.id === id)
  if (i !== -1) spellAreas.splice(i, 1)
  saveLocal()
  drawNotifier.value++
}

// ========== 工具 ==========
function sizeFromCard(size: string | undefined): number {
  const s = size || ''
  if (s.includes('超巨')) return 4
  if (s.includes('巨型')) return 3
  if (s.includes('大型')) return 2
  if (s.includes('微型')) return 0.5
  return 1
}
function hashColor(id: string): string {
  const palette = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#f97316', '#ec4899']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export function useCombatSession() {
  return {
    sessionId,
    state,
    combatants,
    orderedCombatants,
    spellAreas,
    round,
    currentCombatantId,
    currentCombatant,
    locked,
    online,
    lastSync,
    drawNotifier,
    // lifecycle
    createSession,
    createOrJoinParty,
    joinSession,
    resetSession,
    toggleLock,
    // combatants
    addCharacter,
    addMonster,
    removeCombatant,
    moveCombatant,
    hpCombatant,
    rollInitiative,
    swapCombatants,
    nextRound,
    // spell areas
    addSpellArea,
    removeSpellArea,
    // persistence / reverb
    saveLocal,
    loadLocal,
    hookReverb,
    disconnectReverb,
  }
}
