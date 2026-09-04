<template>
  <div class="hex-container">
    <h2>🗺️ 战斗地图（Hex）</h2>
    <p class="hint">
      无限六边形地图，1 格 = 5 尺。上面选择团后自动进入战斗会话，地图/先攻/HP/法术区全部走长连接实时同步；
      右上角工具：拖图 / 移动参战者 / 测量 / 锥形 / 圆形法术区。
    </p>

    <!-- 战斗会话（长连接） -->
    <CombatSessionPanel />

    <!-- 地图舞台 -->
    <div ref="stageRef" class="map-stage">
      <canvas
        ref="canvasRef"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseLeave"
        @wheel.prevent="onWheel"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
      ></canvas>

      <!-- 左下角坐标 -->
      <div class="coord-badge">
        <span v-if="hoverPos">坐标 ({{ hoverPos.q }}, {{ hoverPos.r }})</span>
        <span v-else>选择团后拖拽参战者移动</span>
      </div>

      <!-- 右上角工具面板 -->
      <div class="tools-panel" :class="{ mini: !toolsOpen }">
        <div class="tools-toggle" title="收起 / 展开工具栏" @click="toolsOpen = !toolsOpen">{{ toolsOpen ? '−' : '🧰' }}</div>

        <template v-if="toolsOpen">
          <div class="tp-modes">
            <button :class="{ on: tool === 'pan' }" title="拖拽地图" @click="tool = 'pan'">🖐 拖图</button>
            <button :class="{ on: tool === 'char' }" title="拖拽人物位置" @click="tool = 'char'">🧍 移动参战者</button>
            <button :class="{ on: tool === 'measure' }" title="测量距离" @click="tool = 'measure'">📏 测量</button>
            <button :class="{ on: tool === 'cone' }" title="法术锥形" @click="tool = 'cone'">🔺 锥形</button>
            <button :class="{ on: tool === 'circle' }" title="圆形施法（范围）" @click="tool = 'circle'">🔵 圆形</button>
            <button :class="{ on: tool === 'rect' }" title="矩形法术区域" @click="tool = 'rect'">▭ 矩形</button>
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
          <div v-else-if="tool === 'rect'" class="tp-fields">
            <span class="tp-tip">{{ rectA && !rectB ? '点第 2 点：方向与长度' : rectA && rectB ? '点第 3 点：宽度' : '点第 1 个角（固定）' }}</span>
            <el-select v-model="spellBind" size="small" style="width: 104px" placeholder="绑定参战者">
              <el-option value="" label="不绑定" />
              <el-option v-for="t in session.combatants" :key="t.id" :value="t.id" :label="t.name || '角色'" />
            </el-select>
            <button class="tp-btn" @click="clearRect">清除</button>
          </div>

          <!-- 会话参战者（可拖拽） -->
          <div v-if="session.combatants.length" class="tp-list">
            <div class="tp-list-title">⚔️ 参战者（{{ session.combatants.length }}）</div>
            <div v-for="cmb in session.combatants" :key="cmb.id" class="tp-row tp-row-token" :class="{ on: cmb.id === session.currentCombatantId.value }" :title="'卡片ID: ' + (cmb.refId || '—')">
              <input type="color" v-model="cmb.color" class="tp-col" @click.stop @change="syncCmb(cmb)" />
              <input type="text" v-model="cmb.name" class="tp-name" @click.stop @change="syncCmb(cmb)" />
              <span class="tp-stat">
                <input type="number" v-model.number="cmb.hp.current" class="tp-hp" min="0" @click.stop @change="hpCurCmb(cmb)" />
                <span class="tp-hpsep">/</span>
                <input type="number" v-model.number="cmb.hp.max" class="tp-hp" min="0" @click.stop @change="hpMaxCmb(cmb)" />
              </span>
              <span class="tp-stat">AC{{ cmb.ac }}</span>
              <el-select v-model="cmb.size" size="small" style="width: 104px" @click.stop @change="syncCmb(cmb)">
                <el-option v-for="o in SIZE_OPTIONS" :key="o.label" :value="o.val" :label="sizeLabel(o.val)" />
              </el-select>
              <!-- 地图列表不提供删除参战者（在会话面板/行动顺序里操作） -->
            </div>
          </div>

          <!-- 法术区域（会话，可绑定参战者） -->
          <div class="tp-list">
            <div class="tp-list-title">法术区域（锥形/圆形）{{ session.spellAreas.length }}</div>
            <div v-for="ind in session.spellAreas" :key="ind.id" class="tp-row">
              <span class="tp-dot" :style="{ background: ind.type === 'circle' ? '#3b82f6' : '#ef4444' }"></span>
              <span class="tp-kind">{{ ind.type === 'circle' ? '🔵' : ind.type === 'rect' ? '▭' : '🔺' }}{{ ind.type === 'rect' ? (ind.widthFt || 0) + '×' + (ind.heightFt || 0) + '尺' : ind.ft + '尺' }}</span>
              <el-select v-model="ind.boundTo" size="small" style="width: 112px" placeholder="绑定参战者" @change="session.updateSpellArea(ind.id, { boundTo: ind.boundTo })">
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

    <!-- 长连接收发日志：地图下方实时观测同步（收广播/发 REST/WS 状态） -->
    <ReverbLogPanel />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import CombatSessionPanel from '../components/CombatSessionPanel.vue'
import ReverbLogPanel from '../components/ReverbLogPanel.vue'
import { useCombatSession } from '../composables/useCombatSession'

// ========== 配置 ==========
const HEX_SIZE = 30
const HEX_FT = 5
const MIN_ZOOM = 0.3
const MAX_ZOOM = 4

interface Hex {
  q: number
  r: number
}

const stageRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let gridCache: HTMLCanvasElement | null = null
let gridCacheKey = ''

const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const tool = ref<'pan' | 'char' | 'measure' | 'cone' | 'circle' | 'rect'>('char')
const toolsOpen = ref(true)
const showLibrary = false // 暂屏蔽左上角色来源面板
const session = useCombatSession()
watch(session.drawNotifier, () => drawMap())

const hoverPos = ref<Hex | null>(null)

const measureStart = ref<Hex | null>(null)
const measureEnd = ref<Hex | null>(null)
const measureData = ref('')
const coneStart = ref<Hex | null>(null)
const coneFt = ref(30)
const circleFt = ref(20)
const rectA = ref<Hex | null>(null) // 第 1 点：矩形角（固定锚点）
const rectB = ref<Hex | null>(null) // 第 2 点：定方向与长度
// 第 3 点（hover 实时）决定宽度；完成时以第三点击为准
const spellBind = ref('') // 绑定到某个参战者

let dragCmbId: string | null = null
let panDrag = false
let downPos = { x: 0, y: 0 }

const size = () => HEX_SIZE * zoom.value

// ========== 初始化 ==========
onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  const canvas = canvasRef.value
  if (canvas) ctx = canvas.getContext('2d')
  session.bindCardSource() // 角色卡(name/AC/体型) -> 会话参战者 只读跟随；会话 HP -> 卡 单独回写
  drawMap()
})

onUnmounted(() => {
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
    else if (area.type === 'rect') drawRectShape(origin, area.widthFt || 10, area.heightFt || 10, area.angle || 0)
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

  // 矩形三点预览：第 1 点固定显示；第 2 点后实时预览（C=鼠标）
  if (tool.value === 'rect' && rectA.value) {
    const pa = hexToScreen(rectA.value.q, rectA.value.r)
    drawAnchor(pa, '1')
    if (hoverPos.value) {
      if (rectB.value) {
        const r3 = rectFrom3(rectA.value, rectB.value, hoverPos.value)
        if (r3) {
          drawRectShape({ q: r3.q, r: r3.r }, r3.widthFt, r3.heightFt, r3.angle, true)
          const pb = hexToScreen(rectB.value.q, rectB.value.r)
          drawAnchor(pb, '2')
        }
      } else {
        // 只定了第 1 点：画边线到鼠标
        const pb = hexToScreen(hoverPos.value.q, hoverPos.value.r)
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.strokeStyle = 'rgba(168,85,247,0.6)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  // 会话法术区域已在上面渲染（本地 indicators 不再使用，避免残留无法删除）

  if (tool.value === 'char' && hoverPos.value) {
    // 移动参战者工具的悬浮格轻微高亮
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
// 以两个对角顶点构造轴对齐矩形：世界坐标求中心与宽高，再换算为中心格 + 宽×高（尺）
function worldPos(h: Hex) {
  return gridPixel(h.q, h.r, HEX_SIZE) // 基础缩放下的世界坐标（不含 zoom/pan）
}
function worldToHexPx(wx: number, wy: number): Hex {
  const sz = HEX_SIZE
  const q = ((2 / 3) * wx) / sz
  const rr = ((-1 / 3) * wx + (Math.sqrt(3) / 3) * wy) / sz
  return hexRound(q, rr)
}
// 三点构造旋转矩形：A=角点(固定) B=方向与长度 C=宽度
// 几何：AB 为矩形底边（长=lengthFt、方向 angle），宽= C 到直线 AB 的距离，向 C 侧展开
function rectFrom3(a: Hex, b: Hex, c: Hex): { q: number; r: number; angle: number; widthFt: number; heightFt: number } | null {
  const A = worldPos(a)
  const B = worldPos(b)
  const C = worldPos(c)
  const vx = B.x - A.x
  const vy = B.y - A.y
  const L = Math.hypot(vx, vy)
  if (L < 1e-6) return null
  const angle = Math.atan2(vy, vx)
  const cross = vx * (C.y - A.y) - vy * (C.x - A.x)
  const h = Math.abs(cross) / L // 垂直距离（世界像素）
  const s = cross >= 0 ? 1 : -1 // 向 C 侧
  const pxPerFtBase = HEX_SIZE / HEX_FT
  const lengthFt = Math.max(1, Math.round(L / pxPerFtBase))
  const heightFt = Math.max(1, Math.round(h / pxPerFtBase))
  // 中心 = AB 中点 + 向 C 侧偏移 h/2（使 AB 成为矩形底边）
  const wx = A.x + vx / 2 + (-vy / L) * (h / 2) * s
  const wy = A.y + vy / 2 + (vx / L) * (h / 2) * s
  const center = worldToHexPx(wx, wy)
  return { q: center.q, r: center.r, angle, widthFt: lengthFt, heightFt }
}
function commitRect(a: Hex, b: Hex, c: Hex) {
  const r3 = rectFrom3(a, b, c)
  if (!r3) return
  session.addSpellArea({
    type: 'rect',
    q: r3.q,
    r: r3.r,
    angle: r3.angle,
    ft: 0,
    widthFt: r3.widthFt,
    heightFt: r3.heightFt,
    boundTo: spellBind.value || null,
  })
}
function clearRect() {
  rectA.value = null
  rectB.value = null
  drawMap()
}
function drawRectShape(origin: Hex, wFt: number, hFt: number, angleRad: number, isPreview = false) {
  if (!ctx) return
  const sz = size()
  const c = hexToScreen(origin.q, origin.r)
  const pxPerFt = (Math.sqrt(3) * sz) / HEX_FT // 与圆形一致的每尺像素比例
  const halfW = (wFt * pxPerFt) / 2
  const halfH = (hFt * pxPerFt) / 2
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(angleRad)
  ctx.fillStyle = isPreview ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.22)'
  ctx.fillRect(-halfW, -halfH, halfW * 2, halfH * 2)
  ctx.strokeStyle = 'rgba(168,85,247,0.85)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2)
  ctx.restore()
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#6d28d9'
  ctx.textAlign = 'center'
  ctx.fillText(`${wFt}×${hFt} 尺`, c.x, c.y)
}
function drawAnchor(p: { x: number; y: number }, label: string) {
  if (!ctx) return
  ctx.beginPath()
  ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(168,85,247,0.9)'
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, p.x, p.y)
  ctx.textBaseline = 'alphabetic'
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
  if (e.button === 1 || tool.value === 'pan') {
    panDrag = true
    return
  }
  if (tool.value !== 'char') return
  dragCmbId = hitAt(x, y)
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
  if (dragCmbId != null && hoverPos.value) {
    session.moveCombatant(dragCmbId, hoverPos.value.q, hoverPos.value.r)
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
    // 仅移动参战者，点击空白不新建
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
  } else if (tool.value === 'rect') {
    if (!hex) return
    if (!rectA.value) {
      rectA.value = hex
    } else if (!rectB.value) {
      rectB.value = hex
    } else {
      commitRect(rectA.value, rectB.value, hex)
      rectA.value = null
      rectB.value = null
    }
    drawMap()
  }
  dragCmbId = null
  drawMap()
}
function onMouseLeave() {
  hoverPos.value = null
  dragCmbId = null
  panDrag = false
  drawMap()
}
function onContextMenu() {
  // 长连接模式：删除参战者在会话面板/行动顺序里操作（地图右键不再删除任何东西）
}
function hitAt(x: number, y: number): string | null {
  for (let i = session.combatants.length - 1; i >= 0; i--) {
    const cmb = session.combatants[i]
    const p = hexToScreen(cmb.q, cmb.r)
    if (Math.hypot(p.x - x, p.y - y) <= charRadius(cmb.size) + 4) return cmb.id
  }
  return null
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
  drawMap()
}
function clearCircle() {
  for (let i = session.spellAreas.length - 1; i >= 0; i--) {
    if (session.spellAreas[i].type === 'circle') session.removeSpellArea(session.spellAreas[i].id)
  }
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
function sizeLabel(val: number): string {
  const s = SIZE_OPTIONS.find((o) => o.val === val)
  return s ? `${s.label} · ${val}格` : `${val}格`
}
// 会话参战者行内编辑（颜色/名字/体型/AC 等整条同步到后端）
function syncCmb(cmb: any) {
  session.syncCombatant(cmb.id)
}
function hpCurCmb(cmb: any) {
  session.setHp(cmb.id, { current: cmb.hp.current })
}
function hpMaxCmb(cmb: any) {
  session.setHp(cmb.id, { max: cmb.hp.max })
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
