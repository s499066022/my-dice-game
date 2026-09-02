<template>
  <div class="hex-container">
    <h2>🗺️ 战斗网格（Hex）</h2>
    <p class="hint">
      无限六边形地图，1 格 = 5 尺。从左上角把「团的角色」或「NPC/怪物」拖到网格上放置；
      右上角工具可切「拖图 / 拖拽人物 / 测量 / 锥形」并管理已放置人物（改名/改大小/删除）。
    </p>

    <!-- 战斗会话（长连接） -->
    <CombatSessionPanel />

    <!-- 后端同步 -->
    <div class="backend-bar">
      <el-tag :type="mapTagType" size="small">{{ mapStatusText }}</el-tag>
      <el-input v-model="mapBaseInput" size="small" placeholder="后端地址，如 http://localhost:12226/api" class="be-input" />
      <el-button size="small" @click="testMapConn">测试连接</el-button>
      <el-button size="small" type="success" plain @click="syncMapNow">立即同步</el-button>
      <el-checkbox v-model="autoSync" @change="onAutoSyncChange">每 5 秒同步位置</el-checkbox>
      <span v-if="lastSync" class="be-time">上次同步 {{ lastSync }}</span>
    </div>

    <!-- 地图舞台 -->
    <div ref="stageRef" class="map-stage">
      <canvas
        ref="canvasRef"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseLeave"
        @wheel.prevent="onWheel"
        @contextmenu.prevent="onContextMenu"
        @dragover.prevent="onDragOver"
        @drop="onDrop"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
      ></canvas>

      <!-- 左上角：角色来源（暂屏蔽，改用战斗会话面板添加） -->
      <div v-if="showLibrary" class="library-panel">
        <div class="lp-tabs">
          <button :class="{ on: libTab === 'party' }" @click="libTab = 'party'">👥 团</button>
          <button :class="{ on: libTab === 'npc' }" @click="libTab = 'npc'">👹 NPC/怪物</button>
          <button :class="{ on: libTab === 'init' }" @click="libTab = 'init'">🎲 先攻</button>
        </div>

        <div v-if="libTab === 'party'" class="lp-block">
          <el-select v-model="selectedPartyId" size="small" style="width: 100%" placeholder="选择团…">
            <el-option v-for="p in parties" :key="p.id" :value="p.id" :label="`${p.name || '未命名团'}（${p.memberIds.length}）`" />
          </el-select>
          <div v-if="!partyMembers.length" class="lp-empty">该团无成员，或角色卡库为空</div>
          <div class="lp-chips">
            <div
              v-for="m in partyMembers"
              :key="m.id"
              class="lp-chip"
              :title="`拖我到网格上（${cardSizeLabel(m)}）`"
              draggable="true"
              @dragstart="onChipDrag($event, chipPayloadFromCard(m))"
            >
              <span class="lp-dot" :style="{ background: memberColor(m.id) }"></span>
              <span class="lp-name">{{ m.name || '未命名' }}</span>
              <span class="lp-sub">{{ cardSizeLabel(m) }}</span>
            </div>
          </div>
        </div>

        <div v-else-if="libTab === 'npc'" class="lp-block">
          <div class="lp-create">
            <input type="text" v-model="npcName" placeholder="名称" class="lp-input" />
            <el-select v-model="npcType" size="small" style="width: 82px">
              <el-option value="NPC" label="NPC" /><el-option value="怪物" label="怪物" />
            </el-select>
            <el-select v-model="npcSize" size="small" style="width: 92px">
              <el-option v-for="o in SIZE_OPTIONS" :key="o.label" :value="o.val" :label="sizeLabel(o.val)" />
            </el-select>
            <input type="color" v-model="npcColor" class="lp-color" />
            <button class="lp-add" title="添加" @click="addNpc">＋</button>
          </div>
          <div v-if="!npcs.length" class="lp-empty">还没有 NPC/怪物，填名字点 ＋ 添加</div>
          <div class="lp-chips">
            <div
              v-for="n in npcs"
              :key="n.id"
              class="lp-chip"
              title="拖我到网格上"
              draggable="true"
              @dragstart="onChipDrag($event, { name: n.name, color: n.color, diameter: n.size || 1 })"
            >
              <span class="lp-dot" :style="{ background: n.color }"></span>
              <span class="lp-name">{{ n.name }}</span>
              <span class="lp-sub">{{ n.type }} · {{ sizeLabel(n.size || 1) }}</span>
              <button class="lp-x" title="移除" @click.stop="removeNpc(n.id)">×</button>
            </div>
          </div>
        </div>

        <div v-else class="lp-block">
          <div class="lp-empty">先攻顺序（来自先攻页，仅展示）</div>
          <div v-for="(row, idx) in initiativeRows" :key="idx" class="lp-init-row">
            <span class="lp-init-rank">{{ idx + 1 }}</span>
            <span class="lp-dot" :style="{ background: row.type === '敌人' ? '#ef4444' : '#3b82f6' }"></span>
            <span class="lp-name">{{ row.name }}</span>
            <span class="lp-sub">{{ row.type }}</span>
            <span class="lp-init-total">{{ row.total }}</span>
          </div>
          <div v-if="!initiativeRows.length" class="lp-empty">先攻页暂无结果，请先掷骰</div>
        </div>
      </div>

      <!-- 左下角坐标 -->
      <div class="coord-badge">
        <span v-if="hoverPos">坐标 ({{ hoverPos.q }}, {{ hoverPos.r }})</span>
        <span v-else>拖角色到网格放置</span>
      </div>

      <!-- 右上角工具面板 -->
      <div class="tools-panel" :class="{ mini: !toolsOpen }">
        <div class="tools-toggle" title="收起 / 展开工具栏" @click="toolsOpen = !toolsOpen">{{ toolsOpen ? '−' : '🧰' }}</div>

        <template v-if="toolsOpen">
          <div class="tp-modes">
            <button :class="{ on: tool === 'pan' }" title="拖拽地图" @click="tool = 'pan'">🖐 拖图</button>
            <button :class="{ on: tool === 'char' }" title="拖拽人物位置" @click="tool = 'char'">🧍 拖拽人物</button>
            <button :class="{ on: tool === 'measure' }" title="测量距离" @click="tool = 'measure'">📏 测量</button>
            <button :class="{ on: tool === 'cone' }" title="法术锥形" @click="tool = 'cone'">🔺 锥形</button>
            <button :class="{ on: tool === 'circle' }" title="圆形施法（范围）" @click="tool = 'circle'">🔵 圆形</button>
          </div>

          <div class="tp-zoom">
            <button title="缩小" @click="zoomBy(1 / 1.2)">－</button>
            <button title="重置视图" @click="resetView">⟳</button>
            <button title="放大" @click="zoomBy(1.2)">＋</button>
            <span class="tp-zoom-val">{{ Math.round(zoom * 100) }}%</span>
          </div>

          <div v-if="tool === 'measure'" class="tp-fields">
            <span class="tp-tip">依次点击两点</span>
            <span v-if="measureData" class="tp-result">{{ measureData }}</span>
            <button class="tp-btn" @click="clearMeasure">清除</button>
          </div>
          <div v-else-if="tool === 'cone'" class="tp-fields">
            <span class="tp-tip">锥形(尺)</span>
            <el-input-number v-model="coneFt" :min="5" :max="120" :step="5" size="small" style="width: 90px" />
            <el-select v-model="spellBind" size="small" style="width: 104px" placeholder="绑定参战者">
              <el-option value="" label="不绑定" />
              <el-option v-for="t in session.combatants" :key="t.id" :value="t.id" :label="t.name || '角色'" />
            </el-select>
            <span class="tp-tip">点起点→点方向</span>
            <button class="tp-btn" @click="clearCone">清除</button>
          </div>
          <div v-else-if="tool === 'circle'" class="tp-fields">
            <span class="tp-tip">半径(尺)</span>
            <el-input-number v-model="circleFt" :min="5" :max="120" :step="5" size="small" style="width: 90px" />
            <el-select v-model="spellBind" size="small" style="width: 104px" placeholder="绑定参战者">
              <el-option value="" label="不绑定" />
              <el-option v-for="t in session.combatants" :key="t.id" :value="t.id" :label="t.name || '角色'" />
            </el-select>
            <span class="tp-tip">点中心放置</span>
            <button class="tp-btn" @click="clearCircle">清除</button>
          </div>

          <!-- 会话参战者（可拖拽） -->
          <div v-if="session.combatants.length" class="tp-list">
            <div class="tp-list-title">⚔️ 参战者（{{ session.combatants.length }}）</div>
            <div v-for="cmb in session.combatants" :key="cmb.id" class="tp-row tp-row-token" :class="{ on: cmb.id === session.currentCombatantId.value }" :title="'卡片ID: ' + (cmb.refId || '—')">
              <input type="color" v-model="cmb.color" class="tp-col" @click.stop @change="saveSession" />
              <input type="text" v-model="cmb.name" class="tp-name" @click.stop />
              <span class="tp-stat">
                <input type="number" v-model.number="cmb.hp.current" class="tp-hp" min="0" @click.stop @change="saveSession" />
                <span class="tp-hpsep">/</span>
                <input type="number" v-model.number="cmb.hp.max" class="tp-hp" min="0" @click.stop @change="saveSession" />
              </span>
              <span class="tp-stat">AC{{ cmb.ac }}</span>
              <el-select v-model="cmb.size" size="small" style="width: 104px" @click.stop>
                <el-option v-for="o in SIZE_OPTIONS" :key="o.label" :value="o.val" :label="sizeLabel(o.val)" />
              </el-select>
              <!-- <button class="tp-del" title="移除" :disabled="session.locked.value" @click.stop="session.removeCombatant(cmb.id)">✕</button> -->
            </div>
          </div>

          <!-- 已放置人物（含 HP/AC） -->
          <div class="tp-list">
            <div class="tp-list-title">已放置（{{ tokens.length }}）</div>
            <div v-for="tok in tokens" :key="tok.id" class="tp-row tp-row-token" :class="{ on: tok.id === selectingId }" @click="selectingId = tok.id">
              <span class="tp-dot" :style="{ background: tok.color }"></span>
              <input type="text" v-model="tok.name" class="tp-name" @click.stop />
              <el-select v-model="tok.diameter" size="small" style="width: 116px" @click.stop>
                <el-option v-for="o in SIZE_OPTIONS" :key="o.label" :value="o.val" :label="sizeLabel(o.val)" />
              </el-select>
              <button class="tp-del" title="删除" :disabled="session.locked.value" @click.stop="removeToken(tok.id)">✕</button>
            </div>
            <div v-if="!tokens.length" class="tp-empty">暂无人物，从左上角拖入</div>
          </div>

          <!-- 法术区域（会话，可绑定参战者） -->
          <div class="tp-list">
            <div class="tp-list-title">法术区域（锥形/圆形）{{ session.spellAreas.length }}</div>
            <div v-for="ind in session.spellAreas" :key="ind.id" class="tp-row">
              <span class="tp-dot" :style="{ background: ind.type === 'circle' ? '#3b82f6' : '#ef4444' }"></span>
              <span class="tp-kind">{{ ind.type === 'circle' ? '🔵' : '🔺' }}{{ ind.ft }}尺</span>
              <el-select v-model="ind.boundTo" size="small" style="width: 112px" placeholder="绑定参战者" @change="saveSession">
                <el-option :value="null" label="不绑定" />
                <el-option v-for="t in session.combatants" :key="t.id" :value="t.id" :label="t.name || '角色'" />
              </el-select>
              <button class="tp-del" title="删除" @click.stop="removeIndicator(ind.id)">✕</button>
            </div>
            <div v-if="!session.spellAreas.length" class="tp-empty">暂无法术区域，用锥形/圆形工具放置</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CombatSessionPanel from '../components/CombatSessionPanel.vue'
import { useCombatSession } from '../composables/useCombatSession'
import { backendPing, backendFetchMap, backendPublishMap, backendFetchInitiative, getBackendBase, setBackendBase } from '../api/characterBackend'
import { loadParties, type Party } from '../data/partyModel'
import { normalizeCharacterCard, type CharacterCard } from '../data/dndModel'

// ========== 配置 ==========
const HEX_SIZE = 30
const HEX_FT = 5
const STORAGE_KEY = 'dnd-hexmap'
const NPC_KEY = 'dnd-map-npcs'
const MIN_ZOOM = 0.3
const MAX_ZOOM = 4
const PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#f97316', '#ec4899']

interface Hex {
  q: number
  r: number
}
interface Token {
  id: number
  name: string
  color: string
  q: number
  r: number
  diameter: number
}
interface Npc {
  id: string
  name: string
  type: string
  color: string
  size: number // 占格
}
interface Indicator {
  id: number
  type: 'cone' | 'circle'
  q: number
  r: number
  angle: number // 锥形方向（弧度）；圆形忽略
  ft: number
  boundTo: number | null // 绑定角色 token id
}

const stageRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let gridCache: HTMLCanvasElement | null = null
let gridCacheKey = ''

const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const tool = ref<'pan' | 'char' | 'measure' | 'cone' | 'circle'>('char')
const libTab = ref<'party' | 'npc' | 'init'>('party')
const toolsOpen = ref(true)
const showLibrary = false // 暂屏蔽左上角色来源面板
const session = useCombatSession()
watch(session.drawNotifier, () => drawMap())

const tokens = reactive<Token[]>([])
const indicators = reactive<Indicator[]>([])
const selectingId = ref<number | null>(null)
const hoverPos = ref<Hex | null>(null)

// 左上角来源
const parties = ref<Party[]>([])
const cards = ref<CharacterCard[]>([])
const selectedPartyId = ref('')
const npcs = ref<Npc[]>([])
const npcName = ref('')
const npcType = ref('NPC')
const npcSize = ref(1)
const npcColor = ref('#ef4444')

const measureStart = ref<Hex | null>(null)
const measureEnd = ref<Hex | null>(null)
const measureData = ref('')
const coneStart = ref<Hex | null>(null)
const coneFt = ref(30)
const circleFt = ref(20)
const spellBind = ref('') // 绑定到某个参战者

const mapBaseInput = ref(getBackendBase())
const mapOnline = ref(false)
const lastSync = ref('')
const autoSync = ref(true)
let syncTimer: ReturnType<typeof setInterval> | null = null

let idCounter = 1
let dragCharId: number | null = null
let dragCmbId: string | null = null
let panDrag = false
let downOnChar = false
let downPos = { x: 0, y: 0 }
let moved = false
let dragPayload: { name: string; color: string; diameter: number } | null = null

const selectedToken = computed(() => tokens.find((t) => t.id === selectingId.value) || null)
const mapTagType = computed(() => (mapOnline.value ? 'success' : 'warning'))
const mapStatusText = computed(() => (mapOnline.value ? '后端已连接' : '后端离线（本地）'))

const partyMembers = computed<CharacterCard[]>(() => {
  const p = parties.value.find((x) => x.id === selectedPartyId.value)
  if (!p) return []
  return p.memberIds.map((id) => cards.value.find((c) => c.id === id)).filter((c): c is CharacterCard => !!c)
})

// 先攻展示：来自先攻页（名字 + 排序）
const initiativeRows = ref<{ type: string; name: string; total: number }[]>([])

const size = () => HEX_SIZE * zoom.value

// ========== 初始化 ==========
onMounted(async () => {
  loadLocal()
  loadCards()
  loadNpcs()
  if (parties.value.length) selectedPartyId.value = parties.value[0].id
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  const canvas = canvasRef.value
  if (canvas) ctx = canvas.getContext('2d')
  session.loadLocal()
  session.hookReverb()
  drawMap()
  await initMapBackend()
  onAutoSyncChange()
  loadInitiative()
})

watch(libTab, (v) => {
  if (v === 'init') loadInitiative()
})

onUnmounted(() => {
  if (syncTimer) clearInterval(syncTimer)
  window.removeEventListener('resize', resizeCanvas)
})

function resizeCanvas() {
  const stage = stageRef.value
  const canvas = canvasRef.value
  if (!stage || !canvas) return
  canvas.width = stage.clientWidth
  canvas.height = stage.clientHeight
  drawMap()
}

function loadCards() {
  try {
    const saved = localStorage.getItem('dnd-character-cards')
    if (saved) {
      const parsed = JSON.parse(saved)
      cards.value = Array.isArray(parsed) ? parsed.map(normalizeCharacterCard).filter((c): c is CharacterCard => !!c) : []
    }
    parties.value = loadParties()
  } catch (e) {
    console.error('读取角色数据失败', e)
  }
}

// ========== 坐标转换 ==========
function gridPixel(q: number, r: number, sz = HEX_SIZE) {
  return { x: sz * 1.5 * q, y: sz * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r) }
}
function hexToScreen(q: number, r: number) {
  const p = gridPixel(q, r, size())
  return { x: p.x + pan.value.x, y: p.y + pan.value.y }
}
function screenToHex(sx: number, sy: number): Hex {
  const sz = size()
  const x = sx - pan.value.x
  const y = sy - pan.value.y
  const q = ((2 / 3) * x) / sz
  const rr = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / sz
  return hexRound(q, rr)
}
function hexRound(q: number, r: number): Hex {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  let rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return { q: rq, r: rr }
}

// ========== 绘制 ==========
function drawMap() {
  if (!ctx || !canvasRef.value) return
  const canvas = canvasRef.value
  const key = viewKey()
  if (key !== gridCacheKey) {
    renderGrid()
    gridCacheKey = key
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (gridCache) ctx.drawImage(gridCache, 0, 0)
  const sz = size()

  tokens.forEach((tok) => {
    const sp = hexToScreen(tok.q, tok.r)
    drawToken(sp.x, sp.y, charRadius(tok.diameter), tok.color, tok.name, false, tok.id === selectingId.value)
  })

  // 战斗会话：参战者（角色/怪物）
  session.combatants.forEach((cmb) => {
    const sp = hexToScreen(cmb.q, cmb.r)
    drawToken(sp.x, sp.y, charRadius(cmb.size), cmb.color, cmb.name, false, cmb.id === session.currentCombatantId.value)
  })
  // 战斗会话：法术区域
  session.spellAreas.forEach((area) => {
    let origin = { q: area.q, r: area.r }
    if (area.boundTo) {
      const c = session.combatants.find((x) => x.id === area.boundTo)
      if (c) origin = { q: c.q, r: c.r }
    }
    if (area.type === 'circle') drawCircleShape(origin, area.ft)
    else drawConeShape(origin, area.angle, area.ft)
  })

  if (measureStart.value) {
    const a = hexToScreen(measureStart.value.q, measureStart.value.r)
    const t = measureEnd.value || (tool.value === 'measure' ? hoverPos.value : null)
    if (t) {
      const b = hexToScreen(t.q, t.r)
      const label = measureEnd.value ? measureData.value : measureDistance(measureStart.value, t) + '（预览）'
      drawMeasureLine(a, b, label)
    }
  }

  // 锥形放置预览（起点→方向）
  if (tool.value === 'cone' && coneStart.value && hoverPos.value) {
    const a = hexToScreen(coneStart.value.q, coneStart.value.r)
    const b = hexToScreen(hoverPos.value.q, hoverPos.value.r)
    drawConeShape(coneStart.value, Math.atan2(b.y - a.y, b.x - a.x), coneFt.value, true)
  }

  // 会话法术区域已在上面渲染（本地 indicators 不再使用，避免残留无法删除）

  // 放置预览：从左上角拖入
  if (dragPayload && hoverPos.value) {
    const sp = hexToScreen(hoverPos.value.q, hoverPos.value.r)
    drawToken(sp.x, sp.y, charRadius(dragPayload.diameter), dragPayload.color, dragPayload.name, true)
  } else if (tool.value === 'char' && hoverPos.value && !dragCharId && !downOnChar) {
    // 人物工具仅移动/拖动，不再新建；悬浮格轻微高亮
    const sp = hexToScreen(hoverPos.value.q, hoverPos.value.r)
    fillHex(sp.x, sp.y, size(), 'rgba(0,0,0,0.04)')
  }
}

function strokeHex(g: CanvasRenderingContext2D, x: number, y: number, sz: number, stroke: string, w: number) {
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i)
    const px = x + sz * Math.cos(a)
    const py = y + sz * Math.sin(a)
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
  g.strokeStyle = stroke
  g.lineWidth = w
  g.stroke()
}
function fillHex(x: number, y: number, sz: number, fill: string) {
  if (!ctx) return
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i)
    const px = x + sz * Math.cos(a)
    const py = y + sz * Math.sin(a)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}
function drawToken(x: number, y: number, r: number, color: string, name: string, preview = false, selected = false) {
  if (!ctx) return
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = preview ? hexToRgba(color, 0.25) : hexToRgba(color, 0.8)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
  if (selected && !preview) {
    ctx.beginPath()
    ctx.arc(x, y, r + 4, 0, Math.PI * 2)
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (name && !preview) {
    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#111'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name.length > 6 ? name.slice(0, 6) + '…' : name, x, y)
  }
}
function charRadius(diameter: number): number {
  // 体型占格（1 格 = 5 尺）：半径使圆形视觉上跨对应格数（1格≈外接圆半径）
  return diameter * HEX_SIZE * 0.9 * zoom.value
}
function hexToRgba(hex: string, a: number): string {
  const m = (hex || '#ef4444').replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
function drawMeasureLine(a: { x: number; y: number }, b: { x: number; y: number }, label: string) {
  if (!ctx) return
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#b45309'
  ctx.textAlign = 'center'
  ctx.fillText(label, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8)
}

// 视图缓存 key（zoom/pan/尺寸任一变化即重新渲染网格）
function viewKey(): string {
  const canvas = canvasRef.value
  return `${zoom.value}|${pan.value.x.toFixed(1)}|${pan.value.y.toFixed(1)}|${canvas ? canvas.width + 'x' + canvas.height : ''}`
}
function visibleRange() {
  const canvas = canvasRef.value
  const w = canvas ? canvas.width : 0
  const h = canvas ? canvas.height : 0
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: 0, y: h },
    { x: w, y: h },
  ].map((c) => screenToHex(c.x, c.y))
  let minQ = Infinity
  let maxQ = -Infinity
  let minR = Infinity
  let maxR = -Infinity
  corners.forEach((c) => {
    minQ = Math.min(minQ, c.q)
    maxQ = Math.max(maxQ, c.q)
    minR = Math.min(minR, c.r)
    maxR = Math.max(maxR, c.r)
  })
  return { minQ, maxQ, minR, maxR }
}
function renderGrid() {
  const canvas = canvasRef.value
  if (!canvas) return
  if (!gridCache) gridCache = document.createElement('canvas')
  if (gridCache.width !== canvas.width) gridCache.width = canvas.width
  if (gridCache.height !== canvas.height) gridCache.height = canvas.height
  const g = gridCache.getContext('2d')
  if (!g) return
  g.clearRect(0, 0, gridCache.width, gridCache.height)
  const { minQ, maxQ, minR, maxR } = visibleRange()
  const sz = size()
  const margin = sz * 2
  const w = canvas.width
  const h = canvas.height
  for (let q = Math.floor(minQ) - 3; q <= Math.ceil(maxQ) + 3; q++) {
    for (let r = Math.floor(minR) - 3; r <= Math.ceil(maxR) + 3; r++) {
      const sp = hexToScreen(q, r)
      if (sp.x < -margin || sp.x > w + margin || sp.y < -margin || sp.y > h + margin) continue
      strokeHex(g, sp.x, sp.y, sz, '#cbd5e1', 1)
    }
  }
}

// 解析指示物原点（若绑定角色则跟随其位置）
function drawConeShape(origin: Hex, angle: number, ft: number, isPreview = false) {
  if (!ctx) return
  const sz = size()
  const s = hexToScreen(origin.q, origin.r)
  const cells = Math.max(1, Math.round(ft / HEX_FT))
  const half = (26.5 * Math.PI) / 180
  const radius = cells * Math.sqrt(3) * sz
  ctx.beginPath()
  ctx.moveTo(s.x, s.y)
  ctx.arc(s.x, s.y, radius, angle - half, angle + half)
  ctx.closePath()
  ctx.fillStyle = isPreview ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.25)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(239,68,68,0.8)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#b91c1c'
  ctx.textAlign = 'center'
  ctx.fillText(`${ft} 尺`, s.x + Math.cos(angle) * radius * 0.5, s.y + Math.sin(angle) * radius * 0.5)
}

function drawCircleShape(origin: Hex, ft: number) {
  if (!ctx) return
  const sz = size()
  const c = hexToScreen(origin.q, origin.r)
  const cells = Math.max(1, Math.round(ft / HEX_FT))
  const radius = cells * Math.sqrt(3) * sz
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(59,130,246,0.15)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(59,130,246,0.85)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#1d4ed8'
  ctx.textAlign = 'center'
  ctx.fillText(`${ft} 尺`, c.x, c.y)
}

function commitCone(start: Hex, dir: Hex) {
  const a = hexToScreen(start.q, start.r)
  const b = hexToScreen(dir.q, dir.r)
  session.addSpellArea({ type: 'cone', q: start.q, r: start.r, angle: Math.atan2(b.y - a.y, b.x - a.x), ft: coneFt.value, boundTo: spellBind.value || null })
}
function commitCircle(center: Hex) {
  session.addSpellArea({ type: 'circle', q: center.q, r: center.r, angle: 0, ft: circleFt.value, boundTo: spellBind.value || null })
}
function removeIndicator(id: string) {
  session.removeSpellArea(id)
}
function hexDistance(a: Hex, b: Hex): number {
  const dq = Math.abs(a.q - b.q)
  const dr = Math.abs(a.r - b.r)
  const ds = Math.abs(a.q + a.r - b.q - b.r)
  return Math.max(dq, dr, ds)
}
function measureDistance(a: Hex, b: Hex): string {
  const cells = hexDistance(a, b)
  return `${cells} 格（${cells * HEX_FT} 尺）`
}

// ========== 缩放/平移 ==========
function zoomBy(factor: number) {
  const stage = stageRef.value
  const cx = stage ? stage.clientWidth / 2 : 0
  const cy = stage ? stage.clientHeight / 2 : 0
  const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * factor))
  pan.value.x = cx - (cx - pan.value.x) * (nz / zoom.value)
  pan.value.y = cy - (cy - pan.value.y) * (nz / zoom.value)
  zoom.value = nz
  drawMap()
}
function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
  drawMap()
}
function onWheel(e: WheelEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
  const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * factor))
  pan.value.x = cx - (cx - pan.value.x) * (nz / zoom.value)
  pan.value.y = cy - (cy - pan.value.y) * (nz / zoom.value)
  zoom.value = nz
  drawMap()
}

// ========== 事件 ==========
function eventPos(e: MouseEvent | DragEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
// ---- 触摸（移动端） ----
function touchPos(e: TouchEvent) {
  const t = e.touches[0] || e.changedTouches[0]
  return t ? { clientX: t.clientX, clientY: t.clientY } : null
}
function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  const p = touchPos(e)
  if (p) onMouseDown({ clientX: p.clientX, clientY: p.clientY, button: 0 } as MouseEvent)
}
function onTouchMove(e: TouchEvent) {
  const p = touchPos(e)
  if (p) onMouseMove({ clientX: p.clientX, clientY: p.clientY } as MouseEvent)
}
function onTouchEnd(e: TouchEvent) {
  const p = touchPos(e)
  const cx = p ? p.clientX : downPos.x
  const cy = p ? p.clientY : downPos.y
  onMouseUp({ clientX: cx, clientY: cy } as MouseEvent)
}
function onMouseDown(e: MouseEvent) {
  const { x, y } = eventPos(e)
  downPos = { x, y }
  moved = false
  if (e.button === 1 || tool.value === 'pan') {
    panDrag = true
    dragCharId = null
    downOnChar = false
    return
  }
  if (tool.value !== 'char') return
  const hit = hitAt(x, y)
  downOnChar = !!hit
  dragCharId = null
  dragCmbId = null
  if (hit) {
    if (hit.kind === 'cmb') dragCmbId = hit.id
    else dragCharId = hit.id
    selectingId.value = hit.id
  }
}
function onMouseMove(e: MouseEvent) {
  const { x, y } = eventPos(e)
  hoverPos.value = screenToHex(x, y)
  if (panDrag) {
    pan.value.x += x - downPos.x
    pan.value.y += y - downPos.y
    downPos = { x, y }
    drawMap()
    return
  }
  if (dragCmbId != null) {
    if (Math.hypot(x - downPos.x, y - downPos.y) > 4) moved = true
    if (hoverPos.value) session.moveCombatant(dragCmbId, hoverPos.value.q, hoverPos.value.r)
  } else if (dragCharId != null) {
    if (Math.hypot(x - downPos.x, y - downPos.y) > 4) moved = true
    const tok = tokens.find((t) => t.id === dragCharId)
    if (tok && hoverPos.value) {
      tok.q = hoverPos.value.q
      tok.r = hoverPos.value.r
    }
  }
  drawMap()
}
function onMouseUp(e: MouseEvent) {
  if (panDrag) {
    panDrag = false
    return
  }
  const hex = screenToHex(eventPos(e).x, eventPos(e).y)
  if (tool.value === 'char') {
    // 拖拽人物：仅移动已放置角色，点击空白不新建
  } else if (tool.value === 'measure') {
    if (hex) {
      if (!measureStart.value) {
        measureStart.value = hex
        measureEnd.value = null
      } else if (!measureEnd.value) {
        measureEnd.value = hex
        measureData.value = measureDistance(measureStart.value, hex)
      } else {
        measureStart.value = hex
        measureEnd.value = null
        measureData.value = ''
      }
    }
  } else if (tool.value === 'cone') {
    if (hex) {
      if (!coneStart.value) {
        coneStart.value = hex
      } else {
        commitCone(coneStart.value, hex)
        coneStart.value = null
      }
    }
  } else if (tool.value === 'circle') {
    if (hex) commitCircle(hex)
  }
  dragCharId = null
  dragCmbId = null
  downOnChar = false
  saveLocal()
  drawMap()
}
function onMouseLeave() {
  hoverPos.value = null
  dragCharId = null
  dragCmbId = null
  panDrag = false
  drawMap()
}
function onContextMenu(e: MouseEvent) {
  if (session.locked.value) return // 锁定时屏蔽删除
  const { x, y } = eventPos(e)
  const hit = hitAt(x, y)
  if (hit) {
    if (hit.kind === 'cmb') session.removeCombatant(hit.id)
    else removeToken(hit.id)
  }
}
function hitAt(x: number, y: number): { kind: 'token' | 'cmb'; id: any } | null {
  for (let i = session.combatants.length - 1; i >= 0; i--) {
    const cmb = session.combatants[i]
    const p = hexToScreen(cmb.q, cmb.r)
    if (Math.hypot(p.x - x, p.y - y) <= charRadius(cmb.size) + 4) return { kind: 'cmb', id: cmb.id }
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i]
    const p = hexToScreen(tok.q, tok.r)
    if (Math.hypot(p.x - x, p.y - y) <= charRadius(tok.diameter) + 4) return { kind: 'token', id: tok.id }
  }
  return null
}

// ========== 拖拽来源（左上角 → 网格） ==========
function chipPayloadFromCard(m: CharacterCard) {
  return { name: m.name || '未命名', color: memberColor(m.id), diameter: sizeFromCard(m) }
}
function onChipDrag(e: DragEvent, payload: { name: string; color: string; diameter: number }) {
  dragPayload = payload
  if (e.dataTransfer) e.dataTransfer.setData('text/plain', payload.name)
}
function onDragOver(e: DragEvent) {
  const { x, y } = eventPos(e)
  hoverPos.value = screenToHex(x, y)
  drawMap()
}
function onDrop(e: DragEvent) {
  const { x, y } = eventPos(e)
  const hex = screenToHex(x, y)
  if (dragPayload && hex) addToken(hex, dragPayload)
  dragPayload = null
  hoverPos.value = null
  drawMap()
}

// ========== 操作 ==========
function addToken(hex: Hex, opts: { name: string; color: string; diameter: number }) {
  const tok: Token = {
    id: idCounter++,
    name: opts.name || '角色' + idCounter,
    color: opts.color || nextColor(),
    q: hex.q,
    r: hex.r,
    diameter: Math.max(1, opts.diameter || 1),
  }
  tokens.push(tok)
  selectingId.value = tok.id
  saveLocal()
  schedulePublish()
}
function removeToken(id: number) {
  const i = tokens.findIndex((t) => t.id === id)
  if (i !== -1) tokens.splice(i, 1)
  indicators.forEach((ind) => {
    if (ind.boundTo === id) ind.boundTo = null
  })
  if (selectingId.value === id) selectingId.value = null
  saveLocal()
  drawMap()
}
function clearAll() {
  tokens.splice(0)
  selectingId.value = null
  saveLocal()
  drawMap()
}
function addNpc() {
  const name = (npcName.value || 'NPC').trim()
  npcs.value.push({ id: Date.now().toString(36), name, type: npcType.value, color: npcColor.value, size: npcSize.value })
  npcName.value = ''
  saveNpcs()
}
function removeNpc(id: string) {
  const i = npcs.value.findIndex((n) => n.id === id)
  if (i !== -1) npcs.value.splice(i, 1)
  saveNpcs()
}
// 从先攻页拉取名字与排序（后端共享优先，回退本地先攻状态）
async function loadInitiative() {
  try {
    const remote = await backendFetchInitiative()
    if (remote && Array.isArray(remote.data) && remote.data.length) {
      initiativeRows.value = remote.data.map((r: any) => ({ type: r.type || '玩家', name: r.name || '', total: Number(r.total) || 0 }))
      initiativeRows.value.sort((a, b) => b.total - a.total)
      return
    }
  } catch (e) {
    /* ignore */
  }
  try {
    const s = localStorage.getItem('dnd-initiative-state')
    if (s) {
      const d = JSON.parse(s)
      if (Array.isArray(d?.characters) && d.characters.length) {
        initiativeRows.value = d.characters.map((c: any) => ({ type: c.type || '玩家', name: c.name || '', total: Number(c.total) || 0 }))
        initiativeRows.value.sort((a, b) => b.total - a.total)
      }
    }
  } catch (e) {
    /* ignore */
  }
}
function clearMeasure() {
  measureStart.value = null
  measureEnd.value = null
  measureData.value = ''
  drawMap()
}
function clearCone() {
  for (let i = session.spellAreas.length - 1; i >= 0; i--) {
    if (session.spellAreas[i].type === 'cone') session.removeSpellArea(session.spellAreas[i].id)
  }
  coneStart.value = null
  saveLocal()
  drawMap()
}
function clearCircle() {
  for (let i = session.spellAreas.length - 1; i >= 0; i--) {
    if (session.spellAreas[i].type === 'circle') session.removeSpellArea(session.spellAreas[i].id)
  }
  saveLocal()
  drawMap()
}

// ========== 辅助 ==========
// 体型占格（1 格 = 5 尺）：微型≈0.5、小型/中型=1、大型=2、巨型=3、超巨型=4
const SIZE_OPTIONS = [
  { label: '微型', val: 0.5 },
  { label: '小/中型', val: 1 },
  { label: '大型', val: 2 },
  { label: '巨型', val: 3 },
  { label: '超巨型', val: 4 },
]
function sizeFromCard(c: CharacterCard): number {
  const s = c.size || ''
  if (s.includes('超巨')) return 4
  if (s.includes('巨型')) return 3
  if (s.includes('大型')) return 2
  if (s.includes('微型')) return 0.5
  return 1 // 小型 / 中型
}
function sizeLabel(val: number): string {
  const s = SIZE_OPTIONS.find((o) => o.val === val)
  return s ? `${s.label} · ${val}格` : `${val}格`
}
function saveSession() {
  session.saveLocal()
  session.drawNotifier.value++
}
function cardSizeLabel(c: CharacterCard): string {
  return c.size || '中型'
}
function memberColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
let colorIdx = 0
function nextColor(): string {
  return PALETTE[colorIdx++ % PALETTE.length]
}

// ========== 持久化 ==========
function saveLocal() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tokens: tokens.map((t) => ({ ...t })),
      indicators: indicators.map((i) => ({ ...i })),
      coneFt: coneFt.value,
    })
  )
}
function loadLocal() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const d = JSON.parse(saved)
      if (Array.isArray(d.tokens)) {
        d.tokens.forEach((t: any) =>
          tokens.push({ id: t.id, name: t.name || '角色', color: t.color || '#ef4444', q: t.q, r: t.r, diameter: t.diameter || 1 })
        )
        if (tokens.length) idCounter = Math.max(...tokens.map((t) => t.id)) + 1
      }
      if (Array.isArray(d.indicators)) {
        d.indicators.forEach((i: any) =>
          indicators.push({ id: i.id, type: i.type === 'circle' ? 'circle' : 'cone', q: i.q, r: i.r, angle: i.angle || 0, ft: i.ft || 30, boundTo: i.boundTo ?? null })
        )
      }
      if (typeof d.coneFt === 'number') coneFt.value = d.coneFt
    }
  } catch (e) {
    console.error('读取地图数据失败', e)
  }
}
function saveNpcs() {
  localStorage.setItem(NPC_KEY, JSON.stringify(npcs.value))
  schedulePublish()
}
function loadNpcs() {
  try {
    const saved = localStorage.getItem(NPC_KEY)
    if (saved) {
      const d = JSON.parse(saved)
      if (Array.isArray(d)) npcs.value = d
    }
  } catch (e) {
    console.error('读取 NPC 失败', e)
  }
}

// ========== 后端同步 ==========
async function initMapBackend() {
  setBackendBase(mapBaseInput.value)
  const ok = await backendPing()
  mapOnline.value = ok
  if (ok) {
    const data = await backendFetchMap()
    if (data && (data.tokens?.length || data.indicators?.length || data.npcs?.length)) applyRemoteMap(data)
    else if (tokens.length || indicators.length || npcs.value.length) await syncMapNow(true)
  }
}
async function testMapConn() {
  setBackendBase(mapBaseInput.value)
  const ok = await backendPing()
  mapOnline.value = ok
  if (ok) {
    const data = await backendFetchMap()
    if (data && (data.tokens.length || data.indicators.length || data.npcs.length)) applyRemoteMap(data)
    else if (tokens.length || indicators.length || npcs.value.length) await syncMapNow(true)
    ElMessage.success('后端已连接，地图已同步')
  } else {
    ElMessage.warning('无法连接后端')
  }
}
async function syncMapNow(silent = false) {
  if (!mapOnline.value) {
    if (!silent) ElMessage.warning('后端离线，无法同步')
    return
  }
  const ok = await backendPublishMap(
    tokens.map((t) => ({ ...t })),
    indicators.map((i) => ({ ...i })),
    npcs.value.map((n) => ({ ...n }))
  )
  if (ok) {
    lastSync.value = new Date().toLocaleTimeString()
    if (!silent) ElMessage.success('已同步地图')
  } else if (!silent) {
    ElMessage.error('同步失败')
  }
}
let publishTimer: ReturnType<typeof setTimeout> | null = null
function schedulePublish() {
  if (!mapOnline.value) return
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = setTimeout(() => syncMapNow(true), 1000)
}
async function pullMap() {
  if (!mapOnline.value || dragCharId != null) return
  const data = await backendFetchMap()
  if (data) mergeRemote(data)
}
function mergeList(local: any[], remote: any[], key: (x: any) => any) {
  remote.forEach((r: any) => {
    const existing = local.find((x) => key(x) === key(r))
    if (existing) Object.assign(existing, r)
    else local.push(r)
  })
}
function mergeRemote(data: { tokens: any[]; indicators: any[]; npcs: any[] }) {
  mergeList(tokens, data.tokens || [], (t) => t.id)
  mergeList(indicators, data.indicators || [], (i) => i.id)
  mergeList(npcs.value, data.npcs || [], (n) => n.id)
  idCounter = Math.max(idCounter, ...tokens.map((t) => t.id), ...indicators.map((i) => i.id)) + 1
  drawMap()
}
function onAutoSyncChange() {
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = null
  if (autoSync.value && mapOnline.value) {
    syncTimer = setInterval(async () => {
      await syncMapNow(true) // 推送本地
      await pullMap() // 拉取并合并（实时看到他人）
    }, 5000)
  }
}
// 用后端整份数据替换本地
function applyRemoteMap(data: { tokens: any[]; indicators: any[]; npcs: any[] }) {
  tokens.splice(0)
  ;(data.tokens || []).forEach((t: any) =>
    tokens.push(normToken(t))
  )
  indicators.splice(0)
  ;(data.indicators || []).forEach((i: any) =>
    indicators.push({ id: i.id, type: i.type === 'circle' ? 'circle' : 'cone', q: i.q, r: i.r, angle: i.angle || 0, ft: i.ft || 30, boundTo: i.boundTo ?? null })
  )
  npcs.value.splice(0)
  ;(data.npcs || []).forEach((n: any) =>
    npcs.value.push({ id: n.id, name: n.name || 'NPC', type: n.type || 'NPC', color: n.color || '#ef4444', size: Number(n.size) || 1 })
  )
  if (tokens.length) idCounter = Math.max(...tokens.map((t) => t.id)) + 1
  if (indicators.length) idCounter = Math.max(idCounter, ...indicators.map((i) => i.id)) + 1
  drawMap()
}
function normToken(t: any): Token {
  return { id: t.id, name: t.name || '角色', color: t.color || '#ef4444', q: t.q, r: t.r, diameter: t.diameter || 1 }
}
</script>

<style scoped>
.hex-container {
  padding: 8px 4px 40px;
}
.hex-container h2 {
  margin: 0 0 4px;
}
.hint {
  color: #777;
  font-size: 13px;
  margin: 4px 0 14px;
}
.backend-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 12px;
}
.be-input {
  max-width: 320px;
}
.be-time {
  color: #9ca3af;
  font-size: 12px;
}
.map-stage {
  position: relative;
  width: 100%;
  height: 90vh;
  min-height: 440px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fafafa;
  overflow: hidden;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
  touch-action: none;
}

/* 左上角来源 */
.library-panel {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 240px;
  max-height: 60%;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  z-index: 2;
}
.lp-tabs {
  display: flex;
  gap: 6px;
}
.lp-tabs button {
  flex: 1;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
}
.lp-tabs button.on {
  background: #eef2ff;
  border-color: #6366f1;
  color: #4f46e5;
  font-weight: 600;
}
.lp-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lp-empty {
  color: #9ca3af;
  font-size: 12px;
  padding: 4px 0;
}
.lp-create {
  display: flex;
  gap: 6px;
  align-items: center;
}
.lp-input {
  flex: 1;
  min-width: 50px;
  padding: 4px 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}
.lp-color {
  width: 34px;
  height: 28px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0;
}
.lp-add {
  border: 1px solid #6366f1;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.lp-chips {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lp-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 4px 6px;
  cursor: grab;
  font-size: 13px;
}
.lp-chip:hover {
  border-color: #6366f1;
}
.lp-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.lp-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.lp-sub {
  color: #9ca3af;
  font-size: 12px;
}
.lp-init-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 4px 6px;
  font-size: 13px;
}
.lp-init-rank {
  width: 18px;
  text-align: center;
  font-weight: 700;
  color: #4f46e5;
}
.lp-init-total {
  margin-left: auto;
  font-weight: 700;
  color: #b45309;
  min-width: 26px;
  text-align: right;
}
.lp-x {
  border: none;
  background: transparent;
  color: #dc2626;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

/* 左下角坐标 */
.coord-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: #4b5563;
  pointer-events: none;
}

/* 右上角工具 */
.tools-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 260px;
  max-height: 80%;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  z-index: 2;
}
.tools-panel.mini {
  width: auto;
  padding: 4px;
}
.tools-toggle {
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0 6px;
  background: #fff;
  line-height: 1.4;
  color: #4b5563;
}
.tools-toggle:hover {
  background: #f3f4f6;
}
.tp-modes {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tp-modes button,
.tp-zoom button,
.tp-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
}
.tp-modes button.on {
  background: #eef2ff;
  border-color: #6366f1;
  color: #4f46e5;
  font-weight: 600;
}
.tp-zoom {
  display: flex;
  align-items: center;
  gap: 4px;
}
.tp-zoom-val {
  font-size: 12px;
  color: #6b7280;
  margin-left: 4px;
}
.tp-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}
.tp-tip {
  color: #6b7280;
  font-size: 12px;
}
.tp-result {
  font-weight: 700;
  color: #b45309;
}
.tp-list {
  border-top: 1px solid #f3f4f6;
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tp-list-title {
  font-weight: 600;
  font-size: 13px;
  color: #4b5563;
}
.tp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 6px;
  padding: 3px 5px;
}
.tp-row.on {
  border-color: #6366f1;
  background: #eef2ff;
}
.tp-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.tp-stat {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}
.tp-hp {
  width: 44px;
  padding: 2px 3px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  text-align: center;
}
.tp-col {
  width: 24px;
  height: 24px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 0;
  flex: 0 0 auto;
}
.tp-hpsep {
  color: #9ca3af;
}
.tp-row-token {
  flex-wrap: wrap;
}
.tp-hpctrl,
.lp-hpctrl {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.tp-mini,
.lp-mini {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 4px;
  width: 18px;
  height: 18px;
  line-height: 1;
  cursor: pointer;
  font-size: 12px;
}
.tp-hpval,
.lp-hpval {
  font-size: 12px;
  color: #b91c1c;
  min-width: 30px;
  text-align: center;
}
.lp-hpctrl {
  margin-left: auto;
}
.tp-kind {
  font-size: 12px;
  color: #4b5563;
}
.tp-name {
  flex: 1;
  min-width: 0;
  padding: 3px 5px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 13px;
}
.tp-del {
  border: none;
  background: transparent;
  color: #dc2626;
  cursor: pointer;
}
.tp-empty {
  color: #9ca3af;
  font-size: 12px;
}
</style>
