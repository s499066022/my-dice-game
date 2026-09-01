// src/data/dndModel.ts
// D&D 5e 角色卡数据模型：类型定义、技能/属性常量、常用计算函数、默认卡与归一化。
// 后端只负责整体存取 JSON，角色卡的完整 schema 由本模块（前端）定义。

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export interface AbilityState {
  // 点购基础值（8-15）
  base: number
  // 属性加成链：最终结果 = base + background + asi + feat + item
  background: number // 背景加成
  asi: number // 属性值提升 (ASI)
  feat: number // 专长加成
  item: number // 物品加成
  // 替代属性：设定后直接作为最终值（否则按上方加成链计算）
  replacement: number | null
  saveProficient: boolean
}

export interface SkillDef {
  name: string
  ability: AbilityKey
}

export interface SkillState {
  // 0 未熟练 / 1 熟练 / 2 专家（双倍熟练）
  proficient: number
}

// 多职业兼职：每个职业一项（职业名 + 等级）
export interface ClassLevel {
  id: string
  name: string
  level: number
}

export interface CardResource {
  id: string
  name: string
  available: number
  total: number
  note?: string
}

export interface Weapon {
  id: string
  name: string
  mastery: string // 精通
  ability: AbilityKey | '' // 使用属性
  damage: string // 伤害区间（文字，如 1d8）
  damageType: string // 伤害类型
  traits: string // 特性
  ammo: number // 弹药数
  cost: string // 金额（参考）
  attuned: boolean // 是否同调
  description: string // 描述
  slot: string // 部位（如 手 / 双手 / 身体）
}

// 标准武器表条目（参考图中：名称/精通/伤害区间/伤害类型/金额/特性）
export interface WeaponPreset {
  name: string
  mastery: string
  damage: string
  damageType: string
  cost: string
  traits: string
}

export type ArmorKind = 'none' | 'light' | 'medium' | 'heavy'

export const ARMOR_KINDS: ArmorKind[] = ['none', 'light', 'medium', 'heavy']

export const ARMOR_KIND_LABELS: Record<ArmorKind, string> = {
  none: '无甲',
  light: '轻甲',
  medium: '中甲',
  heavy: '重甲',
}

// 各类型护甲的基础 AC（敏捷等额外加值放到 acBonus）
export const ARMOR_DEFAULT_AC: Record<ArmorKind, number> = {
  none: 10,
  light: 11,
  medium: 13,
  heavy: 15,
}

export interface ArmorDef {
  kind: ArmorKind
  name: string
  note: string
  ac: number // 护甲 AC
  stealthDisadvantage: boolean // 是否隐匿劣势
  attuned: boolean // 是否同调
  description: string // 描述
  slot: string // 部位（如 身体）
}

export interface ShieldDef {
  equipped: boolean
  name: string
  note: string
  ac: number // 盾牌 AC
  stealthDisadvantage: boolean
  attuned: boolean // 是否同调
  description: string // 描述
  slot: string // 部位（如 手）
}

export interface EquipmentItem {
  id: string
  name: string
  attuned: boolean
  description: string
  slot: string
}

export interface FeatureEntry {
  id: string
  level: number
  name: string
  description: string
}

export interface Spell {
  id: string
  status: string // 状态
  level: number // LV（环位）
  school: string // 学派
  ritual: boolean // 仪式
  name: string // 法术名
  castingTime: string // 施法时间
  range: string // 施法距离
  duration: string // 持续时间
  v: boolean // 语言成分
  s: boolean // 姿势成分
  m: boolean // 材料成分
  material: string // 具体施法材料
  effect: string // 法术效果
}

export interface SpellSlot {
  level: number
  used: number
  total: number
}

export interface CharacterCard {
  id: string

  // ---- 基础信息 ----
  name: string
  playerName: string
  race: string
  background: string
  alignment: string
  className: string
  level: number
  classes: ClassLevel[]
  xp: number
  proficiencyBonus: number
  portraitUrl: string

  // ---- 属性 / 豁免 ----
  abilities: Record<AbilityKey, AbilityState>

  // ---- 战斗 ----
  hp: { current: number; max: number }
  tempHp: number
  hitDice: { current: number; max: number; formula: string }
  acBonus: number
  armor: ArmorDef
  shield: ShieldDef
  initiativeBonus: number
  initiativeAdvantage: string // normal | advantage | disadvantage
  speed: string
  size: string
  resistances: string
  immunities: string
  passivePerception: number
  conditions: string[]

  // ---- 资源（狂暴次数 / 斗气 / 充能 / 法术位等通用资源） ----
  resources: CardResource[]

  // ---- 武器 / 防具 / 装备 ----
  weapons: Weapon[]
  equipment: EquipmentItem[]

  // ---- 技能 / 熟练 ----
  skills: Record<string, SkillState>
  weaponsProficient: string
  armorProficient: string
  languages: string
  tools: string

  // ---- 特性 / 专长 / 特殊能力 ----
  classFeatures: FeatureEntry[]
  racialFeatures: FeatureEntry[]
  feats: FeatureEntry[]
  specialAbilities: FeatureEntry[]

  // ---- 法术 ----
  spellAbility: AbilityKey | ''
  spellDc: number
  spellAttackBonus: number
  spellSlots: SpellSlot[]
  spells: Spell[]

  // ---- 财富 / 其它 ----
  money: { pp: number; gp: number; sp: number; cp: number }
  weightCapacity: number
  note: string

  // ---- 元数据 ----
  creatorData?: any
  createdAt: string
  updatedAt: string
}

// ========== 常量定义 ==========
export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
}

export const ABILITY_ABBR: Record<AbilityKey, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

export const SKILLS: SkillDef[] = [
  { name: '运动', ability: 'str' },
  { name: '特技', ability: 'dex' },
  { name: '巧手', ability: 'dex' },
  { name: '隐匿', ability: 'dex' },
  { name: '调查', ability: 'int' },
  { name: '奥秘', ability: 'int' },
  { name: '历史', ability: 'int' },
  { name: '自然', ability: 'int' },
  { name: '宗教', ability: 'int' },
  { name: '察觉', ability: 'wis' },
  { name: '洞悉', ability: 'wis' },
  { name: '驯兽', ability: 'wis' },
  { name: '医药', ability: 'wis' },
  { name: '求生', ability: 'wis' },
  { name: '游说', ability: 'cha' },
  { name: '欺瞒', ability: 'cha' },
  { name: '威吓', ability: 'cha' },
  { name: '表演', ability: 'cha' },
]

// 常见状态（可与截图对应）
export const CONDITION_OPTIONS = [
  '昏睡',
  '麻痹',
  '中毒',
  '恐慌',
  '反胃',
  '震慑',
  '缓慢',
  '束缚',
  '石化',
  '击倒',
  '隐形',
  '目盲',
  '耳聋',
  '魅惑',
  '力竭',
  '擒抱',
]

// ========== 标准武器表（参考图） ==========
export const WEAPON_PRESETS: WeaponPreset[] = [
  { name: '短棒', mastery: '缓速', damage: '1d4', damageType: '钝击', cost: '1sp', traits: '轻型' },
  { name: '匕首', mastery: '迅疾', damage: '1d4', damageType: '穿刺', cost: '2gp', traits: '灵巧 轻型 投掷(射程20/60)' },
  { name: '巨棒', mastery: '推离', damage: '1d8', damageType: '钝击', cost: '2sp', traits: '双手' },
  { name: '手斧', mastery: '侵扰', damage: '1d6', damageType: '挥砍', cost: '5gp', traits: '轻型 投掷(射程20/60)' },
  { name: '标枪', mastery: '缓速', damage: '1d6', damageType: '穿刺', cost: '5sp', traits: '投掷(射程30/120)' },
  { name: '轻锤', mastery: '迅疾', damage: '1d4', damageType: '钝击', cost: '2gp', traits: '轻型 投掷(射程20/60)' },
  { name: '硬头锤', mastery: '削弱', damage: '1d6', damageType: '钝击', cost: '5gp', traits: '—' },
  { name: '长棍', mastery: '失衡', damage: '1d6', damageType: '钝击', cost: '2sp', traits: '两用(1d8)' },
  { name: '镰刀', mastery: '迅疾', damage: '1d4', damageType: '挥砍', cost: '1gp', traits: '轻型' },
  { name: '矛', mastery: '削弱', damage: '1d6', damageType: '穿刺', cost: '1gp', traits: '投掷(射程20/60) 两用(1d8)' },
  { name: '轻弩', mastery: '缓速', damage: '1d8', damageType: '穿刺', cost: '25gp', traits: '弹药(射程80/320) 装填 双手' },
  { name: '飞镖', mastery: '侵扰', damage: '1d4', damageType: '穿刺', cost: '5cp', traits: '灵巧 轻型 投掷(射程20/60)' },
  { name: '短弓', mastery: '侵扰', damage: '1d6', damageType: '穿刺', cost: '5cp', traits: '弹药(射程80/320) 双手' },
  { name: '投石索', mastery: '缓速', damage: '1d4', damageType: '钝击', cost: '1sp', traits: '弹药(射程30/120)' },
  { name: '战斧', mastery: '失衡', damage: '1d8', damageType: '挥砍', cost: '10gp', traits: '两用(1d10)' },
  { name: '链枷', mastery: '削弱', damage: '1d8', damageType: '钝击', cost: '10gp', traits: '—' },
  { name: '长柄刀', mastery: '擦掠', damage: '1d10', damageType: '挥砍', cost: '20gp', traits: '重型 触及 双手' },
  { name: '巨斧', mastery: '扫撞', damage: '1d12', damageType: '挥砍', cost: '30gp', traits: '重型 双手' },
  { name: '巨剑', mastery: '擦掠', damage: '2d6', damageType: '挥砍', cost: '50gp', traits: '重型 双手' },
  { name: '戟', mastery: '扫撞', damage: '1d10', damageType: '挥砍', cost: '20gp', traits: '重型 触及 双手' },
  { name: '骑枪', mastery: '失衡', damage: '1d12', damageType: '穿刺', cost: '10gp', traits: '触及 特殊' },
  { name: '长剑', mastery: '削弱', damage: '1d8', damageType: '挥砍', cost: '15gp', traits: '两用(1d10)' },
  { name: '巨锤', mastery: '失衡', damage: '2d6', damageType: '钝击', cost: '10gp', traits: '重型 双手' },
  { name: '钉头锤', mastery: '削弱', damage: '1d8', damageType: '穿刺', cost: '15gp', traits: '—' },
  { name: '长矛', mastery: '推离', damage: '1d10', damageType: '穿刺', cost: '5gp', traits: '重型 触及 双手' },
  { name: '刺剑', mastery: '侵扰', damage: '1d8', damageType: '穿刺', cost: '25gp', traits: '灵巧' },
  { name: '弯刀', mastery: '迅疾', damage: '1d6', damageType: '挥砍', cost: '25gp', traits: '灵巧 轻型' },
  { name: '短剑', mastery: '侵扰', damage: '1d6', damageType: '穿刺', cost: '10gp', traits: '灵巧 轻型' },
  { name: '三叉戟', mastery: '失衡', damage: '1d6', damageType: '穿刺', cost: '5gp', traits: '投掷(射程20/60) 两用(1d8)' },
  { name: '战镐', mastery: '削弱', damage: '1d8', damageType: '穿刺', cost: '5gp', traits: '—' },
  { name: '战锤', mastery: '推离', damage: '1d8', damageType: '钝击', cost: '15gp', traits: '两用(1d10)' },
  { name: '鞭', mastery: '缓速', damage: '1d4', damageType: '挥砍', cost: '2gp', traits: '灵巧 触及' },
  { name: '吹箭筒', mastery: '侵扰', damage: '1', damageType: '穿刺', cost: '10gp', traits: '弹药(射程25/100) 装填' },
  { name: '手弩', mastery: '侵扰', damage: '1d6', damageType: '穿刺', cost: '75gp', traits: '弹药(射程30/120) 轻型 装填' },
  { name: '重弩', mastery: '推离', damage: '1d10', damageType: '穿刺', cost: '50gp', traits: '弹药(射程100/400) 重型 装填' },
  { name: '长弓', mastery: '侵扰', damage: '1d8', damageType: '穿刺', cost: '50gp', traits: '弹药(射程150/600) 重型 双手' },
  { name: '手铳', mastery: '侵扰', damage: '1d10', damageType: '穿刺', cost: '250gp', traits: '弹药(射程30/90) 装填' },
  { name: '鸟铳', mastery: '缓速', damage: '1d12', damageType: '穿刺', cost: '500gp', traits: '弹药(射程40/120) 装填 双手' },
]

// 根据武器特性判断默认使用属性（远程/灵巧→敏捷，其余→力量）
export function defaultAbilityForWeapon(name: string, traits: string): AbilityKey {
  const t = (traits || '') + (name || '')
  if (/弹药|装填|灵巧/.test(t)) return 'dex'
  return 'str'
}

// 命中加值 = 使用属性调整值 + 熟练加值
export function getWeaponHitBonus(card: CharacterCard, w: Weapon): number {
  const mod = w.ability ? getAbilityModifier(card, w.ability) : 0
  return mod + card.proficiencyBonus
}

// 武器伤害 = 伤害区间文字 + 使用属性调整值
export function getWeaponDamageText(card: CharacterCard, w: Weapon): string {
  const mod = w.ability ? getAbilityModifier(card, w.ability) : 0
  const dmg = (w.damage || '').trim()
  if (!dmg) return ''
  return mod === 0 ? dmg : `${dmg}${mod > 0 ? '+' : ''}${mod}`
}

// ========== 计算函数 ==========
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

// 属性最终值 = 替代属性（若有）否则 = base + background + asi + feat + item
export function getAbilityScore(card: CharacterCard, key: AbilityKey): number {
  const a = card.abilities[key]
  if (!a) return 10
  if (a.replacement != null) return a.replacement
  return a.base + (a.background || 0) + (a.asi || 0) + (a.feat || 0) + (a.item || 0)
}

export function getAbilityModifier(card: CharacterCard, key: AbilityKey): number {
  return abilityModifier(getAbilityScore(card, key))
}

// ========== 属性点购 ==========
export const POINT_BUY_MAX = 27
export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

export function pointBuyCost(value: number): number {
  return POINT_BUY_COST[value] ?? 0
}

export function getPointBuySpent(card: CharacterCard): number {
  return ABILITY_KEYS.reduce((s, k) => s + pointBuyCost(card.abilities[k]?.base ?? 8), 0)
}

export function getPointBuyRemaining(card: CharacterCard): number {
  return POINT_BUY_MAX - getPointBuySpent(card)
}

export function getSaveValue(card: CharacterCard, key: AbilityKey): number {
  const mod = getAbilityModifier(card, key)
  const proficient = card.abilities[key]?.saveProficient ?? false
  return mod + (proficient ? card.proficiencyBonus : 0)
}

export function getSkillTotal(card: CharacterCard, skillName: string): number {
  const def = SKILLS.find((s) => s.name === skillName)
  if (!def) return 0
  const mod = getAbilityModifier(card, def.ability)
  const st = card.skills[skillName] ?? { proficient: 0 }
  const prof = st.proficient === 2 ? card.proficiencyBonus * 2 : st.proficient === 1 ? card.proficiencyBonus : 0
  return mod + prof
}

export function getPassivePerception(card: CharacterCard): number {
  return 10 + getSkillTotal(card, '察觉')
}

// 先攻 = 先攻加值 + 敏捷调整值
export function getInitiativeTotal(card: CharacterCard): number {
  return (card.initiativeBonus || 0) + getAbilityModifier(card, 'dex')
}

// ========== 防具 / AC ==========
// 无甲（未装备护甲）也保留一个基础 AC，因此始终计入护甲的 AC 值。
export function getArmorAC(card: CharacterCard): number {
  return card.armor?.ac || 0
}

export function getShieldAC(card: CharacterCard): number {
  return card.shield?.equipped ? (card.shield?.ac || 0) : 0
}

// 最终 AC = AC 加值 + 护甲 AC + 盾牌 AC
export function getTotalAC(card: CharacterCard): number {
  return (card.acBonus || 0) + getArmorAC(card) + getShieldAC(card)
}

export function hasStealthDisadvantage(card: CharacterCard): boolean {
  return !!(card.armor?.stealthDisadvantage || card.shield?.stealthDisadvantage)
}

// ========== 多职业兼职 ==========
export function getClassSummary(card: CharacterCard): string {
  if (card.classes && card.classes.length) {
    const named = card.classes.filter((c) => c.name && c.name.trim())
    if (named.length) {
      return named.map((c) => `${c.name.trim()}${c.level}级`).join('，')
    }
  }
  return card.className ? `${card.className}${card.level}级` : ''
}

export function getTotalLevel(card: CharacterCard): number {
  if (card.classes && card.classes.length) {
    const named = card.classes.filter((c) => c.name && c.name.trim())
    if (named.length) return named.reduce((s, c) => s + (c.level || 0), 0)
    return card.level || card.classes.reduce((s, c) => s + (c.level || 0), 0) || 1
  }
  return card.level || 1
}

// ========== 默认卡 / 归一化 ==========
export function createEmptyCard(name = ''): CharacterCard {
  const now = new Date().toISOString()
  const abilities = {} as Record<AbilityKey, AbilityState>
  for (const k of ABILITY_KEYS) {
    abilities[k] = { base: 10, background: 0, asi: 0, feat: 0, item: 0, replacement: null, saveProficient: false }
  }

  const skills: Record<string, SkillState> = {}
  for (const s of SKILLS) skills[s.name] = { proficient: 0 }

  return {
    id: '',
    name,
    playerName: '',
    race: '',
    background: '',
    alignment: '',
    className: '',
    level: 1,
    classes: [],
    xp: 0,
    proficiencyBonus: 2,
    portraitUrl: '',
    abilities,
    hp: { current: 10, max: 10 },
    tempHp: 0,
    hitDice: { current: 1, max: 1, formula: '1d8' },
    acBonus: 0,
    armor: { kind: 'none', name: '', note: '', ac: 10, stealthDisadvantage: false, attuned: false, description: '', slot: '胸部' },
    shield: { equipped: false, name: '', note: '', ac: 0, stealthDisadvantage: false, attuned: false, description: '', slot: '手部' },
    initiativeBonus: 0,
    initiativeAdvantage: 'normal',
    speed: '30 尺',
    size: '中型',
    resistances: '',
    immunities: '',
    passivePerception: 10,
    conditions: [],
    resources: [],
    weapons: [],
    equipment: [],
    skills,
    weaponsProficient: '简易、军用武器',
    armorProficient: '轻甲、中甲、盾牌',
    languages: '通用语',
    tools: '',
    classFeatures: [],
    racialFeatures: [],
    feats: [],
    specialAbilities: [],
    spellAbility: '',
    spellDc: 0,
    spellAttackBonus: 0,
    spellSlots: Array.from({ length: 9 }, (_, i) => ({ level: i, used: 0, total: 0 })),
    spells: [],
    money: { pp: 0, gp: 0, sp: 0, cp: 0 },
    weightCapacity: 0,
    note: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function uid(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function coerceArmor(raw: any): ArmorDef {
  // 兼容旧的防具数组（取第一件）
  if (Array.isArray(raw) && raw.length) raw = raw[0]
  if (!raw || typeof raw !== 'object') return { kind: 'none', name: '', note: '', ac: 0, stealthDisadvantage: false, attuned: false, description: '', slot: '胸部' }
  const kind: ArmorKind = ARMOR_KINDS.includes(raw.kind) ? raw.kind : 'none'
  return {
    kind,
    name: raw.name ?? '',
    note: raw.note ?? raw.enchantment ?? '',
    ac: Number(raw.ac) || 0,
    stealthDisadvantage: !!raw.stealthDisadvantage || kind === 'medium' || kind === 'heavy',
    attuned: !!raw.attuned,
    description: raw.description ?? '',
    slot: raw.slot ?? '胸部',
  }
}

function coerceShield(raw: any): ShieldDef {
  if (!raw || typeof raw !== 'object') return { equipped: false, name: '', note: '', ac: 0, stealthDisadvantage: false, attuned: false, description: '', slot: '手部' }
  return {
    equipped: !!raw.equipped,
    name: raw.name ?? '',
    note: raw.note ?? '',
    ac: Number(raw.ac) || 0, // 旧数据 shield.bonus 不再计为盾牌 AC，防止与旧总 AC 重复
    stealthDisadvantage: !!raw.stealthDisadvantage,
    attuned: !!raw.attuned,
    description: raw.description ?? '',
    slot: raw.slot ?? '手部',
  }
}

// 将任意来源的数据（旧版资源卡、角色卡创建器导出的数据）归一化到完整模型
export function normalizeCharacterCard(raw: any): CharacterCard | null {
  if (!raw || typeof raw !== 'object') return null
  const base = createEmptyCard(raw.name ?? '')
  const now = new Date().toISOString()

  const abilities = { ...base.abilities }
  const rawAbilities = raw.abilities as Record<string, any> | undefined
  if (rawAbilities && typeof rawAbilities === 'object') {
    for (const k of ABILITY_KEYS) {
      const ra = rawAbilities[k]
      // 兼容旧结构（仅有 score）：把 score 作为 base，加成链清零
      if (ra && typeof ra === 'object') {
        const legacyScore = typeof ra.score === 'number' ? ra.score : undefined
        abilities[k] = {
          base: Number(ra.base ?? (legacyScore != null ? legacyScore : 8)) || 8,
          background: Number(ra.background) || 0,
          asi: Number(ra.asi) || 0,
          feat: Number(ra.feat) || 0,
          item: Number(ra.item) || 0,
          replacement: typeof ra.replacement === 'number' ? ra.replacement : null,
          saveProficient: !!ra.saveProficient,
        }
      } else if (typeof ra === 'number') {
        abilities[k] = { base: ra, background: 0, asi: 0, feat: 0, item: 0, replacement: null, saveProficient: false }
      }
    }
  }

  const skills: Record<string, SkillState> = { ...base.skills }
  const rawSkills = raw.skills as Record<string, any> | undefined
  if (rawSkills && typeof rawSkills === 'object') {
    for (const s of SKILLS) {
      const rs = rawSkills[s.name]
      if (typeof rs === 'number') skills[s.name] = { proficient: rs }
      else if (rs && typeof rs === 'object') skills[s.name] = { proficient: Number(rs.proficient) || 0 }
    }
  }

  const cond = Array.isArray(raw.conditions) ? raw.conditions.filter((c: any) => typeof c === 'string') : []
  const res = Array.isArray(raw.resources)
    ? raw.resources.map((r: any) => ({
        id: r?.id ?? uid(),
        name: r?.name ?? '',
        available: Number(r?.available) || 0,
        total: Number(r?.total) || 0,
        note: r?.note ?? undefined,
      }))
    : []

  // 多职业：优先用 classes 数组，否则回退到旧的 className + level
  const classes: ClassLevel[] = Array.isArray(raw.classes) && raw.classes.length
    ? raw.classes.map((c: any) => ({
        id: c?.id ?? uid(),
        name: c?.name ?? '',
        level: Number(c?.level) || 1,
      }))
    : raw.className
      ? [{ id: uid(), name: raw.className, level: Number(raw.level) || 1 }]
      : []

  const totalLevel = classes.reduce((s, c) => s + (c.level || 0), 0) || Number(raw.level) || 1
  const className = classes[0]?.name || ''

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name: raw.name ?? '',
    playerName: raw.playerName ?? '',
    race: raw.race ?? '',
    background: raw.background ?? '',
    alignment: raw.alignment ?? '',
    className,
    level: totalLevel,
    classes,
    xp: Number(raw.xp) || 0,
    proficiencyBonus: Number(raw.proficiencyBonus) || (Number(raw.level) >= 17 ? 6 : Number(raw.level) >= 13 ? 5 : Number(raw.level) >= 9 ? 4 : Number(raw.level) >= 5 ? 3 : 2),
    portraitUrl: raw.portraitUrl ?? '',
    abilities,
    hp: {
      current: Number(raw.hp?.current) || 0,
      max: Number(raw.hp?.max) || 0,
    },
    tempHp: Number(raw.tempHp) || 0,
    hitDice: {
      current: Number(raw.hitDice?.current) || 1,
      max: Number(raw.hitDice?.max) || 1,
      formula: raw.hitDice?.formula || '1d8',
    },
    acBonus: Number(raw.acBonus) || Number(raw.ac) || 10,
    armor: coerceArmor(raw.armor),
    shield: coerceShield(raw.shield),
    initiativeBonus: Number(raw.initiativeBonus) || 0,
    initiativeAdvantage: raw.initiativeAdvantage || 'normal',
    speed: raw.speed || '30 尺',
    size: raw.size || '中型',
    resistances: raw.resistances ?? '',
    immunities: raw.immunities ?? '',
    passivePerception: Number(raw.passivePerception) || 10,
    conditions: cond,
    resources: res,
    weapons: Array.isArray(raw.weapons)
      ? raw.weapons.map((w: any) => ({
          id: w?.id ?? uid(),
          name: w?.name ?? '',
          mastery: w?.mastery ?? '',
          ability: w?.ability || defaultAbilityForWeapon(w?.name ?? '', w?.traits ?? w?.usage ?? ''),
          damage: w?.damage ?? w?.baseDamage ?? '',
          damageType: w?.damageType ?? '',
          traits: w?.traits ?? w?.usage ?? '',
          ammo: Number(w?.ammo) || 0,
          cost: w?.cost ?? '',
          attuned: !!w?.attuned,
          description: w?.description ?? '',
          slot: w?.slot ?? '手部',
        }))
      : [],
    equipment: Array.isArray(raw.equipment)
      ? raw.equipment.map((e: any) => ({
          id: e?.id ?? uid(),
          name: e?.name ?? '',
          attuned: !!e?.attuned,
          description: e?.description ?? e?.note ?? '',
          slot: e?.slot ?? '',
        }))
      : [],
    skills,
    weaponsProficient: raw.weaponsProficient ?? '简易、军用武器',
    armorProficient: raw.armorProficient ?? '轻甲、中甲、盾牌',
    languages: raw.languages ?? '通用语',
    tools: raw.tools ?? '',
    classFeatures: Array.isArray(raw.classFeatures)
      ? raw.classFeatures.map((f: any) => ({ id: f?.id ?? uid(), level: Number(f?.level) || 0, name: f?.name ?? '', description: f?.description ?? '' }))
      : [],
    racialFeatures: Array.isArray(raw.racialFeatures)
      ? raw.racialFeatures.map((f: any) => ({ id: f?.id ?? uid(), level: Number(f?.level) || 0, name: f?.name ?? '', description: f?.description ?? '' }))
      : [],
    feats: Array.isArray(raw.feats)
      ? raw.feats.map((f: any) => ({ id: f?.id ?? uid(), level: Number(f?.level) || 0, name: f?.name ?? '', description: f?.description ?? '' }))
      : [],
    specialAbilities: Array.isArray(raw.specialAbilities)
      ? raw.specialAbilities.map((f: any) => ({ id: f?.id ?? uid(), level: Number(f?.level) || 0, name: f?.name ?? '', description: f?.description ?? '' }))
      : [],
    spellAbility: raw.spellAbility || '',
    spellDc: Number(raw.spellDc) || 0,
    spellAttackBonus: Number(raw.spellAttackBonus) || 0,
    spellSlots: Array.isArray(raw.spellSlots) && raw.spellSlots.length
      ? raw.spellSlots.map((s: any) => ({ level: Number(s?.level) || 0, used: Number(s?.used) || 0, total: Number(s?.total) || 0 }))
      : base.spellSlots,
    spells: Array.isArray(raw.spells)
      ? raw.spells.map((s: any) => ({
          id: s?.id ?? uid(),
          status: s?.status ?? '已准备',
          level: Number(s?.level) || 0,
          school: s?.school ?? '',
          ritual: !!s?.ritual,
          name: s?.name ?? '',
          castingTime: s?.castingTime ?? '',
          range: s?.range ?? '',
          duration: s?.duration ?? '',
          v: !!s?.v,
          s: !!s?.s,
          m: !!s?.m,
          material: s?.material ?? '',
          effect: s?.effect ?? s?.description ?? '',
        }))
      : [],
    money: {
      pp: Number(raw.money?.pp) || 0,
      gp: Number(raw.money?.gp) || 0,
      sp: Number(raw.money?.sp) || 0,
      cp: Number(raw.money?.cp) || 0,
    },
    weightCapacity: Number(raw.weightCapacity) || 0,
    note: raw.note ?? '',
    creatorData: raw.creatorData ?? undefined,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  }
}
