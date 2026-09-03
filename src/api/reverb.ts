// src/api/reverb.ts
// Laravel Reverb 长连接（laravel-echo + pusher-js，Pusher 协议）。
// 后端（chain/php）事实：
//   - 频道 presence-combat.{sessionId}（Laravel PresenceChannel('combat.x') -> presence-combat.x）
//   - 事件为裸名（broadcastAs 类短名）：CombatSessionState / CombatantAdded / CombatantUpdated /
//     CombatantRemoved / InitiativeRolled / CombatantSwapped / SpellAreaUpdated / TurnChanged / SessionLocked
//   - 载荷统一在 e.data 下
//   - 鉴权：POST {base}/broadcasting/auth，可带 X-Dnd-User 头区分 presence 成员
// 若未初始化（window.Echo 缺失），优雅降级为 localStorage（online=false）。

import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { getBackendBase, userId } from './characterBackend'
import { logWs, summarize } from './wsLog'

// ---------- Reverb 连接参数（可经 VITE_REVERB_* 覆盖；无 env 时兜底线上） ----------
const REVERB_KEY = (import.meta.env.VITE_REVERB_APP_KEY as string) || '163b438a069828cd1dd3dc585a607eab'
// WS host 自适应：默认跟随页面 hostname（本地/局域网多设备都连到“后端所在主机”的 12226 反代）；
// 需要其它地址（如线上）时用 VITE_REVERB_HOST 覆盖。
const DEFAULT_HOST = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : '127.0.0.1'
const REVERB_HOST = (import.meta.env.VITE_REVERB_HOST as string) || DEFAULT_HOST
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT || 12226)
const REVERB_SCHEME = ((import.meta.env.VITE_REVERB_SCHEME as string) || 'http').toLowerCase()

export function initEcho(): void {
  if ((window as any).Echo) return
  try {
    ;(window as any).Pusher = Pusher
    ;(window as any).Echo = new Echo({
      broadcaster: 'reverb',
      key: REVERB_KEY,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      wssPort: REVERB_PORT,
      forceTLS: REVERB_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${getBackendBase()}/broadcasting/auth`,
      auth: { headers: { 'X-Dnd-User': userId() } },
    })
    // 连接状态上报（供页面调试长连接）
    try {
      const conn: any = (window as any).Echo?.connector?.pusher?.connection
      if (conn) {
        conn.bind('state_change', (st: any) => logWs('sys', 'echo', 'WS状态', `${st?.previous} → ${st?.current}`))
        conn.bind('error', (e: any) => logWs('err', 'echo', 'WS错误', summarize(e)))
      }
    } catch (e) {
      /* 忽略 */
    }
  } catch (e) {
    console.error('initEcho 失败，走本地模式', e)
    ;(window as any).Echo = null
  }
}

export function hasEcho(): boolean {
  try {
    return !!(window as any).Echo && typeof (window as any).Echo.channel === 'function'
  } catch {
    return false
  }
}

export interface ReverbHandlers {
  onSessionState?: (snapshot: any) => void
  onCombatantAdded?: (combatant: any) => void
  onCombatantUpdated?: (combatant: any) => void
  onCombatantRemoved?: (combatantId: string) => void
  onInitiativeRolled?: (order: any[]) => void
  onCombatantSwapped?: (aId: string, bId: string) => void
  onSpellAreaUpdated?: (spellArea: any) => void
  onTurnChanged?: (currentCombatantId: string | null, round: number) => void
  onSessionLocked?: (locked: boolean) => void
  onOnline?: (online: boolean) => void
}

// 订阅 presence-combat.{sessionId}；返回可 leave 的句柄，失败返回 null
export function connectReverb(sessionId: string, handlers: ReverbHandlers): any {
  const echo: any = (window as any).Echo
  if (!sessionId || !echo || !echo.channel) {
    handlers.onOnline?.(false)
    return null
  }
  const chanName = 'presence-combat.' + sessionId
  const logIn = (ev: string) => (e: any) => {
    logWs('in', chanName, '.' + ev, summarize(e?.data ?? e))
  }
  try {
    logWs('sys', chanName, '加入频道', `ws://${REVERB_HOST}:${REVERB_PORT}/app/…`)
    const ch = echo.join('combat.' + sessionId) // -> presence-combat.{sessionId}
    ch.listen('.CombatSessionState', (e: any) => { logIn('CombatSessionState')(e); handlers.onSessionState?.(e?.data ?? e) })
    ch.listen('.CombatantAdded', (e: any) => { logIn('CombatantAdded')(e); handlers.onCombatantAdded?.((e?.data ?? e)?.combatant) })
    ch.listen('.CombatantUpdated', (e: any) => { logIn('CombatantUpdated')(e); handlers.onCombatantUpdated?.((e?.data ?? e)?.combatant) })
    ch.listen('.CombatantRemoved', (e: any) => { logIn('CombatantRemoved')(e); handlers.onCombatantRemoved?.((e?.data ?? e)?.combatant_id) })
    ch.listen('.InitiativeRolled', (e: any) => { logIn('InitiativeRolled')(e); handlers.onInitiativeRolled?.((e?.data ?? e)?.order) })
    ch.listen('.CombatantSwapped', (e: any) => {
      logIn('CombatantSwapped')(e)
      const d = e?.data ?? e
      handlers.onCombatantSwapped?.(d?.a_id, d?.b_id)
    })
    ch.listen('.SpellAreaUpdated', (e: any) => { logIn('SpellAreaUpdated')(e); handlers.onSpellAreaUpdated?.((e?.data ?? e)?.spell_area) })
    ch.listen('.TurnChanged', (e: any) => {
      logIn('TurnChanged')(e)
      const d = e?.data ?? e
      handlers.onTurnChanged?.(d?.current_combatant_id, d?.round)
    })
    ch.listen('.SessionLocked', (e: any) => { logIn('SessionLocked')(e); handlers.onSessionLocked?.((e?.data ?? e)?.locked) })
    ch.here(() => {
      logWs('sys', chanName, '订阅成功（在线成员）')
      handlers.onOnline?.(true)
    })
    ch.error?.(() => {
      logWs('err', chanName, '订阅失败')
      handlers.onOnline?.(false)
    })
    return ch
  } catch (e) {
    logWs('err', chanName, '订阅异常', summarize(e))
    console.error('订阅战斗频道失败', e)
    handlers.onOnline?.(false)
    return null
  }
}

export function leaveReverb(sessionId: string): void {
  try {
    const echo: any = (window as any).Echo
    if (echo && echo.leaveChannel) {
      echo.leaveChannel('presence-combat.' + sessionId)
    }
  } catch {
    // 忽略
  }
}

// ========== 角色卡实时（presence-characters，API.md §2.2/§7） ==========
export interface CharacterCardHandlers {
  onCardUpdated?: (id: string, block: string, data: any) => void
  onCardRemoved?: (id: string) => void
  onSpellUpdated?: (cardId: string, spell: any) => void
  onOnline?: (online: boolean) => void
}

let cardsChannel: any = null

// 订阅 presence-characters；返回是否成功
export function connectCharacterCards(handlers: CharacterCardHandlers): boolean {
  const echo: any = (window as any).Echo
  if (!echo || !echo.join) {
    handlers.onOnline?.(false)
    return false
  }
  try {
    if (!cardsChannel) {
      cardsChannel = echo.join('characters') // -> presence-characters
      logWs('sys', 'presence-characters', '加入频道')
      cardsChannel.listen('.CharacterCardUpdated', (e: any) => {
        const d = e?.data ?? e
        logWs('in', 'presence-characters', '.CharacterCardUpdated', summarize(d))
        handlers.onCardUpdated?.(d?.id, d?.block, d?.data ?? {})
      })
      cardsChannel.listen('.CharacterCardRemoved', (e: any) => {
        const d = e?.data ?? e
        logWs('in', 'presence-characters', '.CharacterCardRemoved', summarize(d))
        handlers.onCardRemoved?.(d?.id)
      })
      cardsChannel.listen('.SpellUpdated', (e: any) => {
        const d = e?.data ?? e
        logWs('in', 'presence-characters', '.SpellUpdated', summarize(d))
        handlers.onSpellUpdated?.(d?.card_id, d?.spell)
      })
      cardsChannel.here(() => {
        logWs('sys', 'presence-characters', '订阅成功（在线成员）')
        handlers.onOnline?.(true)
      })
      cardsChannel.error?.(() => {
        logWs('err', 'presence-characters', '订阅失败')
        handlers.onOnline?.(false)
      })
    }
    return true
  } catch (e) {
    console.error('订阅角色卡频道失败', e)
    handlers.onOnline?.(false)
    return false
  }
}
