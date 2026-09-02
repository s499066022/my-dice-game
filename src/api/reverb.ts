// src/api/reverb.ts
// Laravel Reverb 长连接（laravel-echo + pusher-js）。
// 若尚未在 main.ts 初始化 window.Echo，则优雅降级为 localStorage（online=false）；
// 装上依赖并在 main.ts 初始化后，hookReverb 会自动走长连接全员同步。

interface ReverbHandlers {
  onSnapshot?: (data: any) => void
  onUpdate?: () => void
  onOnline?: (online: boolean) => void
}

// 初始化入口（在 main.ts 调用；依赖安装后取消注释）
// import Echo from 'laravel-echo'
// export function initEcho() {
//   ;(window as any).Echo = new Echo({
//     broadcaster: 'reverb',
//     key: import.meta.env.VITE_REVERB_APP_KEY,
//     wsHost: import.meta.env.VITE_REVERB_HOST,
//     wsPort: import.meta.env.VITE_REVERB_PORT,
//     wssPort: import.meta.env.VITE_REVERB_PORT,
//     forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
//     enabledTransports: ['ws', 'wss'],
//   })
// }

export function connectReverb(channel: string, handlers: ReverbHandlers): any {
  try {
    const Ech = (window as any).Echo
    if (Ech && Ech.channel) {
      const ch = Ech.channel('presence-' + channel)
      ch.listen('.CombatSessionState', (e: any) => handlers.onSnapshot?.(e.data))
      ch.listen('.CombatantUpdated', () => handlers.onUpdate?.())
      ch.listen('.CombatantAdded', () => handlers.onUpdate?.())
      ch.listen('.CombatantRemoved', () => handlers.onUpdate?.())
      ch.listen('.CombatantSwapped', () => handlers.onUpdate?.())
      ch.listen('.InitiativeRolled', () => handlers.onUpdate?.())
      ch.listen('.SpellAreaUpdated', () => handlers.onUpdate?.())
      ch.listen('.TurnChanged', () => handlers.onUpdate?.())
      handlers.onOnline?.(true)
      return ch
    }
  } catch (e) {
    // 忽略：未连接时走本地
  }
  handlers.onOnline?.(false)
  return null
}
