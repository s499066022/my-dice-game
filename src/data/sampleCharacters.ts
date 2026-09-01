// src/data/sampleCharacters.ts
// 内置两个 5e 示例角色（野蛮人 11 级 / 法师 11 级），字段尽量完善。
// 在角色卡库首次为空时自动载入，供参考与测试。

import { createEmptyCard, uid, type CharacterCard, type AbilityKey, type ArmorDef, type ShieldDef } from './dndModel'

function setAbility(
  c: CharacterCard,
  key: AbilityKey,
  opts: {
    base: number
    background?: number
    asi?: number
    feat?: number
    item?: number
    replacement?: number | null
    saveProficient?: boolean
  }
) {
  c.abilities[key] = {
    base: opts.base,
    background: opts.background ?? 0,
    asi: opts.asi ?? 0,
    feat: opts.feat ?? 0,
    item: opts.item ?? 0,
    replacement: opts.replacement ?? null,
    saveProficient: !!opts.saveProficient,
  }
}

function setSkill(c: CharacterCard, name: string, proficient: number) {
  c.skills[name] = { proficient }
}

function armor(def: Partial<ArmorDef>): ArmorDef {
  return { kind: 'none', name: '', note: '', ac: 0, stealthDisadvantage: false, attuned: false, description: '', slot: '胸部', ...def }
}

function shield(def: Partial<ShieldDef>): ShieldDef {
  return { equipped: false, name: '', note: '', ac: 0, stealthDisadvantage: false, attuned: false, description: '', slot: '手部', ...def }
}

function feature(level: number, name: string, description: string) {
  return { id: uid(), level, name, description }
}

function spell(partial: Record<string, any>) {
  return {
    id: uid(),
    status: '已准备',
    level: 0,
    school: '',
    ritual: false,
    name: '',
    castingTime: '',
    range: '',
    duration: '',
    v: false,
    s: false,
    m: false,
    material: '',
    effect: '',
    ...partial,
  }
}

// ================= 野蛮人 11 级（巨人道途） =================
function buildBarbarian11(): CharacterCard {
  const c = createEmptyCard('葛罗格')
  c.playerName = '无名'
  c.race = '半兽人'
  c.background = '流浪者'
  c.alignment = '混乱中立'
  c.className = '野蛮人'
  c.classes = [{ id: uid(), name: '野蛮人', level: 11 }]
  c.level = 11
  c.xp = 68500
  c.proficiencyBonus = 4

  // 属性：点购 27（15/14/14/10/10/8），加背景/属性提升/专长得到最终
  setAbility(c, 'str', { base: 15, background: 2, asi: 2, feat: 1, saveProficient: true }) // 20
  setAbility(c, 'dex', { base: 14, saveProficient: false }) // 14
  setAbility(c, 'con', { base: 14, asi: 2, saveProficient: true }) // 16
  setAbility(c, 'int', { base: 10, saveProficient: false }) // 10
  setAbility(c, 'wis', { base: 10, saveProficient: false }) // 10
  setAbility(c, 'cha', { base: 8, saveProficient: false }) // 8

  c.hp = { current: 87, max: 115 }
  c.tempHp = 0
  c.hitDice = { current: 11, max: 11, formula: '1d12' }
  c.acBonus = 5 // 额外加值：敏捷2 + 体质3（基础 10 在 armor.ac）
  c.armor = armor({ kind: 'none' })
  c.shield = shield({})
  c.initiativeBonus = 0
  c.initiativeAdvantage = 'normal'
  c.speed = '40 尺'
  c.size = '中型'
  c.resistances = '钝击、穿刺、挥砍（狂暴时）'
  c.immunities = ''
  c.passivePerception = 14
  c.conditions = []

  c.resources = [
    { id: uid(), name: '狂暴次数', available: 4, total: 4, note: '狂暴时伤害+2、抗性' },
    { id: uid(), name: '巨人威势（巨人之怒）', available: 4, total: 4, note: '巨人道途特性使用次数' },
  ]

  c.weapons = [
    {
      id: uid(), name: '巨斧', mastery: '扫撞', ability: 'str', damage: '1d12', damageType: '挥砍',
      traits: '重型 双手', ammo: 0, cost: '30gp', attuned: false, description: '', slot: '手部',
    },
    {
      id: uid(), name: '手斧', mastery: '侵扰', ability: 'str', damage: '1d6', damageType: '挥砍',
      traits: '轻型 投掷(射程20/60)', ammo: 0, cost: '5gp', attuned: false, description: '', slot: '手部',
    },
    {
      id: uid(), name: '标枪', mastery: '缓速', ability: 'str', damage: '1d6', damageType: '穿刺',
      traits: '投掷(射程30/120)', ammo: 0, cost: '5sp', attuned: false, description: '', slot: '手部',
    },
  ]
  c.armor = armor({ kind: 'none', ac: 10, name: '无甲（无甲防御）', note: 'AC = 10(基础) + 敏捷 + 体质' })
  c.shield = shield({})
  c.equipment = [
    { id: uid(), name: '冒险者背包', attuned: false, description: '', slot: '背部' },
    { id: uid(), name: '火把 ×5', attuned: false, description: '', slot: '手部' },
    { id: uid(), name: '铁匠工具', attuned: false, description: '', slot: '手部' },
  ]

  // 技能：野蛮人 + 背景
  setSkill(c, '运动', 1)
  setSkill(c, '威吓', 1)
  setSkill(c, '察觉', 1)
  setSkill(c, '求生', 1)
  c.weaponsProficient = '简易武器、军用武器'
  c.armorProficient = '轻甲、中甲、盾牌'
  c.languages = '通用语、兽人语、巨人语'
  c.tools = '铁匠工具'

  c.classFeatures = [
    feature(1, '狂暴', '你的攻击掷骰与力量检定获得优势，伤害+2，并对钝击/穿刺/挥砍伤害获得抗性。'),
    feature(1, '无甲防御', '未穿护甲时，你的 AC = 10 + 敏捷调整值 + 体质调整值。'),
    feature(2, '鲁莽攻击', '攻击时获得优势，但直到你下回合开始，攻击你的检定也获得优势。'),
    feature(2, '危险感知', '敏捷豁免优势，可感到未成形的陷阱等威胁。'),
    feature(3, '巨人道途', '选择巨人之路：获得巨人之怒等强大能力。'),
    feature(4, '属性值提升', '力量 +2、体质 +2。'),
    feature(5, '额外攻击', '可发动两次攻击。'),
    feature(5, '快速移动', '速度 +10 尺，且战斗时不受阻碍。'),
    feature(7, '蛮兽直觉', '先攻检定优势，并在被突袭时仍可行动。'),
    feature(9, '蛮横暴击', '暴击时额外掷一枚伤害骰。'),
    feature(11, '蛮横暴击(强化)', '暴击时额外掷两枚伤害骰。'),
  ]
  c.racialFeatures = [
    feature(0, '黑暗视觉', '60 尺内可视黑暗如白昼。'),
    feature(0, '凶蛮', '近战暴击可额外掷一枚伤害骰。'),
    feature(0, '坚韧', '生命值降至 0 时，改为降到 1。'),
    feature(0, '致命打击', '命中时附加额外伤害。'),
  ]
  c.feats = [
    feature(4, '属性值提升（力量+2）', '购买力量属性提升。'),
    feature(8, '属性值提升（体质+2）', '购买体质属性提升。'),
    feature(4, '巨武器大师', '使用重型/双手武器时，可选择攻击 -5 命中 +10 伤害。'),
  ]
  c.specialAbilities = [
    feature(3, '巨人之力', '体型变大，力量检定优势，攻击额外 +1 伤害。'),
    feature(6, '元素蛮力', '狂暴时附加元素伤害。'),
  ]

  c.spellAbility = ''
  c.spellDc = 0
  c.spellAttackBonus = 0
  c.spellSlots = Array.from({ length: 10 }, (_, i) => ({ level: i, used: 0, total: 0 }))
  c.spells = []

  c.money = { pp: 0, gp: 140, sp: 0, cp: 0 }
  c.weightCapacity = 300
  c.note = '示例角色：巨人道途野蛮人，力量 20 的核心近战坦克，狂暴与巨人威势为主要资源。'
  return c
}

// ================= 法师 11 级（预言之学派） =================
function buildWizard11(): CharacterCard {
  const c = createEmptyCard('艾琳')
  c.playerName = '无名'
  c.race = '高等精灵'
  c.background = '贤者'
  c.alignment = '中立善良'
  c.className = '法师'
  c.classes = [{ id: uid(), name: '法师', level: 11 }]
  c.level = 11
  c.xp = 68500
  c.proficiencyBonus = 4

  // 属性：点购 27（8/14/14/15/12/8），智力堆高
  setAbility(c, 'str', { base: 8, saveProficient: false }) // 8
  setAbility(c, 'dex', { base: 14, saveProficient: false }) // 14
  setAbility(c, 'con', { base: 14, saveProficient: false }) // 14
  setAbility(c, 'int', { base: 15, background: 1, asi: 4, saveProficient: true }) // 20
  setAbility(c, 'wis', { base: 12, saveProficient: true }) // 12
  setAbility(c, 'cha', { base: 8, saveProficient: false }) // 8

  c.hp = { current: 54, max: 68 }
  c.tempHp = 0
  c.hitDice = { current: 11, max: 11, formula: '1d6' }
  c.acBonus = 2 // 敏捷调整（法师护甲 13 在 armor.ac）
  c.armor = armor({ kind: 'none' })
  c.shield = shield({})
  c.initiativeBonus = 0
  c.initiativeAdvantage = 'normal'
  c.speed = '30 尺'
  c.size = '中型'
  c.resistances = ''
  c.immunities = ''
  c.passivePerception = 11
  c.conditions = []

  c.resources = [{ id: uid(), name: '奥术恢复', available: 1, total: 1, note: '短休恢复部分法术位' }]

  c.weapons = [
    {
      id: uid(), name: '匕首', mastery: '迅疾', ability: 'dex', damage: '1d4', damageType: '穿刺',
      traits: '灵巧 轻型 投掷(射程20/60)', ammo: 0, cost: '2gp', attuned: false, description: '', slot: '手部',
    },
  ]
  c.armor = armor({ kind: 'none', ac: 13, name: '无甲（法师护甲）', note: 'AC = 13 + 敏捷调整值' })
  c.shield = shield({})
  c.equipment = [
    { id: uid(), name: '法术书', attuned: false, description: '记录全部已知法术。', slot: '手部' },
    { id: uid(), name: '奥术法器', attuned: true, description: '施法法器。', slot: '手部' },
    { id: uid(), name: '解读工具', attuned: false, description: '', slot: '手部' },
  ]

  setSkill(c, '奥秘', 1)
  setSkill(c, '历史', 1)
  setSkill(c, '洞悉', 1)
  setSkill(c, '调查', 1)
  c.weaponsProficient = '匕首、飞镖、投石索、轻弩'
  c.armorProficient = ''
  c.languages = '通用语、精灵语、龙语'
  c.tools = '解读工具'

  c.classFeatures = [
    feature(1, '法术书', '记录你所知道的所有法术，每日可准备若干。'),
    feature(1, '奥术恢复', '短休时可恢复若干法术位（上限为法师等级的一半）。'),
    feature(2, '奥术传承', '选择预言之学派：获得占卜相关能力。'),
    feature(2, '预兆', '每日两次掷 d20 记录，可在任意时机替换他人的攻击/豁免/检定结果。'),
    feature(4, '属性值提升', '智力 +2。'),
    feature(6, '预视', '可看到未来的片段，获得额外骰子加值。'),
    feature(8, '属性值提升', '智力 +2。'),
    feature(10, '高等预视', '预兆与预视能力得到强化。'),
  ]
  c.racialFeatures = [
    feature(0, '黑暗视觉', '60 尺内可视黑暗如白昼。'),
    feature(0, '尖耳', '智慧豁免获得优势，且不会被魔法睡眠。'),
    feature(0, '精灵武器熟练', '擅长剑、弓等精灵武器。'),
    feature(0, '额外戏法', '获得一个额外法师戏法。'),
  ]
  c.feats = [
    feature(4, '属性值提升（智力+2）', '购买智力属性提升。'),
    feature(8, '属性值提升（智力+2）', '购买智力属性提升。'),
    feature(4, '警觉', '先攻检定获得 +5。'),
  ]

  c.specialAbilities = [
    feature(2, '预兆', '每日两次掷 d20 预兆骰，可替换他人检定结果。'),
    feature(6, '预视', '可看到未来片段，获得额外骰子加值。'),
  ]

  c.spellAbility = 'int'
  c.spellDc = 17 // 8 + 熟练4 + 智力5
  c.spellAttackBonus = 9 // 熟练4 + 智力5
  c.spellSlots = [
    { level: 0, used: 0, total: 0 },
    { level: 1, used: 0, total: 4 },
    { level: 2, used: 0, total: 3 },
    { level: 3, used: 0, total: 3 },
    { level: 4, used: 0, total: 3 },
    { level: 5, used: 0, total: 2 },
    { level: 6, used: 0, total: 1 },
    { level: 7, used: 0, total: 0 },
    { level: 8, used: 0, total: 0 },
    { level: 9, used: 0, total: 0 },
  ]

  c.spells = [
    spell({ status: '已知', level: 0, school: '塑能', name: '火焰箭', castingTime: '1 动作', range: '120 尺', duration: '立即', v: true, s: true, m: false, effect: '远程火焰伤害 2d10。' }),
    spell({ status: '已知', level: 0, school: '变化', name: '法师之手', castingTime: '1 动作', range: '30 尺', duration: '1 分钟', v: true, s: true, m: false, effect: '召唤一只幽灵手操控物品。' }),
    spell({ status: '已知', level: 0, school: '塑能', name: '电爪', castingTime: '1 动作', range: '5 尺', duration: '立即', v: true, s: true, m: false, effect: '近战触发闪电伤害。' }),
    spell({ status: '已准备', level: 1, school: '防护', name: '护盾术', castingTime: '1 反应', range: '自身', duration: '1 轮', v: true, s: true, m: false, effect: 'AC +5 直到下回合开始，且不受魔法飞弹。' }),
    spell({ status: '已准备', level: 1, school: '塑能', name: '魔法飞弹', castingTime: '1 动作', range: '120 尺', duration: '立即', v: true, s: true, m: false, effect: '三枚必中的力场飞弹，每枚 1d4+1。' }),
    spell({ status: '已准备', level: 1, school: '预言', name: '侦测魔法', castingTime: '1 动作', range: '自身', duration: '10 分钟', ritual: true, v: true, s: true, m: false, effect: '感知范围内的魔法。' }),
    spell({ status: '已准备', level: 2, school: '幻术', name: '镜影术', castingTime: '1 动作', range: '自身', duration: '1 分钟', v: true, s: true, m: false, effect: '创造三个镜像替身。' }),
    spell({ status: '已准备', level: 2, school: '变化', name: '迷雾步', castingTime: '1 附赠', range: '自身', duration: '立即', v: false, s: true, m: false, effect: '传送 30 尺并留下迷雾。' }),
    spell({ status: '已准备', level: 3, school: '塑能', name: '火球术', castingTime: '1 动作', range: '150 尺', duration: '立即', v: true, s: true, m: true, material: '一小撮硫磺与硝石', effect: '半径 20 尺范围 8d6 火焰伤害。' }),
    spell({ status: '已准备', level: 3, school: '变化', name: '加速术', castingTime: '1 动作', range: '30 尺', duration: '1 分钟', v: true, s: true, m: false, effect: '目标获得 +2 AC、双倍速度、额外一次攻击。' }),
    spell({ status: '已准备', level: 4, school: '变化', name: '石肤术', castingTime: '1 动作', range: '接触', duration: '1 小时', v: true, s: true, m: true, material: '钻石尘', effect: '钝击/穿刺/挥砍伤害减半。' }),
    spell({ status: '已准备', level: 5, school: '防护', name: '力场墙', castingTime: '1 动作', range: '120 尺', duration: '10 分钟', v: true, s: true, m: false, effect: '创造一面力场墙壁。' }),
    spell({ status: '已准备', level: 6, school: '预言', name: '真视术', castingTime: '1 动作', range: '接触', duration: '1 小时', v: true, s: true, m: false, effect: '目标可看破黑暗与幻象。' }),
  ]

  c.money = { pp: 0, gp: 90, sp: 0, cp: 0 }
  c.weightCapacity = 60
  c.note = '示例角色：预言之学派法师，智力 20 的控场/爆发施法者，以预兆与多种法术为核心。'
  return c
}

export function createSampleCharacters(): CharacterCard[] {
  const barb = buildBarbarian11()
  const wiz = buildWizard11()
  barb.id = uid()
  wiz.id = uid()
  return [barb, wiz]
}

// 随机返回一个示例角色（野蛮人 / 法师）
export function createRandomSampleCharacter(): CharacterCard {
  const all = createSampleCharacters()
  return all[Math.floor(Math.random() * all.length)]
}
