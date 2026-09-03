<template>
  <div class="party-manager">
    <div class="pm-header">
      <h2>👥 团（冒险小队）</h2>
      <p class="hint">
        把角色卡组成小队。每个角色只能属于一个团；在先攻骰页会选择团并自动带入其成员与资源。
      </p>
      <div class="pm-toolbar">
        <el-button type="primary" @click="addParty">＋ 新建团</el-button>
        <el-button v-if="parties.length" type="danger" plain @click="deleteCurrentParty">删除当前团</el-button>
        <span v-if="parties.length" class="pm-count">共 {{ parties.length }} 个团</span>
      </div>
    </div>

    <div v-if="!parties.length" class="pm-empty">
      <p>还没有团。点击「＋ 新建团」，然后从下方把角色卡加进来。</p>
      <p v-if="!cards.length" class="pm-empty-sub">角色卡库为空，请先在「角色卡」页添加角色。</p>
    </div>

    <div v-else class="pm-layout">
      <!-- 左侧：团列表 -->
      <aside class="pm-list">
        <div
          v-for="p in parties"
          :key="p.id"
          class="pm-party-item"
          :class="{ active: p.id === currentPartyId }"
          @click="currentPartyId = p.id"
        >
          <div class="pm-party-name">{{ p.name || '未命名团' }}</div>
          <div class="pm-party-meta">{{ p.memberIds.length }} 名成员</div>
        </div>
      </aside>

      <!-- 右侧：当前团详情 -->
      <section v-if="currentParty" class="pm-detail">
        <div class="pm-name-row">
          <span class="pm-name-label">团名</span>
          <el-input v-model="currentParty.name" size="large" placeholder="给团起个名字" />
        </div>

        <div class="pm-section">
          <h4>成员（{{ currentMembers.length }}）</h4>
          <div v-if="!currentMembers.length" class="pm-member-empty">暂无成员，从右侧下拉添加角色卡。</div>
          <table v-else class="pm-table">
            <thead>
              <tr>
                <th>角色</th>
                <th>职业/等级</th>
                <th>HP</th>
                <th>AC</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in currentMembers" :key="m.id">
                <td class="pm-cname">{{ m.name || '未命名角色' }}</td>
                <td>{{ classSummary(m) }}</td>
                <td>{{ m.hp.current }}/{{ m.hp.max }}</td>
                <td>{{ totalAC(m) }}</td>
                <td>
                  <el-button size="small" type="danger" text @click="removeMember(m.id)">移除</el-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pm-section">
          <h4>添加成员</h4>
          <el-select v-model="memberToAdd" placeholder="选择未入团的角色卡…" class="pm-add-select" @change="addMember">
            <el-option v-for="c in availableCards" :key="c.id" :value="c.id" :label="`${c.name || '未命名角色'}（${classSummary(c)}）`" />
          </el-select>
          <div v-if="!availableCards.length" class="pm-avail-empty">
            没有可加入的角色卡（要么已在其它团，要么角色卡库为空）。
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CharacterCard } from '../data/dndModel'
import { normalizeCharacterCard, getClassSummary as classSummary, getTotalAC as totalAC } from '../data/dndModel'
import type { Party } from '../data/partyModel'
import {
  loadParties,
  saveParties,
  createParty,
  addMemberToParty,
  removeMemberFromParty,
  renameParty,
  deleteParty,
  findPartyByMember,
} from '../data/partyModel'
import { backendPing, backendFetchParties, backendPublishParties } from '../api/characterBackend'
import { onPartiesLive } from '../api/reverb'

const CARDS_KEY = 'dnd-character-cards'

const cards = ref<CharacterCard[]>([])
const parties = ref<Party[]>([])
const currentPartyId = ref('')
const memberToAdd = ref('')

const currentParty = computed(() => parties.value.find((x) => x.id === currentPartyId.value) || null)

const currentMembers = computed(() =>
  (currentParty.value?.memberIds || [])
    .map((id) => cards.value.find((c) => c.id === id))
    .filter((c): c is CharacterCard => !!c)
)

// 未加入任何团的角色卡
const availableCards = computed(() => {
  const taken = new Set<string>()
  parties.value.forEach((p) => p.memberIds.forEach((id) => taken.add(id)))
  return cards.value.filter((c) => !taken.has(c.id))
})

function loadCards() {
  try {
    const saved = localStorage.getItem(CARDS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      cards.value = Array.isArray(parsed)
        ? parsed.map(normalizeCharacterCard).filter((c): c is CharacterCard => c !== null)
        : []
    }
  } catch (e) {
    console.error('读取角色卡失败', e)
    cards.value = []
  }
}

let publishTimer: ReturnType<typeof setTimeout> | null = null
let pulling = false
let suppressPublish = false // 远端覆盖/初始载入时抑制“再发布”回环
let addBusy = false // 连点保护：新增团 400ms 内只建一个

function persist() {
  if (suppressPublish) {
    suppressPublish = false
    saveParties(parties.value) // 只落本地，不再回发（防 echo 回环）
    return
  }
  saveParties(parties.value)
  // 防抖自动发布到后端（团 = 会话 id，多设备共享必须上传）
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = setTimeout(async () => {
    const ok = await backendPublishParties(JSON.parse(JSON.stringify(parties.value)))
    if (!ok) console.warn('团同步到后端失败（离线？）——本地已保存，恢复联网后会自动重试')
  }, 500)
}

// 用远端/实时数据替换本地列表（保留当前选中），并抑制回发
function applyRemote(list: any[]) {
  suppressPublish = true
  const sel = currentPartyId.value
  parties.value = list.map((r: any) => ({
    id: String(r.id),
    name: r.name || '团',
    memberIds: (Array.isArray(r.member_ids) ? r.member_ids : Array.isArray(r.memberIds) ? r.memberIds : []).map(String),
    createdAt: r.created_at || r.createdAt || '',
    updatedAt: r.updated_at || r.updatedAt || '',
  }))
  if (sel && parties.value.some((p2) => p2.id === sel)) currentPartyId.value = sel
  else currentPartyId.value = parties.value[0]?.id ?? ''
  saveParties(parties.value)
}


// 周期从后端拉取（设备1/设备2 共用同一后端时，他端新建/改团这里会自动出现）
async function pullFromBackend() {
  if (pulling) return
  pulling = true
  try {
    const online = await backendPing()
    if (!online) return
    const remote = await backendFetchParties()
    if (remote && Array.isArray(remote) && remote.length) applyRemote(remote)
    else if (parties.value.length) {
      await backendPublishParties(JSON.parse(JSON.stringify(parties.value)))
    }
  } finally {
    pulling = false
  }
}

function addParty() {
  // 连点/双击保护：400ms 内只允许新建一个团
  if (addBusy) return
  addBusy = true
  setTimeout(() => (addBusy = false), 400)
  const p = createParty(`团 ${parties.value.length + 1}`)
  parties.value.push(p)
  currentPartyId.value = p.id
  ElMessage.success('已新建团')
}

async function deleteCurrentParty() {
  if (!currentParty.value) return
  try {
    await ElMessageBox.confirm(`确定删除「${currentParty.value.name || '未命名团'}」？成员将从团中移除（不会删除角色卡）。`, '删除团', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  parties.value = deleteParty(parties.value, currentPartyId.value)
  currentPartyId.value = parties.value[0]?.id ?? ''
  ElMessage.success('已删除团')
}

function addMember(cardId: string) {
  if (!currentPartyId.value) return
  // 若角色已属于其它团，先提示并移动
  const owner = findPartyByMember(parties.value, cardId)
  if (owner && owner.id !== currentPartyId.value) {
    ElMessage.info(`「${cards.value.find((c) => c.id === cardId)?.name}」已属于「${owner.name}」，现移入当前团`)
  }
  parties.value = addMemberToParty(parties.value, currentPartyId.value, cardId)
  memberToAdd.value = ''
  ElMessage.success('已加入当日团')
}

function removeMember(cardId: string) {
  parties.value = removeMemberFromParty(parties.value, currentPartyId.value, cardId)
}

watch(parties, persist, { deep: true })

function onMountedInit() {
  loadCards()
  suppressPublish = true
  parties.value = loadParties()
  currentPartyId.value = parties.value[0]?.id ?? ''
  suppressPublish = false
  syncFromBackend()
  // 实时频道（团页单独会话 presence-parties）
  onPartiesLive((list) => {
    if (Array.isArray(list)) applyRemote(list)
  })
  // 每 30s 兜底拉一次（离线/未连 WS 时仍能同步）
  setInterval(() => pullFromBackend(), 30000)
}

// 拉取后端团数据（若在线且后端有数据则替换本地，否则推送本地上去）
async function syncFromBackend() {
  const online = await backendPing()
  if (!online) return
  const remote = await backendFetchParties()
  if (remote && remote.length) applyRemote(remote)
  else if (parties.value.length) {
    backendPublishParties(JSON.parse(JSON.stringify(parties.value)))
  }
}

onMounted(onMountedInit)
</script>

<style scoped>
.party-manager {
  padding: 8px 4px 40px;
}
.pm-header h2 {
  margin: 0 0 4px;
}
.hint {
  color: #777;
  font-size: 13px;
  margin: 4px 0 14px;
}
.pm-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.pm-count {
  color: #9ca3af;
  font-size: 13px;
}
.pm-empty {
  padding: 60px 20px;
  text-align: center;
  color: #9ca3af;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
}
.pm-empty-sub {
  font-size: 12px;
}
.pm-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  align-items: start;
}
.pm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pm-party-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pm-party-item.active {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
  background: #eef2ff;
}
.pm-party-name {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pm-party-meta {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}
.pm-detail {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}
.pm-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.pm-name-label {
  width: 52px;
  flex: 0 0 auto;
  color: #4b5563;
  font-size: 14px;
}
.pm-section {
  margin-bottom: 18px;
}
.pm-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
}
.pm-member-empty,
.pm-avail-empty {
  color: #9ca3af;
  font-size: 13px;
  padding: 8px 0;
}
.pm-table {
  width: 100%;
  border-collapse: collapse;
}
.pm-table th,
.pm-table td {
  border: 1px solid #e5e7eb;
  padding: 6px 8px;
  text-align: left;
  font-size: 13px;
}
.pm-table th {
  background: #f3f4f6;
}
.pm-cname {
  font-weight: 600;
}
.pm-add-select {
  width: 420px;
  max-width: 100%;
}

@media (max-width: 860px) {
  .pm-layout {
    grid-template-columns: 1fr;
  }
}
</style>
