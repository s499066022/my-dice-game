<template>
  <div class="bestiary">
    <h2>👹 临时怪物图鉴</h2>
    <p class="hint">给怪物取名并上传图片（存到服务器 OSS），点击卡片可放大查看；图片来自后端 <code>/common/ossShowFile</code>。条目保存在本浏览器（后续可加共享表）。</p>

    <!-- 添加 -->
    <div class="be-add">
      <input v-model="newName" class="be-name" placeholder="怪物名称，如：构装骑士" :disabled="uploading" />
      <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFile" />
      <el-button type="primary" :loading="uploading" :disabled="!newName.trim()" @click="pickFile">＋ 选择图片上传</el-button>
      <span v-if="uploading" class="be-tip">上传中…</span>
      <span v-if="lastErr" class="be-err">{{ lastErr }}</span>
    </div>

    <!-- 图库网格 -->
    <div v-if="!items.length" class="be-empty">还没有怪物图片。填名称并上传一张图开始收集。</div>
    <div v-else class="be-grid">
      <div v-for="it in items" :key="it.id" class="be-card">
        <div class="be-thumb" @click="view(it)">
          <img :src="imgUrl(it)" loading="lazy" alt="" />
        </div>
        <div class="be-name-row">
          <span class="be-card-name">{{ it.name }}</span>
          <el-button size="small" type="danger" text @click="remove(it)">删</el-button>
        </div>
      </div>
    </div>

    <!-- 大图预览 -->
    <div v-if="preview" class="be-preview" @click="preview = null">
      <div class="be-preview-inner" @click.stop>
        <h3>{{ preview.name }}</h3>
        <img :src="imgUrl(preview)" />
        <el-button size="small" @click="preview = null">关闭</el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBackendBase, backendFetchBestiary, backendCreateBestiary, backendDeleteBestiary } from '../api/characterBackend'
import { onBestiaryLive } from '../api/reverb'
import { uid } from '../data/dndModel'

const STORE_KEY = 'dnd-bestiary'
interface MonsterImage {
  id: string
  name: string
  image_path: string // 服务器 OSS path，展示经 /common/ossShowFile?path=
}

const items = ref<MonsterImage[]>([])
const newName = ref('')
const uploading = ref(false)
const lastErr = ref('')
const preview = ref<MonsterImage | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function cache() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items.value))
  } catch { /* 忽略 */ }
}
function useCache() {
  try {
    const s = localStorage.getItem(STORE_KEY)
    if (s) items.value = JSON.parse(s)
  } catch { /* 忽略 */ }
}
async function load() {
  useCache() // 先展示本地缓存（离线/弱网也能看）
  try {
    const remote = await backendFetchBestiary()
    if (remote) {
      items.value = remote.map((r: any) => ({
        id: r.id,
        name: r.name || '',
        image_path: r.image_path || '',
      }))
      cache()
    }
  } catch { /* 离线 */ }
}
function imgUrl(it: MonsterImage): string {
  return `${getBackendBase()}/common/ossShowFile?path=${encodeURIComponent(it.image_path)}`
}
function pickFile() {
  fileInput.value?.click()
}
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const name = newName.value.trim()
  if (!name) {
    lastErr.value = '请先填写怪物名称'
    return
  }
  uploading.value = true
  lastErr.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${getBackendBase()}/common/ossupload`, { method: 'POST', body: fd })
    const j = await res.json()
    const path = j?.data?.path || j?.path
    if (!path) throw new Error('上传响应缺少 path：' + JSON.stringify(j).slice(0, 200))
    const id = uid()
    const ok = await backendCreateBestiary(id, name, path)
    if (!ok) throw new Error('保存到后端失败')
    items.value = [{ id, name, image_path: path }, ...items.value]
    cache()
    newName.value = ''
    ElMessage.success(`已加入图鉴：${name}`)
  } catch (err) {
    lastErr.value = '上传失败：' + String((err as any)?.message || err).slice(0, 160)
    ElMessage.error(lastErr.value)
  } finally {
    uploading.value = false
  }
}
function view(it: MonsterImage) {
  preview.value = it
}
async function remove(it: MonsterImage) {
  try {
    await ElMessageBox.confirm(`删除「${it.name}」？图片在服务器上，如需删除文件请到后端清理。`, '删除怪物', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch {
    return
  }
  const delOk = await backendDeleteBestiary(it.id)
  if (!delOk) {
    ElMessage.error('删除失败（后端不可用？）')
    return
  }
  items.value = items.value.filter((x) => x.id !== it.id)
  cache()
}

let offLive: (() => void) | null = null
onMounted(() => {
  load()
  offLive = onBestiaryLive((list) => {
    if (Array.isArray(list)) {
      items.value = list.map((r: any) => ({ id: r.id, name: r.name || '', image_path: r.image_path || '' }))
      cache()
    }
  })
})
onBeforeUnmount(() => {
  if (offLive) offLive()
})
</script>

<style scoped>
.bestiary {
  padding: 8px 4px 40px;
}
.bestiary h2 {
  margin: 0 0 4px;
}
.hint {
  color: #777;
  font-size: 13px;
  margin: 4px 0 12px;
}
.be-add {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.be-name {
  width: 220px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.be-tip {
  color: #2563eb;
}
.be-err {
  color: #dc2626;
}
.be-empty {
  color: #9ca3af;
  text-align: center;
  padding: 40px 0;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
}
.be-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.be-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}
.be-thumb {
  height: 150px;
  background: #f8fafc;
  cursor: zoom-in;
  display: flex;
  align-items: center;
  justify-content: center;
}
.be-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.be-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
}
.be-card-name {
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.be-preview {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  cursor: zoom-out;
}
.be-preview-inner {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.be-preview-inner h3 {
  margin: 0;
}
.be-preview-inner img {
  max-width: 82vw;
  max-height: 72vh;
  object-fit: contain;
}
</style>
