<template>
  <div class="cs-panel">
    <div class="cs-head">
      <h3>⚔️ 战斗会话</h3>
      <span class="cs-status" :class="statusCls">{{ statusText }}</span>
    </div>

    <!-- 会话控制 -->
    <div class="cs-row">
      <el-select v-model="selectedParty" size="small" style="width: 148px" placeholder="选择团(自动加入会话并带入全团)" @change="onPartySelect">
        <el-option value="" label="未选择团" />
        <el-option v-for="p in parties" :key="p.id" :value="p.id" :label="p.name || '团'" />
      </el-select>
      <el-button size="small" :type="locked ? 'warning' : 'success'" plain @click="onLock">🔒 锁定</el-button>
      <el-button size="small" type="danger" plain @click="onReset">重置</el-button>
      <span v-if="sessionId" class="cs-session">会话(团ID): {{ sessionId }}</span>
    </div>

    <!-- 行动顺序 -->
    <div v-if="ordered.length" class="cs-order">
      <div class="cs-order-head">
        <span>行动顺序</span>
        <span class="cs-actions">
          <el-button size="small" text :disabled="locked" @click="rollInit">🎲 掷先攻</el-button>
          <el-button size="small" text @click="nextTurn">下回合</el-button>
          <span v-if="round" class="cs-round">回合 {{ round }}</span>
        </span>
      </div>
      <table class="cs-table">
        <thead>
          <tr>
            <th>次序</th><th>类型</th><th>名字</th><th>优劣</th>
            <th>掷骰d20</th><th>修正</th><th>最终</th><th>AC</th><th>HP</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in ordered" :key="c.id" :class="{ cur: c.id === currentCombatantId }" :title="'卡片ID: ' + (c.refId || '—')">
            <td class="cs-rk">{{ c.order }}</td>
            <td><span class="cs-dot" :style="{ background: c.color }"></span><span class="cs-ty">{{ c.type === 'monster' ? '怪' : '角' }}</span></td>
            <td class="cs-nm">
              <input type="color" v-model="c.color" class="cs-col" @change="touch(c)" />
              <span class="cs-nm-txt">{{ c.name }}</span>
            </td>
            <td>
              <el-select v-model="c.advantage" size="small" style="width: 70px" @change="touch(c)">
                <el-option value="normal" label="普通" /><el-option value="advantage" label="优势" /><el-option value="disadvantage" label="劣势" />
              </el-select>
            </td>
            <td class="cs-roll">{{ c.initiativeRoll || '—' }}</td>
            <td class="cs-bonus">+{{ c.initiativeBonus }}{{ advNum(c.advantage) >= 0 ? '+' + advNum(c.advantage) : advNum(c.advantage) }}</td>
            <td class="cs-total">{{ c.initiativeTotal || '—' }}</td>
            <td class="cs-ac">
              <input type="number" v-model.number="c.ac" class="hp-in ac-in" min="0" @change="touch(c)" />
            </td>
            <td class="cs-hp">
              <input type="number" v-model.number="c.hp.current" class="hp-in" min="0" @change="hpCur(c)" />
              <span class="hp-sep">/</span>
              <input type="number" v-model.number="c.hp.max" class="hp-in" min="1" @change="hpMax(c)" />
            </td>
            <td>
              <button class="cs-mini" title="换位" :disabled="locked" @click="swapClick(c.id)">⇄</button>
              <button class="cs-mini del" title="移除" :disabled="locked" @click="remove(c.id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加参战者 -->
    <div class="cs-add">
      <div class="cs-add-row">
        <span class="cs-tag">角色</span>
        <el-select v-model="selectedCard" size="small" style="width: 150px" placeholder="从团选角色" :disabled="locked">
          <el-option v-for="c in partyCards" :key="c.id" :value="c.id" :label="c.name || '未命名'" />
        </el-select>
        <el-button size="small" :disabled="locked" @click="addCard">＋</el-button>
      </div>
      <div class="cs-add-row">
        <span class="cs-tag">怪物</span>
        <el-input v-model="mon.name" size="small" placeholder="名字" style="width: 84px" :disabled="locked" />
        <el-input v-model.number="mon.init" size="small" placeholder="先攻" style="width: 56px" :disabled="locked" />
        <el-input v-model.number="mon.ac" size="small" placeholder="AC" style="width: 52px" :disabled="locked" />
        <el-input v-model.number="mon.hp" size="small" placeholder="HP" style="width: 56px" :disabled="locked" />
        <el-select v-model="mon.size" size="small" style="width: 74px" :disabled="locked">
          <el-option v-for="o in SIZE" :key="o.label" :value="o.val" :label="o.label" />
        </el-select>
        <el-button size="small" :disabled="locked" @click="addMob">＋</el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useCombatSession, type Combatant } from '../composables/useCombatSession'
import { loadParties, type Party } from '../data/partyModel'
import { normalizeCharacterCard, type CharacterCard } from '../data/dndModel'
import { backendFetchParties, backendFetchAll, backendFetchLightCharacters } from '../api/characterBackend'

const SIZE = [
  { label: '微型', val: 0.5 }, { label: '小型', val: 1 }, { label: '中型', val: 1 },
  { label: '大型', val: 2 }, { label: '巨型', val: 3 }, { label: '超巨型', val: 4 },
]

const session = useCombatSession()
const selectedCard = ref('')
const selectedParty = ref('')
const mon = ref({ name: '', init: 0, ac: 10, hp: 20, size: 1 })

// 从 store 解构
const sessionId = session.sessionId
const ordered = session.orderedCombatants
const round = session.round
const currentCombatantId = session.currentCombatantId
const connected = session.connected
const online = session.online
const locked = session.locked

// 连接状态显示
const statusText = computed(() => {
  if (online.value && connected.value) return '🔴 实时同步(长连接)'
  if (connected.value) return '🟠 已连后端(REST)'
  return '🟢 本地(未连后端)'
})
const statusCls = computed(() => (online.value && connected.value ? 'on' : connected.value ? 'mid' : ''))

// 团与角色池（优先后端；后端空/离线退回本地）
const parties = ref<Party[]>([])
const cardPool = ref<CharacterCard[]>([])

function toParty(p: any): Party {
  const members = Array.isArray(p.member_ids) ? p.member_ids : Array.isArray(p.memberIds) ? p.memberIds : []
  return { id: String(p.id), name: p.name || '团', memberIds: members.map(String), createdAt: '', updatedAt: '' }
}

async function loadPartyCards() {
  let local = loadParties()
  let remote: any[] | null = null
  try {
    remote = await backendFetchParties() // 后端团优先（跨浏览器共享）；失败/为空退回本地
  } catch (e) {
    /* 忽略 */
  }
  if (remote && remote.length) parties.value = remote.map(toParty)
  else parties.value = local
  if (!parties.value.length) {
    partyCards.value = []
    return
  }
  await ensureCardPool()
  if (selectedParty.value) loadCardsForParty(selectedParty.value)
  else partyCards.value = []
}

// 角色池 = 本地卡（本地有就不重复拉后端，减少数据量）；缺的成员角色才向后端补拉一次
let remotePoolTried = false
async function ensureCardPool() {
  const needed = new Set<string>()
  parties.value.forEach((p) => p.memberIds.forEach((id) => needed.add(id)))
  const map = new Map<string, CharacterCard>()
  try {
    const saved = localStorage.getItem('dnd-character-cards')
    const list = saved ? JSON.parse(saved) : []
    ;(Array.isArray(list) ? list : []).forEach((c: any) => {
      const n = normalizeCharacterCard(c)
      if (n && n.id) map.set(n.id, n)
    })
  } catch (e) {
    /* 忽略 */
  }
  const missing = [...needed].filter((id) => !map.has(id))
  if (missing.length && !remotePoolTried) {
    remotePoolTried = true
    try {
      // 先试轻量列表（名字+战斗核心，含 AC/先攻所需字段，体积小）；旧后端无 light 再整卡
      const remote = (await backendFetchLightCharacters()) || (await backendFetchAll())
      if (Array.isArray(remote)) {
        remote.forEach((c: any) => {
          const n = normalizeCharacterCard(c)
          if (n && n.id) map.set(n.id, n)
        })
      }
    } catch (e) {
      /* 忽略 */
    }
  }
  cardPool.value = [...map.values()]
}

function loadCardsForParty(partyId: string) {
  const p = parties.value.find((x) => x.id === partyId)
  if (!p) {
    partyCards.value = []
    return
  }
  partyCards.value = p.memberIds.map((id) => cardPool.value.find((c) => c.id === id)).filter(Boolean).map((c) => c as CharacterCard)
}

const partyCards = ref<CharacterCard[]>([])

// 选择团 = 创建/加入该团会话（后端权威，首次自动建会）；未选择团则不改动
async function onPartySelect(id: string) {
  if (!id) return
  await loadCardsForParty(id)
  const res = await session.createOrJoinParty(id)
  // 无论首次还是已有数据，都把「角色类参战者」严格对账到当前团成员（去重/剔除其它团，怪物保留）
  await session.reconcileParty(partyCards.value)
  if (session.connected.value) {
    ElMessage.success(res.existed ? '已进入该团战斗会话（后端）' : '已创建战斗会话（后端）')
  } else {
    ElMessage.success('后端不可达，已用本地数据进入会话')
  }
}

function onReset() {
  session.resetSession()
  selectedParty.value = ''
  partyCards.value = []
  ElMessage.info('已重置（回到未选择团）')
}

function onLock() {
  session.toggleLock()
}

async function rollInit() {
  const ok = await session.rollInitiative()
  if (ok) ElMessage.success('已掷先攻')
  else ElMessage.error('掷先攻失败（可能会话已锁定）')
}
function nextTurn() {
  session.nextRound()
}
// 行内编辑（颜色/优劣/AC）整条同步
function touch(c: Combatant) {
  session.syncCombatant(c.id)
}
function hpCur(c: Combatant) {
  session.setHp(c.id, { current: c.hp.current })
}
function hpMax(c: Combatant) {
  session.setHp(c.id, { max: c.hp.max })
}
function advNum(a: string): number {
  return a === 'advantage' ? 5 : a === 'disadvantage' ? -5 : 0
}
let swapSel: string | null = null
async function swapClick(id: string) {
  if (!swapSel) {
    swapSel = id
    ElMessage.info('已选中，再点另一个参战者换位')
  } else if (swapSel === id) {
    swapSel = null
  } else {
    const ok = await session.swapCombatants(swapSel, id)
    swapSel = null
    if (ok) ElMessage.success('已换位')
    else ElMessage.error('换位失败')
  }
}
function remove(id: string) {
  session.removeCombatant(id)
}
function addCard() {
  const c = partyCards.value.find((x) => x.id === selectedCard.value)
  if (!c) {
    ElMessage.warning('请选择角色')
    return
  }
  const added = session.addCharacter(c)
  ElMessage.success(`已加入 ${added.name}`)
  selectedCard.value = ''
}
function addMob() {
  const m = mon.value
  if (!m.name.trim()) {
    ElMessage.warning('请填怪物名')
    return
  }
  session.addMonster({ name: m.name, ac: m.ac, hp: { current: m.hp, max: m.hp }, size: m.size, initiativeBonus: m.init })
  mon.value = { name: '', init: 0, ac: 10, hp: 20, size: 1 }
  ElMessage.success('已添加怪物')
}

onMounted(async () => {
  await loadPartyCards()
  // 恢复上次团（保持"返回随时查看"）
  const last = session.getLastPartyId()
  if (last && parties.value.some((p) => p.id === last)) {
    selectedParty.value = last
    await onPartySelect(last)
  }
})
</script>

<style scoped>
.cs-panel {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
  margin-bottom: 12px;
}
.cs-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.cs-head h3 {
  margin: 0;
}
.cs-status {
  font-size: 12px;
  color: #9ca3af;
}
.cs-status.on {
  color: #dc2626;
}
.cs-status.mid {
  color: #ea8f0b;
}
.cs-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.cs-session {
  color: #9ca3af;
  font-size: 12px;
}
.cs-order {
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  padding: 6px 8px;
  margin-bottom: 10px;
  max-height: 42vh;
  overflow: auto;
}
.cs-order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
}
.cs-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cs-round {
  color: #4f46e5;
}
.cs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cs-table th,
.cs-table td {
  border: 1px solid #e5e7eb;
  padding: 3px 5px;
  text-align: center;
  white-space: nowrap;
}
.cs-table th {
  background: #f3f4f6;
}
.cs-table tr.cur {
  background: #eef2ff;
}
.cs-rk {
  font-weight: 700;
  color: #4f46e5;
}
.cs-ty {
  color: #9ca3af;
  font-size: 11px;
  margin-left: 3px;
}
.cs-nm {
  display: flex;
  align-items: center;
  gap: 4px;
  text-align: left;
  font-weight: 600;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-col {
  width: 24px;
  height: 24px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 0;
  flex: 0 0 auto;
}
.cs-nm-txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-roll {
  color: #6b7280;
}
.cs-bonus {
  color: #2563eb;
}
.cs-total {
  font-weight: 700;
  color: #b45309;
}
.cs-hp {
  color: #b91c1c;
}
.cs-ac {
  color: #374151;
}
.hp-in {
  width: 48px;
  padding: 2px 4px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  text-align: center;
}
.ac-in {
  width: 40px;
}
.hp-sep {
  color: #9ca3af;
  margin: 0 2px;
}
.cs-mini {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 4px;
  width: 18px;
  height: 18px;
  line-height: 1;
  cursor: pointer;
  font-size: 12px;
  margin: 0 1px;
}
.cs-mini.del {
  color: #dc2626;
  border-color: #fecaca;
  margin-left: 6px;
}
.cs-add {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cs-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cs-tag {
  font-size: 12px;
  color: #6b7280;
  width: 34px;
}
</style>
