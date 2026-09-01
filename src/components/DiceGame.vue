<template>
  <div class="dice-game">
    <h2>🎲 回合制游戏 - 自定义名称与修正值</h2>
    <p class="hint">
      分别配置玩家与敌人 → 保存数据 → 点击「掷骰子」按总点数自动排序；
      可以直接点表格里的排序数字修改名次，再点「自定义表格」应用手动顺序。
    </p>

    <!-- ========== 玩家部分 ========== -->
    <div class="section">
      <div class="section-head">
        <h3>👥 玩家</h3>
        <div class="inline-controls">
          <label class="count-label">
            人数 x：
            <el-input-number v-model="playerCount" :min="0" :max="50" size="small" style="width: 110px" />
          </label>
          <el-button size="small" type="primary" plain @click="generatePlayers">生成玩家输入框</el-button>
          <el-button size="small" type="success" plain :disabled="!showPlayerForm" @click="savePlayers">保存玩家数据</el-button>
          <el-button size="small" plain @click="loadPlayersFromJSON">从 JSON 加载玩家</el-button>
        </div>
      </div>

      <table v-if="showPlayerForm" class="data-table">
        <thead>
          <tr>
            <th>玩家编号</th>
            <th>名字</th>
            <th>修正值</th>
            <th>优劣</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, index) in players" :key="index">
            <td class="num-cell">玩家 {{ index + 1 }}</td>
            <td><input v-model="p.name" type="text" placeholder="名字" /></td>
            <td><input v-model.number="p.bonus" type="number" placeholder="修正值" /></td>
            <td>
              <select v-model="p.advantage">
                <option value="normal">普通</option>
                <option value="advantage">优势</option>
                <option value="disadvantage">劣势</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>

      <table v-else-if="playerData.length" class="data-table readonly">
        <thead>
          <tr>
            <th>玩家编号</th>
            <th>名字</th>
            <th>修正值</th>
            <th>优劣</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, index) in playerData" :key="index">
            <td class="num-cell">玩家 {{ index + 1 }}</td>
            <td>{{ p.name }}</td>
            <td>{{ p.bonus }}</td>
            <td>{{ advantageText(p.advantage) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="!showPlayerForm && !playerData.length" class="empty-hint">
        尚未配置玩家数据，请先生成并保存。
      </div>
    </div>

    <!-- ========== 敌人部分 ========== -->
    <div class="section">
      <div class="section-head">
        <h3>👹 敌人</h3>
        <div class="inline-controls">
          <label class="count-label">
            人数 y：
            <el-input-number v-model="enemyCount" :min="0" :max="50" size="small" style="width: 110px" />
          </label>
          <el-button size="small" type="primary" plain @click="generateEnemies">生成敌人输入框</el-button>
          <el-button size="small" type="success" plain :disabled="!showEnemyForm" @click="saveEnemies">保存敌人数据</el-button>
          <el-button size="small" plain @click="loadEnemiesFromJSON">从 JSON 加载敌人</el-button>
        </div>
      </div>

      <table v-if="showEnemyForm" class="data-table">
        <thead>
          <tr>
            <th>敌人编号</th>
            <th>名字</th>
            <th>修正值</th>
            <th>优劣</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, index) in enemies" :key="index">
            <td class="num-cell">敌人 {{ index + 1 }}</td>
            <td><input v-model="e.name" type="text" placeholder="名字" /></td>
            <td><input v-model.number="e.bonus" type="number" placeholder="修正值" /></td>
            <td>
              <select v-model="e.advantage">
                <option value="normal">普通</option>
                <option value="advantage">优势</option>
                <option value="disadvantage">劣势</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>

      <table v-else-if="enemyData.length" class="data-table readonly">
        <thead>
          <tr>
            <th>敌人编号</th>
            <th>名字</th>
            <th>修正值</th>
            <th>优劣</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, index) in enemyData" :key="index">
            <td class="num-cell">敌人 {{ index + 1 }}</td>
            <td>{{ e.name }}</td>
            <td>{{ e.bonus }}</td>
            <td>{{ advantageText(e.advantage) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="!showEnemyForm && !enemyData.length" class="empty-hint">
        尚未配置敌人数据，请先生成并保存。
      </div>
    </div>

    <!-- ========== 操作区 ========== -->
    <div class="action-bar">
      <el-button type="primary" size="large" @click="rollDice">🎲 掷骰子</el-button>
      <el-button size="large" :disabled="!characters.length" @click="copyNames">复制第二列</el-button>
      <el-button size="large" :disabled="!characters.length" @click="applyCustomRank">自定义表格</el-button>
    </div>

    <!-- ========== 后端共享 ========== -->
    <div class="share-bar">
      <el-tag :type="initTagType" size="small">{{ initStatusText }}</el-tag>
      <el-input v-model="initBaseInput" size="small" placeholder="后端地址，如 http://localhost:12226/api" class="share-input" />
      <el-button size="small" @click="testInitiativeConn">测试连接</el-button>
      <el-button size="small" type="success" plain :disabled="initStatus !== 'online'" @click="publishResults()">📤 发布当前结果</el-button>
      <el-button size="small" :disabled="initStatus !== 'online'" @click="fetchSharedResults()">📥 刷新后端结果</el-button>
      <el-checkbox v-model="autoRefresh" @change="onAutoRefreshChange">每 5 秒自动刷新</el-checkbox>
      <span v-if="lastPublish" class="share-time">上次发布 {{ lastPublish }}</span>
    </div>

    <!-- ========== 结果展示 ========== -->
    <div v-if="characters.length" class="result">
      <div class="result-head">
        <h3>掷骰结果（共 {{ characters.length }} 名角色）</h3>
        <span class="result-tip">💡 点击「排序」列中的数字可手动修改名次，再点「自定义表格」应用。</span>
      </div>
      <table id="myTable" class="data-table result-table">
        <thead>
          <tr>
            <th>排序</th>
            <th>角色</th>
            <th>名字</th>
            <th>基础点数</th>
            <th>修正值</th>
            <th>优劣</th>
            <th>总点数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, index) in characters" :key="c.id">
            <td
              contenteditable="true"
              class="rank-cell"
              :title="`当前第 ${index + 1} 名，点击可修改`"
              @blur="onRankEdit(c.id, $event)"
              @keydown.enter.prevent="onRankEnter"
            >{{ index + 1 }}</td>
            <td>{{ c.type }}</td>
            <td class="name-cell">{{ c.name }}</td>
            <td class="num-cell">{{ c.base }}</td>
            <td class="num-cell">{{ c.bonus }}</td>
            <td>{{ c.advantageText }}</td>
            <td class="total-cell">{{ c.total }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  backendPingInitiative,
  backendFetchInitiative,
  backendPublishInitiative,
  getBackendBase,
  setBackendBase,
} from '../api/characterBackend'

interface Combatant {
  name: string
  bonus: number
  advantage: string
}

interface RollResult {
  id: number
  type: string
  name: string
  base: number
  bonus: number
  advantageNum: number
  advantageText: string
  total: number
  rankInput?: number
}

const ADVANTAGE_NUM: Record<string, number> = {
  normal: 0,
  advantage: 5,
  disadvantage: -5,
}

const ADVANTAGE_TEXT: Record<string, string> = {
  normal: '普通',
  advantage: '优势 (+5)',
  disadvantage: '劣势 (-5)',
}

const playerCount = ref(2)
const enemyCount = ref(2)

const players = ref<Combatant[]>([])
const enemies = ref<Combatant[]>([])
const playerData = ref<Combatant[]>([])
const enemyData = ref<Combatant[]>([])

const showPlayerForm = ref(false)
const showEnemyForm = ref(false)

const characters = ref<RollResult[]>([])
let idCounter = 0

function advantageNum(a: string): number {
  return ADVANTAGE_NUM[a] ?? 0
}
function advantageText(a: string): string {
  return ADVANTAGE_TEXT[a] ?? '普通'
}

// 用 playerData 预填生成编辑表单
function generatePlayers() {
  if (!Number.isInteger(playerCount.value) || playerCount.value < 0) {
    ElMessage.warning('请输入有效的非负整数！')
    return
  }
  players.value = Array.from({ length: playerCount.value }, (_, i) => ({
    name: playerData.value[i]?.name ?? '',
    bonus: playerData.value[i]?.bonus ?? 0,
    advantage: playerData.value[i]?.advantage ?? 'normal',
  }))
  showPlayerForm.value = true
}

function savePlayers() {
  for (const p of players.value) {
    if (!p.name.trim()) {
      ElMessage.warning('请填写所有玩家名字！')
      return
    }
  }
  playerData.value = players.value.map((p) => ({ ...p }))
  localStorage.setItem('player', JSON.stringify(playerData.value))
  showPlayerForm.value = false
  ElMessage.success('玩家数据已保存到浏览器本地存储')
}

function generateEnemies() {
  if (!Number.isInteger(enemyCount.value) || enemyCount.value < 0) {
    ElMessage.warning('请输入有效的非负整数！')
    return
  }
  enemies.value = Array.from({ length: enemyCount.value }, (_, i) => ({
    name: enemyData.value[i]?.name ?? '',
    bonus: enemyData.value[i]?.bonus ?? 0,
    advantage: enemyData.value[i]?.advantage ?? 'normal',
  }))
  showEnemyForm.value = true
}

function saveEnemies() {
  for (const e of enemies.value) {
    if (!e.name.trim()) {
      ElMessage.warning('请填写所有敌人名字！')
      return
    }
  }
  enemyData.value = enemies.value.map((e) => ({ ...e }))
  localStorage.setItem('enemy', JSON.stringify(enemyData.value))
  showEnemyForm.value = false
  ElMessage.success('敌人数据已保存到浏览器本地存储')
}

// 从 JSON 加载（补全 advantage 字段）
async function loadPlayersFromJSON() {
  const list = await fetchCombatants('/data/player.json')
  if (!list) return
  playerData.value = list
  localStorage.setItem('player', JSON.stringify(playerData.value))
  showPlayerForm.value = false
  ElMessage.success('成功加载玩家 JSON 数据')
}

async function loadEnemiesFromJSON() {
  const list = await fetchCombatants('/data/enemy.json')
  if (!list) return
  enemyData.value = list
  localStorage.setItem('enemy', JSON.stringify(enemyData.value))
  showEnemyForm.value = false
  ElMessage.success('成功加载敌人 JSON 数据')
}

async function fetchCombatants(path: string): Promise<Combatant[] | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error('HTTP 错误: ' + res.status)
    const raw = await res.json()
    if (!Array.isArray(raw)) throw new Error('数据格式错误')
    return raw.map((r: any) => ({
      name: String(r?.name ?? ''),
      bonus: Number(r?.bonus) || 0,
      advantage: r?.advantage || 'normal',
    }))
  } catch (err) {
    console.error(err)
    ElMessage.error('无法加载 JSON 数据，请检查文件路径或是否运行在 HTTP 服务中')
    return null
  }
}

// ========== 掷骰子逻辑 ==========
function rollDice() {
  if (!playerData.value.length && !enemyData.value.length) {
    ElMessage.warning('请至少保存一组角色数据！')
    return
  }

  const list: RollResult[] = []
  const push = (type: string, c: Combatant) => {
    const base = Math.floor(Math.random() * 20) + 1
    const advN = advantageNum(c.advantage)
    list.push({
      id: ++idCounter,
      type,
      name: c.name,
      base,
      bonus: c.bonus,
      advantageNum: advN,
      advantageText: advantageText(c.advantage),
      total: base + c.bonus + advN,
    })
  }

  playerData.value.forEach((p) => push('玩家', p))
  enemyData.value.forEach((e) => push('敌人', e))

  list.sort((a, b) => b.total - a.total)
  characters.value = list

  // 在线时自动发布到后端供所有人查看
  publishResults(true)
}

// 复制结果表的第二列（名字）
async function copyNames() {
  const names = characters.value.map((c) => c.name)
  const text = names.join('\n')
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制：\n' + text)
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请重试')
  }
}

// 编辑排序单元格
function onRankEdit(id: number, e: FocusEvent) {
  const el = e.target as HTMLElement
  const text = el.textContent?.trim() ?? ''
  const rank = parseInt(text, 10)
  const c = characters.value.find((item) => item.id === id)
  if (!c) return

  if (Number.isNaN(rank) || rank < 1) {
    c.rankInput = undefined
    el.textContent = String(characters.value.indexOf(c) + 1)
    return
  }
  c.rankInput = rank
}

function onRankEnter(e: KeyboardEvent) {
  ;(e.target as HTMLElement).blur()
}

// 按用户输入的 rank 重排（无效值放最后），重排后显示连续排名
function applyCustomRank() {
  const sorted = [...characters.value].sort((a, b) => {
    const ra = a.rankInput ?? Infinity
    const rb = b.rankInput ?? Infinity
    return ra - rb
  })
  sorted.forEach((c) => {
    c.rankInput = undefined
  })
  characters.value = sorted
  ElMessage.success('已按自定义排序应用')
}

// ========== 状态持久化（离开后回来仍保留） ==========
const DICE_STATE_KEY = 'dnd-initiative-state'

function saveDiceState() {
  try {
    localStorage.setItem(
      DICE_STATE_KEY,
      JSON.stringify({
        playerCount: playerCount.value,
        enemyCount: enemyCount.value,
        showPlayerForm: showPlayerForm.value,
        showEnemyForm: showEnemyForm.value,
        characters: characters.value,
      })
    )
  } catch (e) {
    console.error('保存先攻状态失败', e)
  }
}

function loadDiceState(): any | null {
  try {
    const saved = localStorage.getItem(DICE_STATE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

// ========== 初始化：读取本地存储，其次加载 JSON，最后恢复界面状态 ==========
onMounted(async () => {
  const savedPlayer = localStorage.getItem('player')
  if (savedPlayer) {
    try {
      const parsed = JSON.parse(savedPlayer)
      if (Array.isArray(parsed) && parsed.length) {
        playerData.value = parsed.map((p: any) => ({
          name: String(p?.name ?? ''),
          bonus: Number(p?.bonus) || 0,
          advantage: p?.advantage || 'normal',
        }))
      }
    } catch (e) {
      console.error('读取玩家数据失败', e)
    }
  }
  if (!playerData.value.length) await loadPlayersFromJSON()

  const savedEnemy = localStorage.getItem('enemy')
  if (savedEnemy) {
    try {
      const parsed = JSON.parse(savedEnemy)
      if (Array.isArray(parsed) && parsed.length) {
        enemyData.value = parsed.map((e: any) => ({
          name: String(e?.name ?? ''),
          bonus: Number(e?.bonus) || 0,
          advantage: e?.advantage || 'normal',
        }))
      }
    } catch (err) {
      console.error('读取敌人数据失败', err)
    }
  }
  if (!enemyData.value.length) await loadEnemiesFromJSON()

  // 恢复界面状态与投掷结果
  const state = loadDiceState()
  if (state) {
    if (typeof state.playerCount === 'number') playerCount.value = state.playerCount
    if (typeof state.enemyCount === 'number') enemyCount.value = state.enemyCount
    if (state.showPlayerForm) {
      generatePlayers()
    } else if (typeof state.showPlayerForm === 'boolean') {
      showPlayerForm.value = state.showPlayerForm
    }
    if (state.showEnemyForm) {
      generateEnemies()
    } else if (typeof state.showEnemyForm === 'boolean') {
      showEnemyForm.value = state.showEnemyForm
    }
    if (Array.isArray(state.characters)) {
      characters.value = state.characters.map((c: any) => ({ ...c, rankInput: undefined }))
      idCounter = characters.value.reduce((m, c) => Math.max(m, c.id || 0), 0)
    }
  }

  // 静默检查后端并拉取共享结果（让所有查看者看到最新发布）
  await silentBackendInit()
})

// 自动保存状态（人数、表单显示、投掷结果）
watch([playerCount, enemyCount, showPlayerForm, showEnemyForm], saveDiceState)
watch(characters, saveDiceState, { deep: true })

// ========== 后端共享：发布投掷结果给所有人查看 ==========
const initStatus = ref<'offline' | 'online' | 'checking'>('offline')
const initBaseInput = ref(getBackendBase())
const lastPublish = ref('')
const autoRefresh = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const initTagType = computed(() =>
  initStatus.value === 'online' ? 'success' : initStatus.value === 'checking' ? 'info' : 'warning'
)
const initStatusText = computed(() => {
  if (initStatus.value === 'checking') return '后端连接中…'
  if (initStatus.value === 'online') return '后端已连接'
  return '后端离线（仅本机可见）'
})

function normalizeRollResult(c: any) {
  return {
    id: Number(c?.id) || 0,
    type: c?.type ?? '玩家',
    name: c?.name ?? '',
    base: Number(c?.base) || 0,
    bonus: Number(c?.bonus) || 0,
    advantageNum: Number(c?.advantageNum) || 0,
    advantageText: c?.advantageText ?? '普通',
    total: Number(c?.total) || 0,
    rankInput: undefined,
  }
}

async function testInitiativeConn() {
  setBackendBase(initBaseInput.value)
  initStatus.value = 'checking'
  const ok = await backendPingInitiative()
  initStatus.value = ok ? 'online' : 'offline'
  if (ok) {
    ElMessage.success('后端连接成功')
  } else {
    ElMessage.warning('无法连接后端，投掷结果仅本机可见')
  }
}

// 发布当前投掷结果（silent=true 时不弹提示，用于掷骰后自动发布）
async function publishResults(silent = false) {
  if (initStatus.value !== 'online') {
    if (!silent) ElMessage.warning('后端离线，无法发布')
    return
  }
  initStatus.value = 'checking'
  const ok = await backendPublishInitiative(characters.value)
  initStatus.value = ok ? 'online' : 'offline'
  if (ok) {
    lastPublish.value = new Date().toLocaleTimeString()
    if (!silent) ElMessage.success('结果已发布到后端，所有人可查看')
  } else {
    if (!silent) ElMessage.error('发布失败，请检查后端')
  }
}

// 从后端拉取最新发布的投掷结果
async function fetchSharedResults(quiet = false) {
  const res = await backendFetchInitiative()
  if (res && Array.isArray(res.data) && res.data.length) {
    characters.value = res.data.map(normalizeRollResult)
    if (res.updatedAt) lastPublish.value = new Date(res.updatedAt).toLocaleTimeString()
    initStatus.value = 'online'
    if (!quiet) ElMessage.success('已刷新后端结果')
  } else {
    initStatus.value = 'offline'
    if (!quiet) ElMessage.warning('后端暂无结果或未连接')
  }
}

function onAutoRefreshChange() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (autoRefresh.value) {
    refreshTimer = setInterval(() => fetchSharedResults(true), 5000)
  }
}

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

// 页面加载时静默检查后端，若在线则拉取共享结果展示
async function silentBackendInit() {
  setBackendBase(initBaseInput.value)
  const ok = await backendPingInitiative()
  if (ok) {
    initStatus.value = 'online'
    await fetchSharedResults(true)
  } else {
    initStatus.value = 'offline'
  }
}
</script>

<style scoped>
.dice-game {
  padding: 8px 4px 40px;
  font-family: '黑体', SimHei, 'PingFang SC', sans-serif;
}

h2 {
  margin-top: 0;
  margin-bottom: 4px;
}

.hint {
  color: #777;
  font-size: 13px;
  margin-top: 4px;
  margin-bottom: 20px;
}

.section {
  margin-bottom: 24px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.section-head h3 {
  margin: 0;
}

.inline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.count-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  white-space: nowrap;
}

/* 数据表 */
.data-table {
  width: 100%;
  max-width: 720px;
  border-collapse: collapse;
  margin-top: 8px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.data-table th,
.data-table td {
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
  text-align: left;
  font-size: 13px;
}

.data-table th {
  background-color: #f3f4f6;
  font-weight: 600;
}

.data-table input[type='text'],
.data-table input[type='number'],
.data-table select {
  width: 100%;
  padding: 4px 6px;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
}

.data-table input[type='number'] {
  max-width: 90px;
}

.num-cell {
  text-align: center;
  color: #555;
}

.name-cell {
  font-weight: bold;
}

.total-cell {
  font-weight: bold;
  text-align: center;
  color: #b45309;
}

.readonly td {
  background: #fafafa;
}

.empty-hint {
  margin-top: 8px;
  color: #9ca3af;
  font-size: 13px;
}

/* 操作区 */
.action-bar {
  display: flex;
  gap: 10px;
  margin: 20px 0 10px;
  flex-wrap: wrap;
}

/* 后端共享栏 */
.share-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 16px;
}
.share-input {
  max-width: 320px;
}
.share-time {
  color: #9ca3af;
  font-size: 12px;
}

/* 结果 */
.result {
  margin-top: 16px;
}

.result-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.result-head h3 {
  margin: 0;
}

.result-tip {
  color: #9ca3af;
  font-size: 12px;
}

.result-table {
  max-width: 820px;
}

.rank-cell {
  text-align: center;
  font-weight: bold;
  cursor: text;
  min-width: 48px;
  background: #fffbeb;
}

.rank-cell:focus {
  outline: 2px solid #f59e0b;
  background: #fff7ed;
}
</style>
