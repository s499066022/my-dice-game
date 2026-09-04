// src/composables/useCombatSession.ts
// 战斗会话 store：一份"当前战斗"的权威态（先攻/站位/HP/法术区域/回合）。
//
// 数据流（后端可用时）：
//   - 用户操作 -> 本地立即生效(乐观) -> PATCH/POST/DELETE 到后端
//   - 后端广播（presence-combat.{sessionId} 裸名事件）-> 增量应用到本地（权威）
//   - 进会先 GET 快照；断线自动回退 localStorage（serverMode=false）
// 第一版"全员可改"。

import { reactive, ref, computed } from 'vue'
import type { CharacterCard } from '../data/dndModel'
import { getInitiativeTotal, getTotalAC } from '../data/dndModel'
import { uid } from '../data/dndModel'
import { connectReverb, leaveReverb, connectCharacterCards } from '../api/reverb'
import {
  backendPatchCardBlock,
  backendCombatSessionShow,
  backendCombatantsSync,
  backendCombatantAdd,
  backendCombatantPatch,
  backendCombatantDelete,
  backendCombatantSwap,
  backendRollInitiative,
  backendSetLock,
  backendTurn,
  backendSpellAreaAdd,
  backendSpellAreaUpdate,
  backendSpellAreaDelete,
} from '../api/characterBackend'

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
  controlledBy?: string
  payload?: any // 角色卡/怪物卡完整信息（记录用）
}

export interface SpellArea {
  id: string
  type: 'cone' | 'circle' | 'rect'
  q: number
  r: number
  angle: number
  ft: number
  widthFt?: number // rect：宽（尺）
  heightFt?: number // rect：长（尺）
  wx?: number // rect：世界坐标中心 X（基础尺，浮点，保证边精确落在所点两点）
  wy?: number
  boundTo: string | null
}

const STORAGE_KEY = 'dnd-combat-session'
const LAST_PARTY_KEY = 'dnd-last-party'
const ADVANTAGE_NUM: Record<CombatantAdvantage, number> = { normal: 0, advantage: 5, disadvantage: -5 }

// 模块级单例状态（地图 / 面板共享）
const sessionId = ref('')
const state = ref<'setup' | 'initiative' | 'combat' | 'ended'>('setup')
const combatants = reactive<Combatant[]>([])
const spellAreas = reactive<SpellArea[]>([])
const round = ref(1)
const currentCombatantId = ref<string | null>(null)
const locked = ref(false)
const connected = ref(false) // REST 已连通（后端权威模式）
const online = ref(false) // Reverb 长连接已订阅
const lastSync = ref('')

const orderedCombatants = computed(() => [...combatants].sort((a, b) => a.order - b.order))
const currentCombatant = computed(() => combatants.find((c) => c.id === currentCombatantId.value) || null)

// 用于通知渲染层重绘
const drawNotifier = ref(0)

function sessionKey(): string {
  return sessionId.value ? `${STORAGE_KEY}-${sessionId.value}` : STORAGE_KEY
}

export function getLastPartyId(): string {
  try {
    return localStorage.getItem(LAST_PARTY_KEY) || ''
  } catch {
    return ''
  }
}

function saveLocal() {
  try {
    localStorage.setItem(
      sessionKey(),
      JSON.stringify({
        sessionId: sessionId.value,
        state: state.value,
        combatants,
        spellAreas,
        round: round.value,
        currentCombatantId: currentCombatantId.value,
        locked: locked.value,
      })
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

// ========== 字段转换（本地 camelCase <-> 后端 snake_case） ==========
function localToApi(c: Combatant): any {
  return {
    id: c.id,
    type: c.type,
    ref_id: c.refId || null,
    name: c.name,
    color: c.color,
    size: c.size,
    q: c.q,
    r: c.r,
    order: c.order,
    initiative_roll: c.initiativeRoll || null,
    initiative_bonus: c.initiativeBonus || 0,
    initiative_total: c.initiativeTotal || null,
    advantage: c.advantage || 'normal',
    ac: c.ac,
    hp: { current: c.hp?.current || 0, max: c.hp?.max || 0 },
    controlled_by: c.controlledBy || null,
    // 注意：Reverb/Pusher 单条消息约 10KB 上限。
    // 角色卡完整数据在 /characters 表（combatant.ref_id 关联），不重复塞进 payload；
    // 怪物 payload 保留（第一版仅记录，勿放大卡数据以免广播超限）。
    payload: c.type === 'character' ? null : c.payload ?? null,
  }
}

function apiToLocal(a: any): Combatant {
  const adv: CombatantAdvantage = a.advantage === 'advantage' || a.advantage === 'disadvantage' ? a.advantage : 'normal'
  return {
    id: a.id,
    type: a.type === 'monster' ? 'monster' : 'character',
    refId: a.ref_id || undefined,
    name: a.name || '参战者',
    color: a.color || '#ef4444',
    size: Number(a.size) || 1,
    q: a.q == null ? 0 : Number(a.q),
    r: a.r == null ? 0 : Number(a.r),
    order: Number(a.order) || 0,
    initiativeRoll: a.initiative_roll == null ? 0 : Number(a.initiative_roll),
    initiativeBonus: Number(a.initiative_bonus) || 0,
    initiativeTotal: a.initiative_total == null ? 0 : Number(a.initiative_total),
    advantage: adv,
    ac: a.ac == null ? 10 : Number(a.ac),
    hp: {
      current: Number(a.hp?.current) || 0,
      max: Number(a.hp?.max) || 0,
    },
    controlledBy: a.controlled_by || undefined,
    payload: a.payload && typeof a.payload === 'object' ? a.payload : undefined,
  }
}

function areaToApi(a: SpellArea): any {
  return {
    id: a.id,
    type: a.type,
    q: a.q,
    r: a.r,
    angle: a.angle,
    ft: a.ft,
    width_ft: a.widthFt ?? null,
    height_ft: a.heightFt ?? null,
    wx: a.wx ?? null,
    wy: a.wy ?? null,
    bound_to: a.boundTo || null,
  }
}

function apiToArea(a: any): SpellArea {
  return {
    id: a.id,
    type: a.type === 'rect' ? 'rect' : a.type === 'cone' ? 'cone' : 'circle',
    q: a.q == null ? 0 : Number(a.q),
    r: a.r == null ? 0 : Number(a.r),
    angle: a.angle == null ? 0 : Number(a.angle),
    ft: a.ft == null ? 30 : Number(a.ft),
    widthFt: a.width_ft == null ? undefined : Number(a.width_ft),
    heightFt: a.height_ft == null ? undefined : Number(a.height_ft),
    wx: a.wx == null ? undefined : Number(a.wx),
    wy: a.wy == null ? undefined : Number(a.wy),
    boundTo: a.bound_to || null,
  }
}

// ========== 快照 / 增量应用 ==========
function applySnapshot(snap: any) {
  if (!snap) return
  if (snap.id) sessionId.value = snap.id
  if (snap.state) state.value = snap.state
  if (snap.locked !== undefined) locked.value = !!snap.locked
  if (snap.round !== undefined && snap.round !== null) round.value = Number(snap.round) || 1
  if (snap.current_combatant_id !== undefined) currentCombatantId.value = snap.current_combatant_id || null
  if (Array.isArray(snap.combatants)) {
    combatants.length = 0
    combatants.push(...snap.combatants.map(apiToLocal))
  }
  if (Array.isArray(snap.spell_areas)) {
    spellAreas.length = 0
    spellAreas.push(...snap.spell_areas.map(apiToArea))
  }
  lastSync.value = new Date().toISOString()
  saveLocal()
  drawNotifier.value++
}

function upsertApiCombatant(a: any) {
  if (!a || !a.id) return
  const loc = apiToLocal(a)
  const i = combatants.findIndex((c) => c.id === a.id)
  if (i >= 0) combatants[i] = loc
  else combatants.push(loc)
  saveLocal()
  drawNotifier.value++
}

function removeCombatantLocal(id: string) {
  const i = combatants.findIndex((c) => c.id === id)
  if (i !== -1) combatants.splice(i, 1)
  spellAreas.forEach((x) => {
    if (x.boundTo === id) x.boundTo = null
  })
  if (currentCombatantId.value === id) currentCombatantId.value = null
  saveLocal()
  drawNotifier.value++
}

function swapOrdersLocal(aId: string, bId: string) {
  const a = combatants.find((c) => c.id === aId)
  const b = combatants.find((c) => c.id === bId)
  if (!a || !b) return
  const to = a.order
  a.order = b.order
  b.order = to
  saveLocal()
  drawNotifier.value++
}

function applyOrderLocal(orderList: any[]) {
  if (!Array.isArray(orderList)) return
  orderList.forEach((o) => {
    const c = combatants.find((x) => x.id === o.combatant_id)
    if (!c) return
    c.order = Number(o.order) || c.order
    if (o.initiative_total != null) c.initiativeTotal = Number(o.initiative_total)
  })
  saveLocal()
  drawNotifier.value++
}

function upsertApiArea(a: any) {
  if (!a || !a.id) return
  const loc = apiToArea(a)
  const i = spellAreas.findIndex((x) => x.id === a.id)
  if (i >= 0) spellAreas[i] = loc
  else spellAreas.push(loc)
  saveLocal()
  drawNotifier.value++
}

// ========== Reverb 订阅 ==========
let channelHandle: any = null
let lastSessionForEcho = ''

function hookReverb() {
  if (!sessionId.value || lastSessionForEcho === sessionId.value) return
  if (channelHandle) {
    try {
      channelHandle = null
    } catch {
      /* 忽略 */
    }
  }
  if (lastSessionForEcho && lastSessionForEcho !== sessionId.value) leaveReverb(lastSessionForEcho)
  lastSessionForEcho = sessionId.value
  channelHandle = connectReverb(sessionId.value, {
    onSessionState: (snap: any) => applySnapshot(snap),
    onCombatantAdded: (a: any) => upsertApiCombatant(a),
    onCombatantUpdated: (a: any) => upsertApiCombatant(a),
    onCombatantRemoved: (id: string) => removeCombatantLocal(id),
    onInitiativeRolled: (order: any[]) => {
      applyOrderLocal(order)
      refreshSession()
    },
    onCombatantSwapped: (a: string, b: string) => swapOrdersLocal(a, b),
    onSpellAreaUpdated: (area: any) => {
      if (area && area.deleted) {
        const i = spellAreas.findIndex((x) => x.id === area.id)
        if (i !== -1) spellAreas.splice(i, 1)
        saveLocal()
        drawNotifier.value++
      } else {
        upsertApiArea(area)
      }
    },
    onTurnChanged: (cur: string | null, roundN: number) => {
      if (cur !== undefined) currentCombatantId.value = cur
      if (roundN) round.value = roundN
      if (state.value === 'setup' || state.value === 'initiative') state.value = 'combat'
      saveLocal()
      drawNotifier.value++
    },
    onSessionLocked: (l: boolean) => {
      locked.value = !!l
      saveLocal()
      drawNotifier.value++
    },
    onOnline: (v: boolean) => {
      online.value = v
      if (v) refreshSession() // 订阅成功后自愈一次
    },
  })
  if (!channelHandle) online.value = false
}

function disconnectReverb() {
  if (lastSessionForEcho) leaveReverb(lastSessionForEcho)
  lastSessionForEcho = ''
  channelHandle = null
  online.value = false
}

// 向后端拉一次完整快照并应用
let refreshing = false
async function refreshSession(): Promise<boolean> {
  if (!sessionId.value) return false
  if (refreshing) return false
  refreshing = true
  try {
    const snap = await backendCombatSessionShow(sessionId.value)
    if (snap) {
      connected.value = true
      applySnapshot(snap)
      return true
    }
    connected.value = false
    return false
  } finally {
    refreshing = false
  }
}

// ========== 会话生命周期 ==========
export async function createOrJoinParty(partyId: string): Promise<{ existed: boolean }> {
  sessionId.value = partyId
  connected.value = false
  try {
    localStorage.setItem(LAST_PARTY_KEY, partyId)
  } catch {
    /* 忽略 */
  }
  hookReverb()
  const snap = await backendCombatSessionShow(partyId) // GET 会自动建会（id=party_id）
  if (snap) {
    connected.value = true
    applySnapshot(snap)
    return { existed: snap.combatants?.length > 0 }
  }
  // 后端不可达：读取上次本地数据兜底
  const existed = !!localStorage.getItem(sessionKey())
  if (existed) loadLocal()
  else {
    state.value = 'setup'
    round.value = 1
    currentCombatantId.value = null
    locked.value = false
    combatants.splice(0)
    spellAreas.splice(0)
    saveLocal()
  }
  return { existed }
}

export function joinSession(id: string) {
  sessionId.value = id
  loadLocal()
  hookReverb()
}

export function leaveSession() {
  disconnectReverb()
  sessionId.value = ''
  connected.value = false
}

export function resetSession() {
  const key = sessionKey()
  leaveSession()
  state.value = 'setup'
  round.value = 1
  currentCombatantId.value = null
  locked.value = false
  combatants.splice(0)
  spellAreas.splice(0)
  try {
    localStorage.removeItem(key)
    localStorage.removeItem(LAST_PARTY_KEY)
  } catch {
    /* 忽略 */
  }
  saveLocal()
}

export function toggleLock() {
  locked.value = !locked.value
  saveLocal()
  drawNotifier.value++
  if (connected.value && sessionId.value) {
    backendSetLock(sessionId.value, locked.value)
  }
}

// ========== 参战者 ==========
export function addCharacter(card: CharacterCard): Combatant {
  const existing = combatants.find((x) => x.type === 'character' && x.refId === card.id)
  if (existing) return existing
  const c = buildCharacter(card)
  combatants.push(c)
  saveLocal()
  drawNotifier.value++
  if (connected.value && sessionId.value) {
    backendCombatantAdd(sessionId.value, localToApi(c)).then((r) => {
      if (r && r.ok === true && r.data) upsertApiCombatant(r.data)
      else if (r && r.ok === false) refreshSession() // 重复加入/锁定 -> 拉权威态纠正
    })
  }
  return c
}

export function addMonster(data: Partial<Combatant>): Combatant {
  const pos = data.q != null && data.r != null ? { q: data.q as number, r: data.r as number } : nextFreePos()
  const c: Combatant = {
    id: uid(),
    type: 'monster',
    name: data.name || '怪物',
    color: data.color || '#ef4444',
    size: data.size || 1,
    q: pos.q,
    r: pos.r,
    order: combatants.length ? Math.max(...combatants.map((x) => x.order)) + 1 : 1,
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
  if (connected.value && sessionId.value) {
    backendCombatantAdd(sessionId.value, localToApi(c)).then((r) => {
      if (r && r.ok === true && r.data) upsertApiCombatant(r.data)
      else if (r && r.ok === false) refreshSession()
    })
  }
  return c
}

function buildCharacter(card: CharacterCard): Combatant {
  const pos = nextFreePos()
  return {
    id: uid(),
    type: 'character',
    refId: card.id,
    name: card.name || '角色',
    color: hashColor(card.id),
    size: sizeFromCard(card.size),
    q: pos.q,
    r: pos.r,
    order: combatants.length ? Math.max(...combatants.map((c) => c.order)) + 1 : 1,
    initiativeRoll: 0,
    initiativeBonus: getInitiativeTotal(card),
    initiativeTotal: 0,
    advantage: (card.initiativeAdvantage as CombatantAdvantage) || 'normal',
    ac: getTotalAC(card),
    hp: { current: card.hp.current, max: card.hp.max },
    // 不携带整张角色卡（Reverb 广播 10KB 限制）；数据经 ref_id 关联 /characters
    payload: undefined,
  }
}

// 自动加入：从原点向两边"一字排开"，避免叠放
function nextFreePos(): { q: number; r: number } {
  const i = combatants.length
  return { q: i - Math.floor(i / 2), r: 0 }
}

export function removeCombatant(id: string) {
  if (locked.value) return
  const bound = spellAreas.filter((a) => a.boundTo === id).map((a) => a.id)
  removeCombatantLocal(id)
  if (connected.value) {
    backendCombatantDelete(id)
    // 把绑定到被删参战者的法术区解绑（同步到后端）
    bound.forEach((aid) => backendSpellAreaUpdate(aid, { bound_to: null }))
  }
}

// 位置（拖拽）；防抖合并连续移动
const moveTimers: Record<string, any> = {}
export function moveCombatant(id: string, q: number, r: number) {
  if (locked.value) return
  const c = combatants.find((x) => x.id === id)
  if (!c) return
  c.q = q
  c.r = r
  drawNotifier.value++
  if (!connected.value) {
    saveLocal()
    return
  }
  clearTimeout(moveTimers[id])
  moveTimers[id] = setTimeout(() => {
    backendCombatantPatch(id, { q, r })
    saveLocal()
  }, 60)
}

// 直接设定 HP（面板/地图的输入框）
export function setHp(id: string, hp: { current?: number; max?: number }) {
  const c = combatants.find((x) => x.id === id)
  if (!c) return
  const curIn = hp.current != null ? Number(hp.current) : c.hp.current
  const maxIn = hp.max != null ? Number(hp.max) : c.hp.max
  if (hp.current != null && !Number.isFinite(curIn)) return
  if (hp.max != null && !Number.isFinite(maxIn)) return
  const max = Math.max(1, maxIn)
  const cur = Math.min(Math.max(0, curIn), max)
  c.hp = { current: cur, max }
  saveLocal()
  drawNotifier.value++
  if (connected.value) {
    backendCombatantPatch(id, { hp: c.hp })
    pushHpToCard(c)
  }
}

// HP（按差值扣/加）
export function hpCombatant(id: string, delta: number) {
  const c = combatants.find((x) => x.id === id)
  if (!c) return
  c.hp.current = Math.max(0, Math.min(c.hp.max, c.hp.current + delta))
  saveLocal()
  drawNotifier.value++
  if (connected.value) {
    backendCombatantPatch(id, { hp: c.hp })
    pushHpToCard(c)
  }
}

// 行内编辑（颜色/优劣/HP/名字/AC/体型 等）整条 PATCH
export function syncCombatant(id: string) {
  const c = combatants.find((x) => x.id === id)
  if (!c) return
  saveLocal()
  drawNotifier.value++
  if (connected.value) {
    backendCombatantPatch(id, {
      name: c.name,
      color: c.color,
      size: c.size,
      advantage: c.advantage,
      ac: c.ac,
      hp: c.hp,
    })
  }
}

// 掷先攻（后端权威；离线时本地）
export async function rollInitiative() {
  if (connected.value && sessionId.value) {
    const r = await backendRollInitiative(sessionId.value)
    if (r && r.ok === true) {
      await refreshSession() // 拉回含 initiative_roll 的完整快照
      return true
    }
    if (r && r.ok === false) return false
  }
  // 离线兜底
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
  return true
}

// 装备/特性给的一定修正值（第一版取 payload 字段）
function equipmentInitBonus(c: Combatant): number {
  const b = c.payload && c.payload.equipmentInitiativeBonus
  return Number(b) || 0
}

// 换位
export async function swapCombatants(aId: string, bId: string): Promise<boolean> {
  if (locked.value) return false
  const a = combatants.find((c) => c.id === aId)
  const b = combatants.find((c) => c.id === bId)
  if (!a || !b) return false
  if (connected.value) {
    const r = await backendCombatantSwap(aId, bId)
    if (r && r.ok === true) {
      swapOrdersLocal(aId, bId)
      return true
    }
    return false
  }
  swapOrdersLocal(aId, bId)
  return true
}

// 下回合 / 回合轮转
export async function nextRound(): Promise<void> {
  if (connected.value && sessionId.value) {
    const r = await backendTurn(sessionId.value)
    if (r && r.ok === true && r.data) {
      currentCombatantId.value = r.data.current_combatant_id || null
      round.value = Number(r.data.round) || 1
      if (state.value === 'setup' || state.value === 'initiative') state.value = 'combat'
      saveLocal()
      drawNotifier.value++
      return
    }
  }
  // 离线兜底
  if (!currentCombatantId.value && combatants.length) {
    currentCombatantId.value = orderedCombatants.value[0]?.id || null
  } else if (combatants.length) {
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
export function addSpellArea(area: Partial<SpellArea>): SpellArea {
  const a: SpellArea = {
    id: uid(),
    type: area.type || 'circle',
    q: area.q || 0,
    r: area.r || 0,
    angle: area.angle || 0,
    ft: area.ft ?? (area.type === 'rect' ? 0 : 30),
    widthFt: area.widthFt,
    heightFt: area.heightFt,
    wx: area.wx,
    wy: area.wy,
    boundTo: area.boundTo ?? null,
  }
  spellAreas.push(a)
  saveLocal()
  drawNotifier.value++
  if (connected.value && sessionId.value) {
    backendSpellAreaAdd(sessionId.value, areaToApi(a)).then((r) => {
      if (r && r.ok === false) refreshSession()
    })
  }
  return a
}

export function removeSpellArea(id: string) {
  const i = spellAreas.findIndex((a) => a.id === id)
  if (i !== -1) spellAreas.splice(i, 1)
  saveLocal()
  drawNotifier.value++
  if (connected.value) backendSpellAreaDelete(id)
}

// 修改法术区域（类型/位置/角度/尺数/绑定）
export function updateSpellArea(id: string, fields: Partial<SpellArea>) {
  const a = spellAreas.find((x) => x.id === id)
  if (!a) return
  if (fields.type === 'cone' || fields.type === 'circle' || fields.type === 'rect') a.type = fields.type
  if (fields.q !== undefined) a.q = fields.q
  if (fields.r !== undefined) a.r = fields.r
  if (fields.angle !== undefined) a.angle = fields.angle
  if (fields.ft !== undefined) a.ft = fields.ft
  if (fields.widthFt !== undefined) a.widthFt = fields.widthFt
  if (fields.heightFt !== undefined) a.heightFt = fields.heightFt
  if ('boundTo' in fields) a.boundTo = fields.boundTo ?? null
  saveLocal()
  drawNotifier.value++
  if (connected.value) backendSpellAreaUpdate(id, areaToApi(a))
}

// ========== 角色卡 -> 会话 单向只读同步（除 HP 外，会话不得反向改卡） ==========
let cardSourceBound = false

function pushHpToCard(c: Combatant) {
  if (c.type === 'character' && c.refId && connected.value && sessionId.value) {
    backendPatchCardBlock(c.refId, 'combat', { hp: { current: c.hp.current, max: c.hp.max } })
  }
}

// 订阅 presence-characters：卡上 name/AC/体型 变化 -> 同步到同 ref_id 的参战者（只读跟随，绝不反向）
export function bindCardSource() {
  if (cardSourceBound) return
  cardSourceBound = true
  connectCharacterCards({
    onCardUpdated: (id: string, block: string, data: any) => {
      if (block !== 'combat' || !data) return
      let touched = false
      combatants.forEach((c) => {
        if (c.type !== 'character' || !c.refId || c.refId !== id) return
        const patch: any = {}
        if (data.name !== undefined && String(data.name) !== String(c.name)) {
          c.name = String(data.name)
          patch.name = c.name
        }
        if (data.ac !== undefined && Number(data.ac) !== Number(c.ac)) {
          c.ac = Number(data.ac)
          patch.ac = c.ac
        }
        if (data.size !== undefined && Number(data.size) !== Number(c.size)) {
          c.size = Number(data.size)
          patch.size = c.size
        }
        if (Object.keys(patch).length && connected.value) {
          touched = true
          backendCombatantPatch(c.id, patch) // 让会话服务端/其它地图端也更新
        }
      })
      if (touched) {
        saveLocal()
        drawNotifier.value++
      }
    },
  })
}

// ========== 团成员对账（后端一次 sync / 离线本地） ==========
export async function reconcileParty(cards: CharacterCard[]): Promise<void> {
  if (connected.value && sessionId.value) {
    const list: Combatant[] = []
    const seen = new Set<string>()
    // 保留现有角色类（含位置/先攻/HP），并去掉不在当前团的
    combatants.forEach((c) => {
      if (c.type !== 'character') return
      if (!c.refId) return
      if (cards.some((card) => card.id === c.refId)) {
        list.push(c)
        seen.add(c.refId)
      }
    })
    // 补上团里缺失的角色
    cards.forEach((card) => {
      if (seen.has(card.id)) return
      list.push(buildCharacter(card))
      seen.add(card.id)
    })
    const r = await backendCombatantsSync(sessionId.value, list.map(localToApi))
    if (r && r.ok === true) {
      await refreshSession()
      return
    }
    // sync 失败（锁定/网络）退回本地对账
    if (r && r.ok === false) return
  }
  // 离线：本地对账（怪物保留）
  const refIds = new Set(cards.map((c) => c.id))
  for (let i = combatants.length - 1; i >= 0; i--) {
    const cmb = combatants[i]
    if (cmb.type === 'character' && cmb.refId && !refIds.has(cmb.refId)) {
      if (locked.value) continue
      removeCombatantLocal(cmb.id)
    }
  }
  cards.forEach((card) => {
    if (!combatants.some((x) => x.type === 'character' && x.refId === card.id)) addCharacter(card)
  })
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
    connected,
    online,
    lastSync,
    drawNotifier,
    // lifecycle
    createOrJoinParty,
    joinSession,
    leaveSession,
    resetSession,
    toggleLock,
    // combatants
    addCharacter,
    addMonster,
    removeCombatant,
    moveCombatant,
    hpCombatant,
    setHp,
    syncCombatant,
    rollInitiative,
    swapCombatants,
    nextRound,
    reconcileParty,
    // spell areas
    addSpellArea,
    removeSpellArea,
    updateSpellArea,
    bindCardSource,
    // persistence / reverb
    saveLocal,
    loadLocal,
    hookReverb,
    disconnectReverb,
    refreshSession,
    getLastPartyId,
  }
}
