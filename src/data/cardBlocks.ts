// src/data/cardBlocks.ts
// 角色卡"分块"共享定义（与 API.md §2 一致）：单卡只拉/传需要的块，减小数据量。
// LightCard（combat 块主体）在列表/团/地图/先攻页使用；其它块进入对应选项卡才懒加载。

export type CardBlock = 'combat' | 'basic' | 'skills' | 'equipment' | 'features' | 'spellconfig' | 'wealth'

// 各块包含的 CharacterCard 顶层字段
export const CARD_BLOCKS: Record<CardBlock, string[]> = {
  // 战斗/资源（= 轻量核心，含 AC 三要素与 abilities——算 AC/先攻都够；name 随核心实时）
  combat: [
    'name', 'hp', 'tempHp', 'hitDice', 'acBonus', 'armor', 'shield',
    'initiativeBonus', 'initiativeAdvantage', 'abilities', 'speed', 'size',
    'resistances', 'immunities', 'conditions', 'passivePerception', 'resources',
  ],
  basic: ['playerName', 'race', 'background', 'alignment', 'classes', 'xp', 'proficiencyBonus', 'portraitUrl'],
  skills: ['skills', 'weaponsProficient', 'armorProficient', 'languages', 'tools'],
  equipment: ['weapons', 'equipment'],
  features: ['classFeatures', 'racialFeatures', 'feats', 'specialAbilities'],
  spellconfig: ['spellAbility', 'spellDc', 'spellAttackBonus', 'spellSlots'],
  wealth: ['money', 'weightCapacity', 'note'],
}

export const CARD_BLOCK_KEYS: string[] = Object.keys(CARD_BLOCKS)

// 顶层字段 -> 所属块（用于 diff 后定位变更块）
export const BLOCK_OF_KEY: Record<string, CardBlock> = {}
Object.entries(CARD_BLOCKS).forEach(([b, keys]) => keys.forEach((k) => (BLOCK_OF_KEY[k] = b as CardBlock)))

// 从一张（可能只加载了部分块的）卡里抽某块字段
export function pickBlock(card: Record<string, any>, block: CardBlock): Record<string, any> {
  const data: Record<string, any> = {}
  ;(CARD_BLOCKS[block] || []).forEach((k) => {
    if (k in card) data[k] = card[k]
  })
  return data
}
