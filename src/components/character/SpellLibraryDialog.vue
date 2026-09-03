<template>
  <el-dialog :model-value="open" :title="title" width="760px" @update:model-value="$emit('close')" @open="onOpen" append-to-body>
    <div class="sl-tabs">
      <button :class="{ on: mode === 'pick' }" @click="switchMode('pick')">📚 从法术库添加</button>
      <button :class="{ on: mode === 'manage' }" @click="switchMode('manage')">🗂 管理法术库</button>
    </div>

    <template v-if="mode === 'pick'">
      <div class="sl-filter">
        <input v-model="q" class="sl-q" placeholder="搜索法术名 / 学派 / 效果…" @input="page = 1" />
        <button :class="{ on: level === null }" @click="level = null; page = 1">全部</button>
        <button v-for="lv in 10" :key="lv" :class="{ on: level === lv - 1 }" @click="level = lv - 1; page = 1">{{ lv - 1 }} 环</button>
      </div>
      <div class="sl-list">
        <div v-for="sp in paged" :key="sp.id" class="sl-row" @dblclick="emitPick(sp)">
          <span class="sl-lv">{{ sp.level }}环</span>
          <span class="sl-name">{{ sp.name }}</span>
          <span class="sl-sch">{{ sp.school }}</span>
          <span class="sl-meta">{{ sp.castingTime }} / {{ sp.range }} / {{ sp.duration }}</span>
          <el-button size="small" type="primary" plain @click.stop="emitPick(sp)">＋ 加入角色</el-button>
        </div>
        <div v-if="!paged.length" class="sl-empty">没有匹配的法术</div>
      </div>
      <div class="sl-pager">
        <span>共 {{ filtered.length }} 条</span>
        <button :disabled="page <= 1" @click="page--">‹ 上一页</button>
        <span class="sl-page">第 {{ page }} / {{ maxPage }} 页</span>
        <button :disabled="page >= maxPage" @click="page++">下一页 ›</button>
      </div>
    </template>

    <template v-else>
      <div class="sl-manage-tip">在此新增“自定义法术”入库（供所有角色卡挑选）；内置 xlsx 法术库不可删，可用「恢复标准库」重建。</div>
      <div class="sl-custom-form">
        <input v-model="form.name" placeholder="法术名（必填）" class="sl-fn" />
        <input v-model.number="form.level" type="number" min="0" max="9" placeholder="环" class="sl-fs" />
        <input v-model="form.school" placeholder="学派" class="sl-fs" />
        <input v-model="form.castingTime" placeholder="施法时间" class="sl-fs" />
        <input v-model="form.range" placeholder="距离" class="sl-fs" />
        <input v-model="form.duration" placeholder="持续时间" class="sl-fs" />
        <label class="sl-chk"><input v-model="form.v" type="checkbox" />V</label>
        <label class="sl-chk"><input v-model="form.s" type="checkbox" />S</label>
        <label class="sl-chk"><input v-model="form.m" type="checkbox" />M</label>
        <input v-model="form.material" placeholder="材料" class="sl-fm" />
        <textarea v-model="form.effect" placeholder="法术效果 / 详述" class="sl-fe" rows="2"></textarea>
        <el-button size="small" type="success" @click="addCustom">＋ 加入法术库</el-button>
      </div>
      <div class="sl-filter">
        <input v-model="q" class="sl-q" placeholder="搜索…" @input="page = 1" />
        <button :class="{ on: level === null }" @click="level = null; page = 1">全部</button>
        <button v-for="lv in 10" :key="lv" :class="{ on: level === lv - 1 }" @click="level = lv - 1; page = 1">{{ lv - 1 }}环</button>
      </div>
      <div class="sl-list">
        <div v-for="sp in paged" :key="sp.id" class="sl-row">
          <span class="sl-lv">{{ sp.level }}环</span>
          <span class="sl-name">{{ sp.name }}</span>
          <span class="sl-sch">{{ sp.school }}</span>
          <span class="sl-src">{{ isBuiltin(sp.id) ? '内置' : '自定义' }}</span>
          <el-button v-if="!isBuiltin(sp.id)" size="small" type="danger" text @click="removeOne(sp)">删</el-button>
        </div>
        <div v-if="!paged.length" class="sl-empty">无条目（可先用上方表单新增自定义法术）</div>
      </div>
      <div class="sl-pager">
        <span>共 {{ filtered.length }} 条</span>
        <button :disabled="page <= 1" @click="page--">‹</button>
        <span class="sl-page">第 {{ page }} / {{ maxPage }} 页</span>
        <button :disabled="page >= maxPage" @click="page++">›</button>
        <el-button size="small" type="warning" plain style="margin-left: auto" @click="resetLib">恢复标准库（清空自定义）</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSpellLibrary } from '../../composables/useSpellLibrary'

const props = defineProps<{ open: boolean; mode?: 'pick' | 'manage' }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', spell: any): void }>()

const mode = ref<'pick' | 'manage'>(props.mode || 'pick')
const q = ref('')
const level = ref<number | null>(null)
const page = ref(1)
const PER = 20

const lib = useSpellLibrary()
const items = computed(() => lib.items.value || [])
const isBuiltin = lib.isBuiltin
const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return items.value.filter((sp: any) => {
    if (level.value !== null && Number(sp.level) !== level.value) return false
    if (!kw) return true
    return [sp.name, sp.school, sp.effect].some((f) => String(f || '').toLowerCase().includes(kw))
  })
})
const maxPage = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PER, page.value * PER))

const emptyForm = () => ({ name: '', level: 0, school: '', ritual: false, castingTime: '', range: '', duration: '', v: false, s: false, m: false, material: '', effect: '' })
const form = ref(emptyForm())

const title = computed(() => (mode.value === 'pick' ? '📚 法术库 — 选择并添加到当前角色' : '🗂 法术库管理'))

function switchMode(m: 'pick' | 'manage') {
  mode.value = m
  page.value = 1
}
function emitPick(sp: any) {
  emit('pick', sp)
}
async function onOpen() {
  page.value = 1
  await lib.ensureLoaded()
}
function addCustom() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写法术名')
    return
  }
  lib.addCustom({ ...form.value, ritual: false }).then(() => {
    ElMessage.success(`已加入法术库：${form.value.name.trim()}`)
    form.value = emptyForm()
    q.value = ''
    level.value = null
    page.value = 1
  })
}
function removeOne(sp: any) {
  lib.removeItem(sp.id).then((ok2: boolean) => ok2 && ElMessage.success(`已删除自定义法术：${sp.name}`))
}
async function resetLib() {
  try {
    await ElMessageBox.confirm('恢复标准库将删除全部自定义法术，确定？', '恢复标准库', { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' })
  } catch {
    return
  }
  await lib.resetToStandard()
  page.value = 1
  ElMessage.success('已恢复为标准法术库')
}
watch(
  () => props.open,
  (v) => {
    if (v) {
      mode.value = props.mode || 'pick'
      onOpen()
    }
  }
)
</script>

<style scoped>
.sl-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.sl-tabs button {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}
.sl-tabs button.on {
  background: #eef2ff;
  border-color: #6366f1;
  color: #4f46e5;
  font-weight: 600;
}
.sl-filter {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 8px;
}
.sl-q {
  flex: 1 1 180px;
  min-width: 140px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.sl-filter button {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}
.sl-filter button.on {
  background: #eef2ff;
  border-color: #6366f1;
  color: #4f46e5;
}
.sl-list {
  max-height: 340px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.sl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
}
.sl-row:hover {
  background: #f8fafc;
}
.sl-lv {
  color: #6366f1;
  font-weight: 600;
  width: 34px;
  flex: 0 0 auto;
}
.sl-name {
  font-weight: 600;
  flex: 0 0 auto;
  min-width: 90px;
}
.sl-sch {
  color: #6b7280;
  width: 56px;
  flex: 0 0 auto;
}
.sl-meta {
  color: #9ca3af;
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sl-src {
  font-size: 11px;
  color: #9ca3af;
  width: 44px;
}
.sl-empty {
  color: #9ca3af;
  padding: 24px;
  text-align: center;
}
.sl-pager {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 12px;
  color: #374151;
}
.sl-pager button {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  padding: 2px 10px;
  cursor: pointer;
}
.sl-pager button:disabled {
  opacity: 0.4;
}
.sl-page {
  color: #6b7280;
}
.sl-manage-tip {
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 8px;
}
.sl-custom-form {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px;
  background: #f8fafc;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  margin-bottom: 10px;
}
.sl-custom-form input,
.sl-custom-form textarea {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 12px;
}
.sl-fn {
  width: 150px;
}
.sl-fs {
  width: 64px;
}
.sl-fm {
  width: 110px;
}
.sl-fe {
  flex: 1 1 100%;
}
.sl-chk {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
</style>
