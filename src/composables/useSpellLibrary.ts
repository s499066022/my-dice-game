// src/composables/useSpellLibrary.ts
// 法术库：内置标准库（spellLibrary.json，由 m.xlsx 转换，543 条）+ 用户自定义条目（localStorage）。
// 用法：像"武器库"一样供所有角色卡从库中挑选法术，或在库里自定义新增。

import { ref } from 'vue'
import { uid } from '../data/dndModel'

const CUSTOM_KEY = 'dnd-spell-library-custom' // 仅存自定义条目（内置始终来自 json，升级自动生效）
export const BUILTIN_ID_PREFIX = 'lib-'

const items = ref<any[] | null>(null) // 完整库（内置+自定义），懒加载
let builtinCache: any[] | null = null

export function isBuiltinSpellId(id: string): boolean {
  return typeof id === 'string' && id.startsWith(BUILTIN_ID_PREFIX)
}

async function builtinList(): Promise<any[]> {
  if (!builtinCache) {
    const m: any = await import('../data/spellLibrary.json')
    builtinCache = Array.isArray(m) ? m : (m?.default as any[]) || []
  }
  return builtinCache
}

function loadCustom(): any[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveCustom(list: any[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('保存自定义法术失败', e)
  }
}

// 确保库已加载（合并内置 + 自定义）
export async function ensureSpellLibraryLoaded(): Promise<void> {
  if (items.value) return
  const b = await builtinList()
  items.value = [...b, ...loadCustom()]
}

export function useSpellLibrary() {
  return {
    items, // 只读展示用：完整库（内置+自定义）
    isBuiltin: isBuiltinSpellId,
    ensureLoaded: ensureSpellLibraryLoaded,
    async addCustom(spell: any) {
      const entry = { ...spell, id: uid() }
      const custom = loadCustom()
      custom.push(entry)
      saveCustom(custom)
      if (items.value) items.value = [...items.value.filter((i) => i.id !== entry.id), entry]
      return entry
    },
    async removeItem(id: string) {
      if (isBuiltinSpellId(id)) return false // 内置不可删
      saveCustom(loadCustom().filter((c) => c.id !== id))
      if (items.value) items.value = items.value.filter((i) => i.id !== id)
      return true
    },
    // 重置为标准库（清除全部自定义条目）
    async resetToStandard() {
      saveCustom([])
      const b = await builtinList()
      items.value = [...b]
    },
  }
}
